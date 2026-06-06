import { blockHasType, BlockNoteSchema, createCodeBlockSpec, defaultBlockSpecs, type PartialBlock } from '@blocknote/core';
import { filterSuggestionItems, SideMenuExtension, SuggestionMenu } from '@blocknote/core/extensions';
import '@blocknote/core/fonts/inter.css';
import { en } from '@blocknote/core/locales';
import { ja } from '@blocknote/core/locales';
import { zh } from '@blocknote/core/locales';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import {
    BlockPopover,
    DefaultReactSuggestionItem,
    type FloatingUIOptions,
    FormattingToolbar,
    FormattingToolbarController,
    type FormattingToolbarProps,
    getDefaultReactSlashMenuItems,
    getFormattingToolbarItems,
    SideMenuController,
    SuggestionMenuController,
    useBlockNoteEditor,
    useComponentsContext,
    useCreateBlockNote,
    useEditorState,
    useExtension,
    useExtensionState
} from '@blocknote/react';
import type { BlockToolData, OutputData } from '@editorjs/editorjs';
import { autoUpdate, offset, ReferenceElement } from '@floating-ui/react';
import { TextSelection, type Transaction } from '@tiptap/pm/state';
import { AxiosError } from 'axios';
import { ArrowDown, ArrowUp, EyeOff, GripVertical, Palette, Plus, Sparkles, Trash2 } from 'lucide-react';
import { forwardRef, memo, Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controlled as ControlledZoom } from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';
import showdown from 'showdown';
import { toast as sonnerToast } from 'sonner';
import { useSnapshot } from 'valtio';

import { qukaCodeBlockOptions } from './code-block';
import './style.css';

import { DescribeImage } from '@/apis/tools';
import { CreateUploadKey, UploadFileToKey } from '@/apis/upload';
import { useMedia } from '@/hooks/use-media';
import { useTheme } from '@/hooks/use-theme';
import { useToast } from '@/hooks/use-toast';
import { compressImage, CompressResult } from '@/lib/compress';
import { cn } from '@/lib/utils';
import spaceStore from '@/stores/space';

export type BlockNoteEditorValue = string | PartialBlock[];
type BlockNoteEditorData = string | OutputData | PartialBlock[];
type ZoomedImage = {
    src: string;
    alt: string;
    rect: DOMRect;
    isZoomed: boolean;
};

const generatingImageDescriptions = new Map<string, boolean>();
const DEFAULT_CODE_BLOCK_LANGUAGE = 'shellscript';
const BLOCKNOTE_IMAGE_ZOOM_CHANGE_EVENT = 'quka:blocknote-image-zoom-change';
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

                    return blockData.content.map((row: string[]) => `| ${row.join(' | ')} |`).join('\n');
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

function normalizeBlockNoteBlocks(blocks: PartialBlock[], usedIds = new Set<string>()): PartialBlock[] {
    return blocks.map((block: PartialBlock): PartialBlock => {
        const children: PartialBlock[] | undefined = Array.isArray(block.children) ? normalizeBlockNoteBlocks(block.children, usedIds) : block.children;
        const blockId = typeof block.id === 'string' ? block.id.trim() : block.id == null ? '' : String(block.id);
        const shouldRegenerateId = !blockId || usedIds.has(blockId);
        const normalizedBlock = shouldRegenerateId ? { ...block, id: undefined, children } : { ...block, id: blockId, children };

        if (!shouldRegenerateId) {
            usedIds.add(blockId);
        }

        if (!shouldUseDefaultCodeBlockLanguage(normalizedBlock)) {
            return normalizedBlock;
        }

        return {
            ...normalizedBlock,
            props: {
                ...normalizedBlock.props,
                language: DEFAULT_CODE_BLOCK_LANGUAGE
            }
        } as PartialBlock;
    });
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

function findReadonlyImageFromEventTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
        return null;
    }

    const directImage = target.closest<HTMLImageElement>('img.bn-visual-media');
    if (directImage) {
        return directImage;
    }

    return target.closest<HTMLElement>('[data-file-block], .bn-file-block-content-wrapper, .bn-visual-media-wrapper')?.querySelector<HTMLImageElement>('img.bn-visual-media') || null;
}

function dispatchBlockNoteImageZoomChange(isZoomed: boolean) {
    window.dispatchEvent(
        new CustomEvent(BLOCKNOTE_IMAGE_ZOOM_CHANGE_EVENT, {
            detail: { isZoomed }
        })
    );
}

async function parseInput(editor: ReturnType<typeof useCreateBlockNote>, data?: string | OutputData | PartialBlock[], dataType = '') {
    if (Array.isArray(data)) {
        return normalizeBlockNoteBlocks(data);
    }

    const normalizedType = dataType.toLowerCase();
    const fallback = [{ type: 'paragraph', content: '' }] as PartialBlock[];
    const isBlockNoteJSON = ['blocks_v2', 'block_v2', 'blocknote', 'blocknote_json'].includes(normalizedType);

    if (!data) {
        return fallback;
    }

    if (typeof data !== 'string') {
        const markdown = editorJSBlocksToMarkdown(data);

        return markdown ? normalizeBlockNoteBlocks(await editor.tryParseMarkdownToBlocks(markdown)) : fallback;
    }

    if (!data.trim()) {
        return fallback;
    }

    if (isBlockNoteJSON) {
        const parsedBlocks = parseBlockNoteJSON(data);

        if (parsedBlocks) {
            return normalizeBlockNoteBlocks(parsedBlocks);
        }
    }

    if (normalizedType === 'html') {
        return normalizeBlockNoteBlocks(await editor.tryParseHTMLToBlocks(data));
    }

    return normalizeBlockNoteBlocks(await markdownToBlocks(editor, data));
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

function insertHiddenSyntax(editor: ReturnType<typeof useCreateBlockNote>) {
    const syntax = '$hidden[]';

    editor.transact((tr: Transaction) => {
        const { from, $from } = tr.selection;
        const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
        const slashIndex = textBeforeCursor.lastIndexOf('/');
        const replaceFrom = slashIndex >= 0 ? from - (textBeforeCursor.length - slashIndex) : from;

        tr.insertText(syntax, replaceFrom, from);
        tr.setSelection(TextSelection.create(tr.doc, replaceFrom + '$hidden['.length));
    });
}

const MOBILE_SIDE_MENU_COLORS = ['default', 'gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const;
function MobileSideMenu({ blockId, onLockBlock, onUnlockBlock }: { blockId: string; onLockBlock: () => void; onUnlockBlock: () => void }) {
    const { t } = useTranslation();
    const editor = useBlockNoteEditor<any, any, any>();
    const suggestionMenu = useExtension(SuggestionMenu);
    const sideMenu = useExtension(SideMenuExtension);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const block = editor.getBlock(blockId) as any;

    const closeMenu = useCallback(() => {
        setIsMenuOpen(false);
        sideMenu.unfreezeMenu();
        onUnlockBlock();
    }, [onUnlockBlock, sideMenu]);

    useEffect(() => {
        if (!isMenuOpen) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            if (menuRef.current?.contains(event.target as Node)) {
                return;
            }

            closeMenu();
        };

        document.addEventListener('pointerdown', handlePointerDown, true);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
        };
    }, [closeMenu, isMenuOpen]);

    useEffect(() => {
        return () => {
            sideMenu.unfreezeMenu();
        };
    }, [sideMenu]);

    const preventMouseFocus = useCallback((event: { preventDefault: () => void; stopPropagation: () => void }) => {
        event.preventDefault();
        event.stopPropagation();
    }, []);

    const stopPointerPropagation = useCallback((event: { stopPropagation: () => void }) => {
        event.stopPropagation();
    }, []);

    const handleAddBlock = useCallback(() => {
        if (!block) {
            return;
        }

        closeMenu();

        const blockContent = block.content;
        const isBlockEmpty = blockContent !== undefined && Array.isArray(blockContent) && blockContent.length === 0;

        if (isBlockEmpty) {
            editor.setTextCursorPosition(block);
            suggestionMenu.openSuggestionMenu('/');

            return;
        }

        const insertedBlock = editor.insertBlocks([{ type: 'paragraph' }], block, 'after')[0];
        editor.setTextCursorPosition(insertedBlock);
        suggestionMenu.openSuggestionMenu('/');
    }, [block, closeMenu, editor, suggestionMenu]);

    const handleToggleMenu = useCallback(() => {
        if (isMenuOpen) {
            closeMenu();

            return;
        }

        onLockBlock();
        sideMenu.freezeMenu();
        setIsMenuOpen(true);
    }, [closeMenu, isMenuOpen, onLockBlock, sideMenu]);

    const handleRemoveBlock = useCallback(() => {
        if (!block) {
            return;
        }

        editor.removeBlocks([block]);
        closeMenu();
    }, [block, closeMenu, editor]);

    const handleMoveBlock = useCallback(
        (direction: 'up' | 'down') => {
            if (!block) {
                return;
            }

            editor.setTextCursorPosition(block);
            if (direction === 'up') {
                editor.moveBlocksUp();
            } else {
                editor.moveBlocksDown();
            }
            closeMenu();
        },
        [block, closeMenu, editor]
    );

    const setBlockColor = useCallback(
        (styleType: 'textColor' | 'backgroundColor', color: string) => {
            if (!block) {
                return;
            }

            editor.updateBlock(block, {
                props: {
                    [styleType]: color
                }
            });
        },
        [block, editor]
    );

    if (!block) {
        return null;
    }

    return (
        <div ref={menuRef} className="bn-side-menu blocknote-editor-mobile-side-menu" data-block-type={block.type} onPointerDown={event => event.stopPropagation()}>
            <button
                type="button"
                className="blocknote-editor-mobile-side-menu__button"
                aria-label={t('Add block')}
                onMouseDown={preventMouseFocus}
                onPointerDown={stopPointerPropagation}
                onClick={handleAddBlock}
            >
                <Plus size={18} />
            </button>
            <button
                draggable
                type="button"
                className="blocknote-editor-mobile-side-menu__button"
                aria-label={t('Block actions')}
                onMouseDown={preventMouseFocus}
                onPointerDown={event => {
                    stopPointerPropagation(event);
                    onLockBlock();
                }}
                onDragStart={event => sideMenu.blockDragStart(event, block)}
                onDragEnd={sideMenu.blockDragEnd}
                onClick={handleToggleMenu}
            >
                <GripVertical size={18} />
            </button>
            {isMenuOpen && (
                <div className="blocknote-editor-mobile-side-menu__dropdown" onMouseDown={preventMouseFocus} onPointerDown={stopPointerPropagation}>
                    <button type="button" className="blocknote-editor-mobile-side-menu__item" onClick={() => handleMoveBlock('up')}>
                        <ArrowUp size={16} />
                        <span>{t('Move up')}</span>
                    </button>
                    <button type="button" className="blocknote-editor-mobile-side-menu__item" onClick={() => handleMoveBlock('down')}>
                        <ArrowDown size={16} />
                        <span>{t('Move down')}</span>
                    </button>
                    <button type="button" className="blocknote-editor-mobile-side-menu__item" onClick={handleRemoveBlock}>
                        <Trash2 size={16} />
                        <span>{t('Delete')}</span>
                    </button>
                    <div className="blocknote-editor-mobile-side-menu__colors">
                        <div className="blocknote-editor-mobile-side-menu__label">
                            <Palette size={15} />
                            <span>{t('Text Color')}</span>
                        </div>
                        <div className="blocknote-editor-mobile-side-menu__swatches">
                            {MOBILE_SIDE_MENU_COLORS.map(color => (
                                <button
                                    key={`text-${color}`}
                                    type="button"
                                    className="blocknote-editor-mobile-side-menu__swatch"
                                    data-color={color}
                                    aria-label={`${t('Text Color')} ${color}`}
                                    onClick={() => setBlockColor('textColor', color)}
                                />
                            ))}
                        </div>
                        <div className="blocknote-editor-mobile-side-menu__label">
                            <Palette size={15} />
                            <span>{t('Background Color')}</span>
                        </div>
                        <div className="blocknote-editor-mobile-side-menu__swatches">
                            {MOBILE_SIDE_MENU_COLORS.map(color => (
                                <button
                                    key={`background-${color}`}
                                    type="button"
                                    className="blocknote-editor-mobile-side-menu__swatch"
                                    data-color={color}
                                    aria-label={`${t('Background Color')} ${color}`}
                                    onClick={() => setBlockColor('backgroundColor', color)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MobileSideMenuController({ floatingUIOptions }: { floatingUIOptions: Partial<FloatingUIOptions> }) {
    const editor = useBlockNoteEditor();
    const state = useExtensionState(SideMenuExtension, {
        selector: state => {
            if (!state) {
                return undefined;
            }

            return {
                show: state.show,
                block: state.block
            };
        }
    }) as { show?: boolean; block?: { id: string } } | undefined;
    const [lockedBlockId, setLockedBlockId] = useState<string | null>(null);
    const activeBlockId = lockedBlockId || state?.block?.id;

    const whileElementsMounted = useCallback(
        (reference: ReferenceElement, floating: HTMLElement, update: () => void) => {
            let initialized = false;

            return autoUpdate(
                reference,
                floating,
                () => {
                    update();

                    if (!initialized) {
                        initialized = true;

                        return;
                    }

                    editor.getExtension(SideMenuExtension)?.hideMenuIfNotFrozen();
                },
                {
                    ancestorScroll: true,
                    ancestorResize: false,
                    elementResize: false,
                    layoutShift: false
                }
            );
        },
        [editor]
    );

    const mergedFloatingUIOptions = useMemo<FloatingUIOptions>(
        () => ({
            ...floatingUIOptions,
            useFloatingOptions: {
                open: state?.show,
                whileElementsMounted,
                ...floatingUIOptions.useFloatingOptions
            },
            useDismissProps: {
                enabled: false,
                ...floatingUIOptions.useDismissProps
            },
            focusManagerProps: {
                disabled: true,
                ...floatingUIOptions.focusManagerProps
            },
            elementProps: {
                ...floatingUIOptions.elementProps,
                style: {
                    zIndex: 20,
                    ...floatingUIOptions.elementProps?.style
                }
            }
        }),
        [floatingUIOptions, state?.show, whileElementsMounted]
    );

    useEffect(() => {
        if (!state?.show) {
            setLockedBlockId(null);
        }
    }, [state?.show]);

    if (!state?.show || !activeBlockId) {
        return null;
    }

    return (
        <BlockPopover blockId={activeBlockId} {...mergedFloatingUIOptions}>
            <MobileSideMenu blockId={activeBlockId} onLockBlock={() => setLockedBlockId(activeBlockId)} onUnlockBlock={() => setLockedBlockId(null)} />
        </BlockPopover>
    );
}

export const BlockNoteEditor = memo(
    forwardRef(({ data, dataType = '', outputFormat = 'blocks', autofocus = false, placeholder, readOnly, className, onValueChange }: BlockNoteEditorProps, ref: Ref<BlockNoteEditorRefObject>) => {
        const { t, i18n } = useTranslation();
        const { toast } = useToast();
        const { theme } = useTheme();
        const { isMobile, isCoarsePointer } = useMedia();
        const useMobileSideMenu = isMobile && isCoarsePointer;
        const { currentSelectedSpace } = useSnapshot(spaceStore);
        const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
        const zoomCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
        const zoomOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
        const renderingRef = useRef(false);
        const lastEmittedValueRef = useRef<BlockNoteEditorValue | null>(null);
        const [zoomedImage, setZoomedImage] = useState<ZoomedImage | null>(null);

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
                links: {
                    onClick: event => {
                        event.preventDefault();

                        return true;
                    }
                },
                uploadFile: readOnly || !currentSelectedSpace ? undefined : getUploader(toast, t, currentSelectedSpace)
            },
            [readOnly, autofocus, currentSelectedSpace, dictionary, placeholder]
        );

        const getSlashMenuItems = useCallback(
            async (query: string) => {
                const hiddenSyntaxItem: DefaultReactSuggestionItem = {
                    title: t('Hidden Content'),
                    subtext: '$hidden[]',
                    aliases: ['hidden', 'secret', 'mask', 'desensitize', '脱敏', '隐藏', '敏感'],
                    group: t('Quka'),
                    icon: <EyeOff size={18} />,
                    onItemClick: () => insertHiddenSyntax(editor)
                };

                return filterSuggestionItems([hiddenSyntaxItem, ...getDefaultReactSlashMenuItems(editor)], query);
            },
            [editor, t]
        );

        const sideMenuFloatingOptions = useMemo(
            () => ({
                useFloatingOptions: {
                    placement: useMobileSideMenu ? ('bottom-start' as const) : ('left-start' as const),
                    middleware: useMobileSideMenu ? [offset(2)] : undefined
                },
                elementProps: {
                    className: cn('blocknote-editor-side-menu', useMobileSideMenu && 'blocknote-editor-side-menu--mobile')
                }
            }),
            [useMobileSideMenu]
        );

        useEffect(() => {
            editor.portalElement.classList.add('blocknote-editor-portal');
        }, [className, editor, theme]);

        useEffect(() => {
            return () => {
                if (zoomCloseTimeoutRef.current) {
                    clearTimeout(zoomCloseTimeoutRef.current);
                }

                if (zoomOpenTimeoutRef.current) {
                    clearTimeout(zoomOpenTimeoutRef.current);
                }

                dispatchBlockNoteImageZoomChange(false);
            };
        }, []);

        useEffect(() => {
            dispatchBlockNoteImageZoomChange(Boolean(zoomedImage?.isZoomed));
        }, [zoomedImage?.isZoomed]);

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
            update: (id, nextData) => {
                const block = editor.getBlock(id);

                if (block) {
                    editor.updateBlock(block, nextData as PartialBlock);
                }
            }
        }));

        const handleEditableLinkInteractionCapture = useCallback(
            (event: React.SyntheticEvent<HTMLDivElement>) => {
                const link = (event.target as HTMLElement | null)?.closest('a[href]');

                if (!readOnly && link) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            },
            [readOnly]
        );

        const handleEditorClickCapture = useCallback(
            (event: React.MouseEvent<HTMLDivElement>) => {
                handleEditableLinkInteractionCapture(event);

                if (!readOnly) {
                    return;
                }

                const image = findReadonlyImageFromEventTarget(event.target);
                if (!image?.src) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                if (zoomCloseTimeoutRef.current) {
                    clearTimeout(zoomCloseTimeoutRef.current);
                }

                if (zoomOpenTimeoutRef.current) {
                    clearTimeout(zoomOpenTimeoutRef.current);
                }

                setZoomedImage({
                    src: image.currentSrc || image.src,
                    alt: image.alt || '',
                    rect: image.getBoundingClientRect(),
                    isZoomed: false
                });

                zoomOpenTimeoutRef.current = setTimeout(() => {
                    setZoomedImage(current => (current ? { ...current, isZoomed: true } : current));
                }, 50);
            },
            [handleEditableLinkInteractionCapture, readOnly]
        );

        const handleZoomChange = useCallback((isZoomed: boolean) => {
            if (isZoomed) {
                setZoomedImage(current => (current ? { ...current, isZoomed: true } : current));

                return;
            }

            setZoomedImage(current => (current ? { ...current, isZoomed: false } : current));
            zoomCloseTimeoutRef.current = setTimeout(() => {
                setZoomedImage(null);
            }, 300);
        }, []);

        return (
            <div className={cn('blocknote-editor sm:mx-[60px]', readOnly && 'blocknote-editor--readonly', className)} onClickCapture={handleEditorClickCapture}>
                <BlockNoteView
                    editor={editor}
                    editable={!readOnly}
                    formattingToolbar={false}
                    sideMenu={false}
                    slashMenu={false}
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
                    {!readOnly && (useMobileSideMenu ? <MobileSideMenuController floatingUIOptions={sideMenuFloatingOptions} /> : <SideMenuController floatingUIOptions={sideMenuFloatingOptions} />)}
                    {!readOnly && <SuggestionMenuController triggerCharacter="/" getItems={getSlashMenuItems} />}
                    {!readOnly && <FormattingToolbarController formattingToolbar={BlockNoteFormattingToolbar} />}
                </BlockNoteView>
                {zoomedImage && (
                    <ControlledZoom
                        isZoomed={zoomedImage.isZoomed}
                        zoomImg={{
                            src: zoomedImage.src,
                            alt: zoomedImage.alt
                        }}
                        onZoomChange={handleZoomChange}
                    >
                        <img
                            src={zoomedImage.src}
                            alt={zoomedImage.alt}
                            className="blocknote-editor__zoom-source"
                            style={{
                                height: zoomedImage.rect.height,
                                left: zoomedImage.rect.left,
                                top: zoomedImage.rect.top,
                                width: zoomedImage.rect.width
                            }}
                        />
                    </ControlledZoom>
                )}
            </div>
        );
    })
);
