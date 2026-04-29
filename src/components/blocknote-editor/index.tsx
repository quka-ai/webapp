import type { BlockToolData, OutputData } from '@editorjs/editorjs';
import { BlockNoteSchema, blockHasType, createCodeBlockSpec, defaultBlockSpecs, type PartialBlock } from '@blocknote/core';
import { en } from '@blocknote/core/locales';
import { ja } from '@blocknote/core/locales';
import { zh } from '@blocknote/core/locales';
import { FormattingToolbar, FormattingToolbarController, getFormattingToolbarItems, useBlockNoteEditor, useComponentsContext, useCreateBlockNote, useEditorState, type FormattingToolbarProps } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { AxiosError } from 'axios';
import { Sparkles } from 'lucide-react';
import { forwardRef, memo, Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import showdown from 'showdown';
import { toast as sonnerToast } from 'sonner';
import { useSnapshot } from 'valtio';

import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import './style.css';

import { DescribeImage } from '@/apis/tools';
import { CreateUploadKey, UploadFileToKey } from '@/apis/upload';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/hooks/use-theme';
import { compressImage, CompressResult } from '@/lib/compress';
import { cn } from '@/lib/utils';
import spaceStore from '@/stores/space';

import { qukaCodeBlockOptions } from './code-block';

export type BlockNoteEditorValue = string | PartialBlock[];
type BlockNoteEditorData = string | OutputData | PartialBlock[];

const generatingImageDescriptions = new Map<string, boolean>();
const DEFAULT_CODE_BLOCK_LANGUAGE = 'shellscript';
const PLAIN_CODE_BLOCK_LANGUAGES = new Set(['', 'text', 'txt', 'plain', 'plaintext', 'none']);
const blockNoteSchema = BlockNoteSchema.create({
    blockSpecs: {
        ...defaultBlockSpecs,
        codeBlock: createCodeBlockSpec(qukaCodeBlockOptions)
    }
});

export interface BlockNoteEditorProps {
    readOnly: boolean;
    data?: BlockNoteEditorData;
    dataType?: string;
    outputFormat?: 'blocks' | 'markdown';
    placeholder?: string;
    autofocus?: boolean;
    className?: string;
    onValueChange?: (value: BlockNoteEditorValue) => void;
}

export interface BlockNoteEditorRefObject {
    reRender: (data: BlockNoteEditorData, dataType?: string) => void;
    update: (id: string, data: BlockToolData | PartialBlock) => void;
}

function escapeMarkdownText(value: string) {
    return value.replace(/\r\n/g, '\n').replace(/<br\s*\/?>/gi, '\n');
}

function stringifyListItems(items: any[], depth = 0, checked?: boolean): string {
    if (!Array.isArray(items)) {
        return '';
    }

    return items
        .map(item => {
            const content = escapeMarkdownText(item?.content || item?.text || '').trim();
            const prefix = checked === undefined ? '-' : `- [${item?.meta?.checked || item?.checked ? 'x' : ' '}]`;
            const current = `${'  '.repeat(depth)}${prefix} ${content}`;
            const children = stringifyListItems(item?.items || [], depth + 1, checked);

            return [current, children].filter(Boolean).join('\n');
        })
        .filter(Boolean)
        .join('\n');
}

function editorJSBlocksToMarkdown(data: OutputData): string {
    if (!data?.blocks) {
        return '';
    }

    return data.blocks
        .map(block => {
            const blockData: any = block.data || {};

            switch (block.type) {
                case 'header':
                    return `${'#'.repeat(blockData.level || 2)} ${escapeMarkdownText(blockData.text || '')}`;
                case 'paragraph':
                    return escapeMarkdownText(blockData.text || '');
                case 'quote':
                    return `> ${escapeMarkdownText(blockData.text || blockData.caption || '')}`;
                case 'delimiter':
                    return '---';
                case 'code':
                case 'codeBox':
                    return `\`\`\`${blockData.language || ''}\n${blockData.code || ''}\n\`\`\``;
                case 'table':
                    if (!Array.isArray(blockData.content) || blockData.content.length === 0) {
                        return '';
                    }

                    return blockData.content
                        .map((row: string[]) => `| ${row.join(' | ')} |`)
                        .join('\n');
                case 'image':
                    return `![${blockData.caption || ''}](${blockData.file?.url || blockData.url || ''})`;
                case 'video':
                    return blockData.file?.url || blockData.url || '';
                case 'list':
                case 'listv2':
                    return stringifyListItems(blockData.items || [], 0, blockData.style === 'checklist');
                default:
                    return escapeMarkdownText(blockData.text || blockData.content || '');
            }
        })
        .filter(Boolean)
        .join('\n\n');
}

function normalizeInputToMarkdown(data?: string | OutputData | PartialBlock[]): string {
    if (!data) {
        return '';
    }

    if (typeof data === 'string') {
        return data;
    }

    if (Array.isArray(data)) {
        return '';
    }

    return editorJSBlocksToMarkdown(data);
}

function containsRawHTML(markdown: string) {
    return /<\/?[a-z][\s\S]*?>/i.test(markdown);
}

function parseBlockNoteJSON(value: string): PartialBlock[] | null {
    try {
        const parsed = JSON.parse(value);

        if (Array.isArray(parsed)) {
            return parsed;
        }

        if (Array.isArray(parsed?.blocks)) {
            return parsed.blocks;
        }
    } catch {
        return null;
    }

    return null;
}

function markdownToBlocks(editor: ReturnType<typeof useCreateBlockNote>, markdown: string) {
    if (!containsRawHTML(markdown)) {
        return editor.tryParseMarkdownToBlocks(markdown);
    }

    const converter = new showdown.Converter({
        ghCodeBlocks: true,
        simpleLineBreaks: false,
        strikethrough: true,
        tables: true,
        tasklists: true
    });

    return editor.tryParseHTMLToBlocks(converter.makeHtml(markdown));
}

function isCodeBlockContentEmpty(content: any): boolean {
    if (!content) {
        return true;
    }

    if (typeof content === 'string') {
        return content.trim().length === 0;
    }

    if (!Array.isArray(content)) {
        return false;
    }

    return content.every(item => {
        if (!item) {
            return true;
        }

        if (typeof item === 'string') {
            return item.trim().length === 0;
        }

        if (typeof item.text === 'string') {
            return item.text.trim().length === 0;
        }

        return isCodeBlockContentEmpty(item.content);
    });
}

function shouldUseDefaultCodeBlockLanguage(block: any): boolean {
    if (block?.type !== 'codeBlock' || !isCodeBlockContentEmpty(block.content)) {
        return false;
    }

    const language = String(block.props?.language || '').toLowerCase();

    return PLAIN_CODE_BLOCK_LANGUAGES.has(language);
}

function normalizeEmptyCodeBlockLanguages(blocks: PartialBlock[]) {
    return blocks.map((block: any) => {
        const children = Array.isArray(block.children) ? normalizeEmptyCodeBlockLanguages(block.children) : block.children;

        if (!shouldUseDefaultCodeBlockLanguage(block)) {
            return children === block.children ? block : { ...block, children };
        }

        return {
            ...block,
            children,
            props: {
                ...block.props,
                language: DEFAULT_CODE_BLOCK_LANGUAGE
            }
        };
    }) as PartialBlock[];
}

function ensureEmptyCodeBlocksUseShell(editor: ReturnType<typeof useCreateBlockNote>) {
    const emptyCodeBlocks = editor.document.filter((block: any) => shouldUseDefaultCodeBlockLanguage(block));

    emptyCodeBlocks.forEach((block: any) => {
        editor.updateBlock(block, {
            props: {
                language: DEFAULT_CODE_BLOCK_LANGUAGE
            }
        });
    });

    return emptyCodeBlocks.length > 0;
}

async function parseInput(editor: ReturnType<typeof useCreateBlockNote>, data?: string | OutputData | PartialBlock[], dataType = '') {
    if (Array.isArray(data)) {
        return normalizeEmptyCodeBlockLanguages(data);
    }

    const normalizedType = dataType.toLowerCase();
    const fallback = [{ type: 'paragraph', content: '' }] as PartialBlock[];
    const isBlockNoteJSON = ['blocks_v2', 'block_v2', 'blocknote', 'blocknote_json'].includes(normalizedType);

    if (!data) {
        return fallback;
    }

    if (typeof data !== 'string') {
        const markdown = editorJSBlocksToMarkdown(data);

        return markdown ? normalizeEmptyCodeBlockLanguages(await editor.tryParseMarkdownToBlocks(markdown)) : fallback;
    }

    if (!data.trim()) {
        return fallback;
    }

    if (isBlockNoteJSON) {
        const parsedBlocks = parseBlockNoteJSON(data);

        if (parsedBlocks) {
            return normalizeEmptyCodeBlockLanguages(parsedBlocks);
        }
    }

    if (normalizedType === 'html') {
        return normalizeEmptyCodeBlockLanguages(await editor.tryParseHTMLToBlocks(data));
    }

    return normalizeEmptyCodeBlockLanguages(await markdownToBlocks(editor, data));
}

function getUploader(toast: ReturnType<typeof useToast>['toast'], t: (d: string) => string, currentSelectedSpace: string) {
    return async function uploadFile(file: File) {
        try {
            let result = {} as CompressResult;
            let fileKind = 'file';

            if (file.type.startsWith('image')) {
                result = await compressImage(file);
                if (result.success && result.file) {
                    file = result.file;
                }
                fileKind = 'image';
            } else if (file.type.startsWith('video')) {
                fileKind = 'video';
            } else if (file.type.startsWith('audio')) {
                fileKind = 'audio';
            }

            if (result.error) {
                toast({
                    title: t('Error'),
                    description: result.error
                });

                throw new Error(result.error);
            }

            const resp = await CreateUploadKey(currentSelectedSpace, 'knowledge', fileKind, file.name, file.size);

            if (resp.status !== 'exist') {
                await UploadFileToKey(resp.key, file.type, result.file || file);
            }

            return {
                props: {
                    url: resp.url,
                    name: file.name
                }
            };
        } catch (e: any) {
            toast({
                title: t('Error'),
                description: e.message || e
            });

            throw e;
        }
    };
}

async function generateImageDescription(t: (d: string) => string, url: string): Promise<string | undefined> {
    if (generatingImageDescriptions.get(url)) {
        sonnerToast.warning(t('Please do not submit repeatedly'));

        return undefined;
    }

    try {
        generatingImageDescriptions.set(url, true);

        return await new Promise<string>((resolve, reject) => {
            sonnerToast.promise(DescribeImage(url), {
                loading: t('AI is processing the image, please wait a moment'),
                success: data => {
                    resolve(data);

                    return t('Success');
                },
                error: (err: AxiosError<any>) => {
                    reject(err);

                    return err.response?.data?.meta?.message || err.message;
                }
            });
        });
    } catch (e) {
        console.error(e);

        return undefined;
    } finally {
        generatingImageDescriptions.delete(url);
    }
}

function AIImageDescriptionButton() {
    const { t } = useTranslation();
    const Components = useComponentsContext()!;
    const editor = useBlockNoteEditor();

    const imageBlock = useEditorState({
        editor,
        selector: ({ editor }) => {
            if (!editor.isEditable) {
                return undefined;
            }

            const selectedBlocks = editor.getSelection?.()?.blocks || [editor.getTextCursorPosition().block];

            if (selectedBlocks.length !== 1) {
                return undefined;
            }

            const block = selectedBlocks[0];

            if (block.type !== 'image' || !blockHasType(block, editor, 'image', { url: 'string', caption: 'string' })) {
                return undefined;
            }

            return block;
        }
    });

    if (!imageBlock) {
        return null;
    }

    return (
        <Components.FormattingToolbar.Button
            className="bn-button"
            label={t('AI Description')}
            mainTooltip={t('AI Description')}
            icon={<Sparkles size={16} />}
            onClick={async () => {
                const url = imageBlock.props.url;
                if (!url) {
                    return;
                }

                const result = await generateImageDescription(t, url);
                if (!result) {
                    return;
                }

                editor.updateBlock(imageBlock.id, {
                    props: {
                        caption: result
                    }
                });
            }}
        />
    );
}

function BlockNoteFormattingToolbar(props: FormattingToolbarProps) {
    return (
        <FormattingToolbar {...props}>
            {getFormattingToolbarItems(props.blockTypeSelectItems)}
            <AIImageDescriptionButton />
        </FormattingToolbar>
    );
}

export const BlockNoteEditor = memo(
    forwardRef(({ data, dataType = '', outputFormat = 'blocks', autofocus = false, placeholder, readOnly, className, onValueChange }: BlockNoteEditorProps, ref: Ref<BlockNoteEditorRefObject>) => {
        const { t, i18n } = useTranslation();
        const { toast } = useToast();
        const { theme } = useTheme();
        const { currentSelectedSpace } = useSnapshot(spaceStore);
        const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
        const renderingRef = useRef(false);
        const lastEmittedValueRef = useRef<BlockNoteEditorValue | null>(null);

        const dictionary = useMemo(() => {
            if (i18n.language.startsWith('zh')) {
                return zh;
            }
            if (i18n.language.startsWith('ja')) {
                return ja;
            }

            return en;
        }, [i18n.language]);

        const editor = useCreateBlockNote(
            {
                autofocus: !readOnly && autofocus,
                dictionary,
                initialContent: [{ type: 'paragraph', content: '' }],
                placeholders: placeholder ? { default: placeholder } : undefined,
                schema: blockNoteSchema,
                uploadFile: readOnly || !currentSelectedSpace ? undefined : getUploader(toast, t, currentSelectedSpace)
            },
            [readOnly, autofocus, currentSelectedSpace, dictionary, placeholder]
        );

        useEffect(() => {
            editor.portalElement.classList.add('blocknote-editor-portal');
        }, [editor]);

        const renderData = useCallback(
            async (nextData?: string | OutputData | PartialBlock[], nextDataType = dataType) => {
                renderingRef.current = true;

                try {
                    const nextBlocks = await parseInput(editor, nextData, nextDataType);
                    editor.replaceBlocks(editor.document, nextBlocks.length > 0 ? nextBlocks : [{ type: 'paragraph', content: '' }]);
                } catch (e) {
                    console.error('blocknote render error', e);
                    const markdown = normalizeInputToMarkdown(nextData);
                    editor.replaceBlocks(editor.document, [{ type: 'paragraph', content: markdown }]);
                } finally {
                    window.setTimeout(() => {
                        renderingRef.current = false;
                    });
                }
            },
            [dataType, editor]
        );

        useEffect(() => {
            if (data && data === lastEmittedValueRef.current) {
                return;
            }

            renderData(data, dataType);
        }, [data, dataType, renderData]);

        useImperativeHandle(ref, () => ({
            reRender: (nextData, nextDataType = dataType) => {
                renderData(nextData, nextDataType);
            },
            update: id => {
                const block = editor.getBlock(id);

                if (block) {
                    editor.updateBlock(block, block);
                }
            }
        }));

        return (
            <div className={cn('blocknote-editor sm:mx-[60px]', readOnly && 'blocknote-editor--readonly', className)}>
                <BlockNoteView
                    editor={editor}
                    editable={!readOnly}
                    formattingToolbar={false}
                    theme={theme}
                    onChange={async currentEditor => {
                        if (!renderingRef.current && ensureEmptyCodeBlocksUseShell(currentEditor)) {
                            return;
                        }

                        if (!onValueChange || renderingRef.current) {
                            return;
                        }

                        if (saveTimeoutRef.current) {
                            clearTimeout(saveTimeoutRef.current);
                        }

                        saveTimeoutRef.current = setTimeout(() => {
                            const value = outputFormat === 'markdown' ? currentEditor.blocksToMarkdownLossy(currentEditor.document) : currentEditor.document;

                            lastEmittedValueRef.current = value;
                            onValueChange(value);
                        }, 500);
                    }}
                >
                    {!readOnly && <FormattingToolbarController formattingToolbar={BlockNoteFormattingToolbar} />}
                </BlockNoteView>
            </div>
        );
    })
);
