import {
    BreadcrumbItem,
    Breadcrumbs,
    Button,
    ButtonGroup,
    Card,
    CardHeader,
    Code,
    Divider,
    Image,
    Input,
    Kbd,
    Link,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    Select,
    Textarea,
    useDisclosure
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSnapshot } from 'valtio';

import { TaskList } from './create';
import { FilePreview, FileUploader } from './file-uploader';
import KnowledgeEdit from './knowledge-edit';

import { CreateFileChunkTask } from '@/apis/chunk-task';
import { CreateKnowledge } from '@/apis/knowledge';
import { Reader } from '@/apis/tools';
import { useMedia } from '@/hooks/use-media';
import { usePlan } from '@/hooks/use-plan';
import { useUploader } from '@/hooks/use-uploader';
import knowledge from '@/pages/share/knowledge';
import resourceStore from '@/stores/resource';
import spaceStore from '@/stores/space';

export interface WorkBarProps {
    spaceid: string;
    onSubmit?: () => void;
    isShowCreate?: boolean;
    onShowChange?: (isShow: boolean) => void;
}

const WorkBar = memo(function WorkBar({ spaceid, onSubmit, isShowCreate, onShowChange }: WorkBarProps) {
    const { t } = useTranslation();

    const { currentSelectedSpace } = useSnapshot(spaceStore);
    const { currentSelectedResource } = useSnapshot(resourceStore);
    const { userIsPro } = usePlan();
    const { isMobile } = useMedia();
    const navigate = useNavigate();

    const createToResource = useMemo(() => {
        if (currentSelectedResource && currentSelectedResource.id !== '') {
            return {
                id: currentSelectedResource.id,
                title: currentSelectedResource.title
            };
        }
        return {
            id: 'knowledge',
            title: t('resourceKnowledge')
        };
    }, [currentSelectedResource]);

    const [knowledgeContent, setKnowledgeContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const createKnowledge = useCallback(async () => {
        if (!userIsPro) {
            // TODO alert upgrade plan
            return;
        }
        if (knowledgeContent === '') {
            toast.error(t('Error'), {
                description: 'Knowledge content is empty'
            });

            return;
        }

        setIsLoading(true);
        try {
            await CreateKnowledge(currentSelectedSpace, createToResource?.id, knowledgeContent, 'markdown');
            setKnowledgeContent('');
            toast.success(t('Success'));
            if (onSubmit) {
                onSubmit();
            }
        } catch (e: any) {
            console.error(e);
        }
        setIsLoading(false);
    }, [knowledgeContent, currentSelectedSpace, createToResource, userIsPro]);

    const [readEndpoint, setReadEndpoint] = useState('');
    const [readLoading, setReadLoading] = useState(false);
    const reader = useCallback(
        async e => {
            e.preventDefault(); // 阻止表单默认刷新行为
            setReadLoading(true);
            try {
                const resp = await Reader(readEndpoint);
                if (resp.warning && resp.warning.length > 0) {
                    setKnowledgeContent(resp.warning);
                } else {
                    setKnowledgeContent([resp.url, resp.title, resp.description, resp.content].join('\n\n'));
                }
                setReadEndpoint('');
            } catch (e: any) {
                console.error(e);
            }
            setReadLoading(false);
        },
        [readEndpoint]
    );

    const knowledgeModal = useRef<{ show: ({ space_id: string }) => void }>(null);
    const [knowledgeIsShow, setKnowledgeIsShow] = useState(false);
    const showCreate = useCallback(() => {
        if (knowledgeModal && knowledgeModal.current) {
            knowledgeModal.current.show({
                space_id: currentSelectedSpace
            });
            setKnowledgeIsShow(true);
            onShowChange(true);
        }
    }, [knowledgeModal, currentSelectedSpace]);

    useEffect(() => {
        if (knowledgeModal && knowledgeModal.current && isShowCreate) {
            knowledgeModal.current.show({
                space_id: currentSelectedSpace
            });
            setKnowledgeIsShow(true);
        }
    }, [isShowCreate, knowledgeModal]);

    useEffect(() => {
        if (isMobile) {
            return;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (knowledgeIsShow) {
                return;
            }
            // meta + b = create knowledge
            if (event.key === 'b' && event.metaKey) {
                showCreate();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isMobile, currentSelectedSpace]);

    return (
        <div className="w-full flex flex-col gap-2 py-6 ">
            <div className="flex md:flex-row flex-col px-6 mb-2 w-full  items-center gap-4">
                <div className="text-2xl font-bold leading-9 text-default-foreground">🤯 {t('WorkSpace')}</div>
                <Code className="text-sm text-default-500">{t('CurrentResourceType', { type: createToResource.title })}</Code>
            </div>
            <div className="flex lg:flex-row flex-col flex-wrap gap-4 px-6">
                <div className="flex flex-col lg:w-1/2 w-full h-[200px]">
                    <Textarea
                        isClearable
                        variant="bordered"
                        placeholder={t('TypeKnowledgeByYourSelf')}
                        onValueChange={setKnowledgeContent}
                        value={knowledgeContent}
                        startContent={
                            <>
                                {!knowledgeContent && (
                                    <form onSubmit={reader}>
                                        <div className="absolute bottom-2 left-2 flex gap-2 w-5/6">
                                            <Input variant="faded" className="w-full" value={readEndpoint} onValueChange={setReadEndpoint} size="sm" placeholder={t('ReadWebContentFromURL')} />
                                            <Button variant="faded" size="sm" type="submit" isLoading={readLoading}>
                                                {t('Read')}
                                            </Button>
                                        </div>
                                    </form>
                                )}
                            </>
                        }
                        endContent={
                            <>
                                {knowledgeContent ? (
                                    <div className="absolute bottom-2 right-2">
                                        <Button variant="faded" size="sm" isLoading={isLoading} onPress={createKnowledge}>
                                            {t('Submit')}
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="absolute top-2 right-2">
                                            <Button
                                                variant="faded"
                                                size="sm"
                                                isLoading={isLoading}
                                                onPress={e => {
                                                    if (isMobile) {
                                                        navigate(`/dashboard/${currentSelectedSpace}/knowledge/create`);
                                                    } else {
                                                        showCreate();
                                                    }
                                                }}
                                                endContent={<Kbd keys={['command']}>B</Kbd>}
                                            >
                                                🤔 {t('OpenRichText')}
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </>
                        }
                        minRows={8}
                    />
                    <div className="flex w-full items-center justify-end gap-2 p-1">
                        <Icon className="text-default-400 dark:text-default-300" icon="la:markdown" width={20} />
                        <p className="text-tiny text-default-400 dark:text-default-300">
                            <Link className="text-tiny text-default-500" color="foreground" href="https://guides.github.com/features/mastering-markdown/" rel="noreferrer" target="_blank">
                                Markdown
                                <Icon className="[&>path]:stroke-[2px]" icon="solar:arrow-right-up-linear" />
                            </Link>
                            &nbsp;supported.
                        </p>
                    </div>

                    <CreateKnowledgeModal
                        ref={knowledgeModal}
                        onChange={onSubmit}
                        onClose={() => {
                            setKnowledgeIsShow(false);
                            onShowChange(false);
                        }}
                    />
                </div>
                <div className="w-full flex-1 relative">
                    <FileTask />
                </div>
            </div>
        </div>
    );
});

export default WorkBar;

const FileTask = memo(() => {
    const { t } = useTranslation();
    function init() {
        setChunkFile({});
        setFileMeta('');
    }

    const { currentSelectedSpace } = useSnapshot(spaceStore);
    const { currentSelectedResource } = useSnapshot(resourceStore);

    const [chunkFile, setChunkFile] = useState<{ name: string; url: string; file: File }>({});
    const [fileMeta, setFileMeta] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    async function createChunkTask() {
        if (!userIsPro) {
            // TODO alert upgrade plan
            return;
        }
        if (chunkFile.url !== '') {
            setIsLoading(true);
            try {
                await CreateFileChunkTask(currentSelectedSpace, fileMeta, currentSelectedResource?.id, chunkFile.name, chunkFile.url);
                toast.success(t('fileMemoryTaskCreated'));
                init();
            } catch (e: any) {
                console.error(e);
            }
            setIsLoading(false);
            return;
        }
    }

    const { uploader } = useUploader();

    const { isMobile } = useMedia();
    const [isShowTaskList, setIsShowTaskList] = useState(false);
    const { userIsPro, isPlatform } = usePlan();

    if (!isPlatform) {
        return <></>;
    }

    return (
        <>
            {!chunkFile.url && (
                <Button className="absolute right-2 top-2 z-50" variant="faded" size="sm" onPress={() => setIsShowTaskList(true)}>
                    {t('TaskList')}
                </Button>
            )}

            <TaskList spaceID={currentSelectedSpace} isShow={isShowTaskList} onClose={() => setIsShowTaskList(false)} />
            {!chunkFile.url ? (
                <>
                    <FileUploader
                        className="border-zinc-600 h-[180px] rounded-xl"
                        accept={{
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [],
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [],
                            'application/pdf': []
                        }}
                        onValueChange={e => {
                            console.log(e);
                            return false;
                        }}
                        onUpload={async f => {
                            if (f.length === 0) {
                                return;
                            }
                            const resp = await uploader(currentSelectedSpace, f[0], 'knowledge', 'chunk');
                            if (resp.success) {
                                setChunkFile({
                                    name: resp.file?.name,
                                    url: resp.file?.url,
                                    file: f[0]
                                });
                            }
                        }}
                        disabled={!userIsPro || !currentSelectedResource || !currentSelectedResource.id}
                    />
                    <div className="flex w-full items-center justify-start gap-2 p-1">
                        <p className="text-tiny text-default-300 dark:text-default-500">
                            {!currentSelectedResource ||
                                (!currentSelectedResource.id && (
                                    <span className=" text-red-500">
                                        ⚠️{t('FileUploadMustChooseAResource')}
                                        <br />
                                    </span>
                                ))}

                            {t('FileUploadSuggestToANewResource')}
                        </p>
                    </div>
                </>
            ) : (
                <>
                    <span className="text-white my-2">{t('AIAutoChunkDescription')}</span>
                    <FilePreview
                        file={chunkFile.file}
                        onRemove={() => {
                            setChunkFile({});
                        }}
                    />
                    <Divider className="my-2" />
                    <Textarea
                        variant="faded"
                        maxLength={100}
                        endContent={
                            <>
                                {fileMeta && (
                                    <div className="absolute bottom-2 right-2">
                                        <Button
                                            className="mt-1 text-white bg-gradient-to-br from-pink-300 from-15%  to-indigo-600 dark:from-indigo-500 dark:to-pink-500"
                                            isLoading={isLoading}
                                            isDisabled={!chunkFile.url}
                                            onPress={createChunkTask}
                                        >
                                            {t('Submit')}
                                        </Button>
                                    </div>
                                )}
                            </>
                        }
                        labelPlacement="outside"
                        label={t('Brief')}
                        placeholder={t('FileDescriptionTip')}
                        value={fileMeta}
                        onValueChange={setFileMeta}
                    />
                </>
            )}
        </>
    );
});

interface CreateKnowledgeModalProps {
    onClose: () => void;
    onChange: () => void;
}

const CreateKnowledgeModal = memo(
    forwardRef((props: CreateKnowledgeModalProps, ref: any) => {
        const { t } = useTranslation();
        const { isOpen, onOpen, onClose } = useDisclosure();
        const [knowledge, setKnowledge] = useState<Knowledge>();
        const [size, setSize] = useState<Size>('md');
        const isMobile = useMedia();
        const { currentSelectedSpace } = useSnapshot(spaceStore);

        const onChangeFunc = useCallback(() => {
            props.onChange && props.onChange();
            onCancelFunc();
        }, [props.onChange]);

        useEffect(() => {
            if (isMobile) {
                setSize('full');
            } else {
                // TODO maybe
                // setSize('3xl');
                setSize('full');
            }
        }, [isMobile]);

        function show(knowledge: Knowledge) {
            setKnowledge(knowledge);
            onOpen();
        }

        const { spaces } = useSnapshot(spaceStore);
        const spaceTitle = useMemo(() => {
            let currentSpaceID = currentSelectedSpace;
            if (knowledge && knowledge.space_id) {
                currentSpaceID = knowledge.space_id;
            }
            for (const item of spaces) {
                if (item.space_id === currentSpaceID) {
                    return item.title;
                }
            }

            return '';
        }, [spaces, knowledge, currentSelectedSpace]);

        const onCancelFunc = useCallback(
            function () {
                props.onClose && props.onClose();
                onClose();
            },
            [props.onClose]
        );

        useImperativeHandle(ref, () => {
            return {
                show
            };
        });

        const editor = useRef();
        const [createLoading, setCreateLoading] = useState(false);
        const submit = useCallback(async () => {
            try {
                setCreateLoading(true);
                await editor.current.submit();
            } catch (e: any) {
                console.error(e);
            }
            setCreateLoading(false);
        }, [editor]);

        return (
            <>
                <Modal backdrop="blur" placement="bottom" scrollBehavior="inside" size={size} isOpen={isOpen} isKeyboardDismissDisabled={true} onClose={onCancelFunc}>
                    <ModalContent>
                        {onClose => (
                            <>
                                <ModalHeader className="flex flex-col gap-1 dark:text-gray-100 text-gray-800">
                                    <Breadcrumbs>
                                        <BreadcrumbItem onClick={onClose}>{t('Home')}</BreadcrumbItem>
                                        <BreadcrumbItem onClick={onClose}>{spaceTitle === 'Main' ? t('MainSpace') : spaceTitle}</BreadcrumbItem>
                                        <BreadcrumbItem>{t('Create')}</BreadcrumbItem>
                                    </Breadcrumbs>
                                </ModalHeader>
                                <ModalBody className="w-full flex flex-col items-center">
                                    <KnowledgeEdit ref={editor} classNames={{ editor: '!mx-0' }} knowledge={knowledge} hideSubmit onChange={onChangeFunc} onCancel={onCancelFunc} />
                                </ModalBody>
                                <ModalFooter className="flex justify-center">
                                    <ButtonGroup variant="flat" size="base" className="mb-4">
                                        <Button color="primary" onPress={submit} isLoading={createLoading}>
                                            {t('Save')}
                                        </Button>
                                        <Button onPress={onClose}>{t('Close')}</Button>
                                    </ButtonGroup>
                                </ModalFooter>
                            </>
                        )}
                    </ModalContent>
                </Modal>
            </>
        );
    })
);

CreateKnowledgeModal.displayName = 'createKnowledgeModal';
