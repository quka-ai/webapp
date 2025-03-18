import { Badge, Button, cn, Image, Listbox, ListboxItem, Spinner, Switch, type TextAreaProps, Tooltip, useDisclosure } from '@heroui/react';
import { Icon } from '@iconify/react';
import { VisuallyHidden } from '@react-aria/visually-hidden';
import { t } from 'i18next';
import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSnapshot } from 'valtio';

import PromptInput from './prompt-input';

import { UploadResult, useUploader } from '@/hooks/use-uploader';
import spaceStore from '@/stores/space';

export default function Component(
    props: TextAreaProps & {
        classNames?: Record<'button' | 'buttonIcon', string>;
        selectedUseMemory: boolean;
        allowAttach: boolean;
        onSubmitFunc: (data: string, agent: string, files: Attach[]) => Promise<void>;
    }
) {
    const { t } = useTranslation();
    const [prompt, setPrompt] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    const [useRag, setUseRag] = useState(false);

    function setSelectedUseMemory(value: boolean) {
        setUseRag(value);
        localStorage.setItem('selectedUseMemory', value.toString());
    }

    useEffect(() => {
        setUseRag(props.selectedUseMemory === undefined ? localStorage.getItem('selectedUseMemory') === 'true' : props.selectedUseMemory);
    }, [props.selectedUseMemory]);

    // @ts-ignore
    const inputRef = useRef<any>();

    const handleKeyDown = async (event: KeyboardEvent) => {
        if (loading) {
            return;
        }
        // 阻止默认的提交行为
        if (event.key === 'Enter' && event.shiftKey) {
            event.preventDefault();
            // 获取当前光标位置
            const start = inputRef.current.selectionStart;
            const end = inputRef.current.selectionEnd;

            setPrompt(prompt.slice(0, start) + '\n' + prompt.slice(end));

            // 将光标移到新行
            inputRef.current.focus();
            inputRef.current.setSelectionRange(start + 1, start + 1);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const keyCode = event.which || event.keyCode;

            if (keyCode === 229) {
                // 触发中文输入法确认中文等回车行为
                return;
            }
            if (props.onSubmitFunc && prompt) {
                await submit();
            }
        }
    };

    const { isOpen, onOpen, onClose } = useDisclosure();
    function setSelectedKeys(e) {
        setPrompt(prompt + e + ' ');
        onClose();
        inputRef.current.focus();
    }

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                onClose();
                inputRef.current.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, inputRef]);

    const onSetPrompt = useCallback(
        (data: string) => {
            if (data.length < prompt.length) {
                setPrompt(data);
                return;
            }
            setPrompt(data);
            const lastChar = data.trim().charAt(data.length - 1);
            if (lastChar === '@') {
                onOpen();
            } else if (isOpen) {
                onClose();
            }
        },
        [isOpen, prompt]
    );

    const agents = useMemo(() => {
        return [
            {
                title: t('agent-butler'),
                description: t('AgentButlerDescription')
            },
            {
                title: t('agent-journal'),
                description: t('AgentJournalDescription')
            }
        ];
    }, []);

    const [assets, setAssets] = useState<string[]>([]);
    const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
        if (!props.allowAttach) {
            return;
        }
        const items = Array.from(e.clipboardData.items);

        for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
                const blob = item.getAsFile();

                if (!blob) continue;

                if (blob.size > 10 * 1024 * 1024) {
                    // 10MB
                    toast.error('File size exceeds the limit of 10MB');
                    continue;
                }
                setAssets(prev => [...prev, blob]);
            }
        }
    }, []);

    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (!props.allowAttach) {
            return;
        }
        const files = Array.from(e.target.files || []);

        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                if (file.size > 10 * 1024 * 1024) {
                    // 10MB
                    toast.error('File size exceeds the limit of 10MB');
                    return;
                }

                setAssets(prev => [...prev, file]);
            }
        });

        // Reset input value to allow uploading the same file again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const { uploader } = useUploader();
    const { currentSelectedSpace } = useSnapshot(spaceStore);
    const submit = useCallback(async () => {
        const files: Attach[] = [];
        if (assets && assets.length > 0) {
            try {
                const res: UploadResult[] = await new Promise((resolve, reject) => {
                    toast.promise(
                        Promise.all(
                            assets.map((file: File) => {
                                return uploader(currentSelectedSpace, file, 'chat', 'chat');
                            })
                        )
                            .then((values: UploadResult[]) => {
                                resolve(values);
                            })
                            .catch(err => {
                                console.log('got errr', err);
                                reject(err);
                            }),
                        {
                            loading: t(`Uploading`, { target: t('Attach') }),
                            success: (values: UploadResult[]) => {
                                resolve(values);
                                return t(`Success`);
                            },
                            error: err => {
                                reject(err);
                                return err;
                            }
                        }
                    );
                });

                res.forEach(v => {
                    files.push({
                        type: 'image',
                        url: v.file?.url
                    });
                });
            } catch (err: any) {
                console.error(err);
                return;
            }
        }

        setLoading(true);
        try {
            await props.onSubmitFunc(prompt, useRag ? 'rag' : '', files);
            setPrompt('');
            setAssets([]);
        } catch (e: any) {
            console.error(e);
        }
        setLoading(false);
    }, [prompt, useRag, assets, currentSelectedSpace]);

    return (
        <>
            {assets && assets.length > 0 && (
                <div className="group flex gap-2 px-2 mb-2">
                    <PromptInputAssets
                        assets={assets}
                        onRemoveAsset={index => {
                            setAssets(prev => prev.filter((_, i) => i !== index));
                        }}
                    />
                </div>
            )}

            <form className="flex flex-col w-full items-start gap-2 relative rounded-medium bg-default-100 transition-colors">
                {isOpen && (
                    <div className="absolute w-full left-0 top-0">
                        <Listbox
                            disallowEmptySelection
                            aria-label="Single agent selection"
                            className="absolute bottom-1 left-0 bg-content2 rounded-xl z-50"
                            autoFocus="first"
                            selectionMode="single"
                            variant="flat"
                            onAction={setSelectedKeys}
                        >
                            {agents.map(v => {
                                return (
                                    <ListboxItem key={v.title} className="h-12">
                                        {v.title} <span className="text-sm text-zinc-400">（{v.description}）</span>
                                    </ListboxItem>
                                );
                            })}
                        </Listbox>
                    </div>
                )}

                <PromptInput
                    {...props}
                    ref={inputRef}
                    classNames={{
                        inputWrapper: '!bg-transparent shadow-none',
                        innerWrapper: cn('items-center outline-0', props.classNames?.innerWrapper),
                        input: cn('text-medium pl-1 data-[has-start-content=true]:ps-0 data-[has-start-content=true]:pe-0', props.classNames?.input)
                    }}
                    endContent={
                        <div className="flex gap-2 pt-1">
                            {/* {!prompt && (
                            <Button isIconOnly radius="full" variant="light">
                                <Icon className="text-default-500" icon="solar:microphone-3-linear" width={20} />
                            </Button>
                        )} */}
                            <Tooltip showArrow content="Send message">
                                <Button
                                    isIconOnly
                                    className={props?.classNames?.button || ''}
                                    color={!prompt ? 'default' : 'primary'}
                                    isDisabled={!prompt}
                                    radius="full"
                                    variant={!prompt ? 'flat' : 'solid'}
                                    onPress={submit}
                                >
                                    {loading ? (
                                        <Spinner />
                                    ) : (
                                        <Icon
                                            className={cn('[&>path]:stroke-[2px]', !prompt ? 'text-default-500' : 'text-primary-foreground', props?.classNames?.buttonIcon || '')}
                                            icon="solar:arrow-up-linear"
                                            width={20}
                                        />
                                    )}
                                </Button>
                            </Tooltip>
                        </div>
                    }
                    // startContent={
                    //     <Button isIconOnly className="p-[10px]" radius="full" variant="light">
                    //         <Icon className="text-default-500" icon="solar:paperclip-linear" width={20} />
                    //     </Button>
                    // }
                    value={prompt}
                    onValueChange={onSetPrompt}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                />
                <div className="flex w-full flex-wrap items-center justify-between gap-2 px-3 pb-2">
                    <div className="flex flex-wrap gap-3">
                        {/* <Button size="sm" startContent={<Icon className="text-default-500" icon="solar:paperclip-linear" width={18} />} variant="flat">
                        Attach
                    </Button> */}
                        {props.allowAttach && (
                            <Tooltip showArrow content="Attach Files">
                                <Button isIconOnly radius="full" size="sm" variant="light" onPress={() => fileInputRef.current?.click()}>
                                    <Icon className="text-default-500" icon="solar:paperclip-outline" width={24} />
                                    <VisuallyHidden>
                                        <input ref={fileInputRef} multiple accept="image/*" type="file" onChange={handleFileUpload} />
                                    </VisuallyHidden>
                                </Button>
                            </Tooltip>
                        )}

                        {/* <Button size="sm" startContent={<Icon className="text-default-500" icon="solar:notes-linear" width={18} />} variant="flat">
                        Templates
                    </Button> */}
                    </div>
                    <div className="flex flex-row justify-end items-end gap-4">
                        <Switch
                            classNames={{
                                base: cn(
                                    'inline-flex flex-row-reverse hover:bg-content2 items-center bg-default-100',
                                    'justify-between cursor-pointer rounded-lg gap-2 pl-1 pr-2 border-2 border-transparent',
                                    'border-default h-8'
                                ),
                                wrapper: 'p-0 h-4 w-10 overflow-visible'
                            }}
                            isSelected={useRag}
                            onValueChange={setSelectedUseMemory}
                        >
                            <div className="flex flex-col gap-1">
                                <p className="text-sm text-default-500">{t('UseMemory')}</p>
                            </div>
                        </Switch>
                        <p className="py-1 text-tiny text-default-400 w-16 justify-end flex">{prompt.length}/2000</p>
                    </div>
                </div>
            </form>
        </>
    );
}

interface PromptInputAssetsProps {
    assets: File[];
    onRemoveAsset: (index: number) => void;
}

const PromptInputAssets = ({ assets, onRemoveAsset }: PromptInputAssetsProps) => {
    if (assets.length === 0) return null;

    const [previewList, setPreviewList] = useState<string[]>([]);
    useEffect(() => {
        Promise.all(
            assets.map((file, index) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const base64data = reader.result as string;
                        resolve(base64data);
                    };
                    reader.readAsDataURL(file);
                });
            })
        ).then((values: string[]) => {
            setPreviewList(values);
        });
    }, [assets]);

    return (
        <>
            {previewList.map((previewBase64, index) => {
                return (
                    <Badge
                        key={index}
                        isOneChar
                        className="opacity-0 group-hover:opacity-100"
                        content={
                            <Button isIconOnly radius="full" size="sm" variant="light" onPress={() => onRemoveAsset(index)}>
                                <Icon className="text-foreground" icon="iconamoon:close-thin" width={16} />
                            </Button>
                        }
                    >
                        <Image alt="uploaded image" className="h-24 w-24 rounded-small border-small border-default-200/50 object-cover" src={previewBase64} />
                    </Badge>
                );
            })}
        </>
    );
};
