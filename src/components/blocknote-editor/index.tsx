import type { BlockToolData, OutputData } from '@editorjs/editorjs';
import { type PartialBlock } from '@blocknote/core';
import { en } from '@blocknote/core/locales';
import { ja } from '@blocknote/core/locales';
import { zh } from '@blocknote/core/locales';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { forwardRef, memo, Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import showdown from 'showdown';
import { useSnapshot } from 'valtio';

import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import './style.css';

import { CreateUploadKey, UploadFileToKey } from '@/apis/upload';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/hooks/use-theme';
import { compressImage, CompressResult } from '@/lib/compress';
import { cn } from '@/lib/utils';
import spaceStore from '@/stores/space';

export type BlockNoteEditorValue = string | PartialBlock[];
type BlockNoteEditorData = string | OutputData | PartialBlock[];

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

async function parseInput(editor: ReturnType<typeof useCreateBlockNote>, data?: string | OutputData | PartialBlock[], dataType = '') {
    if (Array.isArray(data)) {
        return data;
    }

    const normalizedType = dataType.toLowerCase();
    const fallback = [{ type: 'paragraph', content: '' }] as PartialBlock[];
    const isBlockNoteJSON = ['block_v2', 'blocknote', 'blocknote_json'].includes(normalizedType);

    if (!data) {
        return fallback;
    }

    if (typeof data !== 'string') {
        const markdown = editorJSBlocksToMarkdown(data);

        return markdown ? editor.tryParseMarkdownToBlocks(markdown) : fallback;
    }

    if (!data.trim()) {
        return fallback;
    }

    if (isBlockNoteJSON) {
        const parsedBlocks = parseBlockNoteJSON(data);

        if (parsedBlocks) {
            return parsedBlocks;
        }
    }

    if (normalizedType === 'html') {
        return editor.tryParseHTMLToBlocks(data);
    }

    return markdownToBlocks(editor, data);
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

export const BlockNoteEditor = memo(
    forwardRef(({ data, dataType = '', outputFormat = 'blocks', autofocus = false, placeholder, readOnly, className, onValueChange }: BlockNoteEditorProps, ref: Ref<BlockNoteEditorRefObject>) => {
        const { t, i18n } = useTranslation();
        const { toast } = useToast();
        const { theme } = useTheme();
        const { currentSelectedSpace } = useSnapshot(spaceStore);
        const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
        const renderingRef = useRef(false);

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
                    theme={theme}
                    onChange={async currentEditor => {
                        if (!onValueChange || renderingRef.current) {
                            return;
                        }

                        if (saveTimeoutRef.current) {
                            clearTimeout(saveTimeoutRef.current);
                        }

                        saveTimeoutRef.current = setTimeout(() => {
                            const value = outputFormat === 'markdown' ? currentEditor.blocksToMarkdownLossy(currentEditor.document) : currentEditor.document;

                            onValueChange(value);
                        }, 500);
                    }}
                />
            </div>
        );
    })
);
