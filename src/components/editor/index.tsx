import Delimiter from '@coolbytes/editorjs-delimiter';
import CodeTool from '@editorjs/code';
import EditorJS, { BlockToolData, OutputBlockData, OutputData } from '@editorjs/editorjs';
import Header from '@editorjs/header';
import InlineCode from '@editorjs/inline-code';
import EditorjsList from '@editorjs/list';
import Marker from '@editorjs/marker';
import Quote from '@editorjs/quote';
import Table from '@editorjs/table';
import { Skeleton } from '@heroui/react';
import { forwardRef, memo, useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import showdown from 'showdown';
import { useSnapshot } from 'valtio';

import CustomImage from './image-tool';
import './style.css';

import { CreateUploadKey, UploadFileToKey } from '@/apis/upload';
import Video from '@/components/editor/video-component/video-tool';
import { useToast } from '@/hooks/use-toast';
import { compressImage } from '@/lib/compress';
import { cn, randomString } from '@/lib/utils';
import spaceStore from '@/stores/space';

function getUploader(toast: (d: ToastProps) => void, t: (d: string) => string, currentSelectedSpace: string) {
    return {
        async uploadByFile(file: File): { success: number; file?: { url: string } } {
            try {
                let result: CompressResult = {};
                let fileKind = '';

                if (file.type.startsWith('image')) {
                    result = await compressImage(file);
                    if (result.success) {
                        file = result.file;
                    }
                    fileKind = 'image';
                } else if (file.type.startsWith('video')) {
                    fileKind = 'video';
                }

                if (result.error) {
                    toast({
                        title: t('Error'),
                        // TODO: i18n
                        description: result.error
                    });

                    return {
                        success: 0
                    };
                }

                const resp = await CreateUploadKey(currentSelectedSpace, 'knowledge', fileKind, file.name, file.size);

                if (resp.status === 'exist') {
                    return {
                        success: 1,
                        file: {
                            url: resp.url
                        }
                    };
                }

                await UploadFileToKey(resp.key, file.type, result.file || file);

                return {
                    success: 1,
                    file: {
                        type: fileKind,
                        url: resp.url
                    }
                };
            } catch (e: Error) {
                toast({
                    title: t('Error'),
                    // TODO: i18n
                    description: e.message || e
                });
            }
        }
    };
}

export interface EditorProps {
    readOnly: boolean;
    data: string | OutputData;
    dataType?: string;
    placeholder?: string;
    autofocus?: boolean;
    className?: string;
    onValueChange?: () => void;
}

export const Editor = memo(
    forwardRef(({ data, dataType = '', autofocus = false, placeholder, readOnly, className, onValueChange }: EditorProps, ref: any) => {
        const { t } = useTranslation();
        const [isReady, setIsReady] = useState(false);
        const { toast } = useToast();
        const { currentSelectedSpace } = useSnapshot(spaceStore);
        // console.log('editor data', data, dataType);
        const [editor, setEditor] = useState<EditorJS>();

        const [randomID, setRandomID] = useState(randomString(6));

        useEffect(() => {
            if (!readOnly && currentSelectedSpace === '') {
                return;
            }
            const renderFunc = async function (editor: EditorJS, data: string | OutputData, dataType: string) {
                if (!data) {
                    return;
                }
                switch (dataType.toLowerCase()) {
                    case 'html':
                        await editor.blocks.renderFromHTML(data);
                        break;
                    case 'blocks':
                        await editor.blocks.render(data);
                        break;
                    default: // default will be markdown
                        if (data && data.split('\n').length === 1) {
                            data = {
                                blocks: [
                                    {
                                        type: 'paragraph',
                                        data: {
                                            text: data
                                        }
                                    }
                                ]
                            };
                            await editor.blocks.render(data);

                            return;
                        }
                        showdown.extension('code', function () {
                            return [
                                {
                                    type: 'output',
                                    filter: function (text, converter, options) {
                                        return text.replace(/<pre(?: class="[^"]*")?>([\s\S]+?)<\/pre>/g, function (fullMatch, inCode) {
                                            return '<code contenteditable="true">' + inCode + '</code>';
                                        });
                                    }
                                }
                            ];
                        });

                        const converter = new showdown.Converter({ extensions: ['code'] });
                        let htmlDoms = converter.makeHtml(data);

                        if (!htmlDoms.trim().startsWith('<div>')) {
                            htmlDoms = '<div>' + htmlDoms + '</div>';
                        }

                        try {
                            await editor.blocks.renderFromHTML(htmlDoms);
                        } catch (e: any) {
                            console.error('editor render error', e);
                            await editor.render([
                                {
                                    type: 'paragraph',
                                    data: { text: data || '' }
                                }
                            ]);
                        }
                }
            };

            const editor = new EditorJS({
                minHeight: 360, // https://github.com/codex-team/editor.js/issues/1300
                placeholder: placeholder,
                readOnly: readOnly,
                autofocus: !readOnly && autofocus,
                i18n: {
                    messages: {
                        ui: {
                            blockTunes: {
                                toggler: {
                                    'Click to tune': t('Click to tune'),
                                    'or drag to move': t('or drag to move')
                                }
                            },
                            inlineToolbar: {
                                converter: {
                                    'Convert to': t('Convert to')
                                }
                            },
                            toolbar: {
                                toolbox: {
                                    Add: t('Add')
                                }
                            },
                            popover: {
                                Filter: t('Filter'),
                                'Nothing found': t('Nothing found'),
                                'Convert to': t('Convert to')
                            }
                        },
                        toolNames: {
                            Text: t('Text'),
                            Heading: t('Heading'),
                            Link: t('Link'),
                            Bold: t('Bold'),
                            Italic: t('Italic'),
                            Marker: t('Marker'),
                            InlineCode: t('InlineCode'),
                            Image: t('Image'),
                            Video: t('Video'),
                            'Ordered List': t('Ordered List'),
                            'Unordered List': t('Unordered List'),
                            Checklist: t('Checklist'),
                            Quote: t('Quote'),
                            Delimiter: t('Delimiter'),
                            Code: t('Code'),
                            Table: t('Table')
                        },
                        tools: {
                            link: {
                                'Add a link': t('Add a link')
                            },
                            stub: {
                                'The block can not be displayed correctly.': t('The block can not be displayed correctly.')
                            },
                            header: {
                                'Heading 1': t('Heading') + '1',
                                'Heading 2': t('Heading') + '2',
                                'Heading 3': t('Heading') + '3',
                                'Heading 4': t('Heading') + '4',
                                'Heading 5': t('Heading') + '5',
                                'Heading 6': t('Heading') + '6'
                            },
                            image: {
                                'With background': t('WithBackground')
                            },
                            video: {
                                'With background': t('WithBackground')
                            }
                        },
                        blockTunes: {
                            delete: {
                                Delete: t('Delete'),
                                'Click to delete': t('Confirm')
                            },
                            moveUp: {
                                'Move up': t('Move up')
                            },
                            moveDown: {
                                'Move down': t('Move down')
                            }
                        }
                    }
                },
                /**
                 * Id of Element that should contain the Editor
                 */
                holder: 'brew-editor-' + randomID,
                tools: {
                    /**
                     * Each Tool is a Plugin. Pass them via 'class' option with necessary settings {@link docs/tools.md}
                     */
                    header: {
                        class: Header,
                        inlineToolbar: ['marker', 'link'],
                        config: {
                            placeholder: t('Header'),
                            levels: [1, 2, 3, 4],
                            defaultLevel: 2
                        },
                        shortcut: 'CMD+SHIFT+H'
                    },
                    /**
                     * Or pass class directly without any configuration
                     */
                    image: {
                        class: CustomImage,
                        config: {
                            types: 'image/*',
                            features: {
                                border: false,
                                stretch: false
                            },
                            actions: [
                                {
                                    name: 'aiGenImageDescript',
                                    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                        <g fill="none">
                                            <path d="m12.594 23.258l-.012.002l-.071.035l-.02.004l-.014-.004l-.071-.036q-.016-.004-.024.006l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.016-.018m.264-.113l-.014.002l-.184.093l-.01.01l-.003.011l.018.43l.005.012l.008.008l.201.092q.019.005.029-.008l.004-.014l-.034-.614q-.005-.019-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.003-.011l.018-.43l-.003-.012l-.01-.01z" />

                                            <path
                                                fill="currentColor"
                                                d="M9.107 5.448c.598-1.75 3.016-1.803 3.725-.159l.06.16l.807 2.36a4 4 0 0 0 2.276 2.411l.217.081l2.36.806c1.75.598 1.803 3.016.16 3.725l-.16.06l-2.36.807a4 4 0 0 0-2.412 2.276l-.081.216l-.806 2.361c-.598 1.75-3.016 1.803-3.724.16l-.062-.16l-.806-2.36a4 4 0 0 0-2.276-2.412l-.216-.081l-2.36-.806c-1.751-.598-1.804-3.016-.16-3.724l.16-.062l2.36-.806A4 4 0 0 0 8.22 8.025l.081-.216zM11 6.094l-.806 2.36a6 6 0 0 1-3.49 3.649l-.25.091l-2.36.806l2.36.806a6 6 0 0 1 3.649 3.49l.091.25l.806 2.36l.806-2.36a6 6 0 0 1 3.49-3.649l.25-.09l2.36-.807l-2.36-.806a6 6 0 0 1-3.649-3.49l-.09-.25zM19 2a1 1 0 0 1 .898.56l.048.117l.35 1.026l1.027.35a1 1 0 0 1 .118 1.845l-.118.048l-1.026.35l-.35 1.027a1 1 0 0 1-1.845.117l-.048-.117l-.35-1.026l-1.027-.35a1 1 0 0 1-.118-1.845l.118-.048l1.026-.35l.35-1.027A1 1 0 0 1 19 2"
                                            />
                                        </g>
                                    </svg>`,
                                    title: t('AI Description')
                                }
                            ],
                            uploader: getUploader(toast, t, currentSelectedSpace)
                        }
                    },
                    video: {
                        class: Video,
                        config: {
                            types: 'video/*',
                            features: {
                                border: false,
                                stretch: false
                            },
                            uploader: getUploader(toast, t, currentSelectedSpace)
                        }
                    },
                    listv2: {
                        // include check list
                        class: EditorjsList,
                        inlineToolbar: true,
                        shortcut: 'CMD+SHIFT+L'
                    },
                    quote: {
                        class: Quote,
                        inlineToolbar: true,
                        config: {
                            quotePlaceholder: 'Enter a quote',
                            captionPlaceholder: "Quote's author"
                        },
                        shortcut: 'CMD+SHIFT+O'
                    },
                    delimiter: {
                        class: Delimiter,
                        config: {
                            styleSptions: ['line'],
                            defaultStyle: 'line',
                            lineWidthOptions: [25, 50, 60, 100],
                            defaultLineWidth: 60,
                            defaultLineThickness: 1
                        }
                    },
                    marker: {
                        class: Marker,
                        shortcut: 'CMD+SHIFT+M'
                    },
                    codeBox: {
                        class: CodeTool,
                        inlineToolbar: true,
                        shortcut: 'CMD+SHIFT+C',
                        conversionConfig: {
                            import(str: string): string {
                                return str;
                            },
                            export(data): string {
                                return data.code;
                            }
                        }
                    },
                    inlineCode: {
                        class: InlineCode,
                        inlineToolbar: true
                    },
                    // link: LinkTool, import LinkTool from '@editorjs/link';
                    table: {
                        class: Table,
                        inlineToolbar: true,
                        shortcut: 'CMD+ALT+T'
                    }
                },
                // or await editor.isReady
                onReady: async () => {
                    setIsReady(() => true);
                    await renderFunc(editor, data, dataType);
                },
                onChange: async function (api, _) {
                    onValueChange && onValueChange(await api.saver.save());
                }
            });

            setEditor(editor);

            return () => {
                editor && editor.destroy();
            };
        }, [currentSelectedSpace]);

        async function reRender(data: OutputData) {
            await editor.blocks.render(data);
        }

        async function update(id: string, data: BlockToolData) {
            await editor.blocks.update(id, data);
        }

        useImperativeHandle(ref, () => {
            return {
                reRender,
                update
            };
        });

        return (
            //     <Skeleton isLoaded={isReady}>
            // </Skeleton>
            <div id={'brew-editor-' + randomID} className={cn('editor lg:mx-[60px]', className)} />
        );
    })
);
