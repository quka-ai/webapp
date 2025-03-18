import {
    Button,
    Card,
    CardBody,
    CardFooter,
    type CardProps,
    Chip,
    cn,
    Divider,
    Link,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Select,
    SelectItem,
    SelectSection,
    Spinner,
    Table,
    TableBody,
    TableCell,
    TableColumn,
    TableHeader,
    TableRow,
    Textarea,
    User
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useImmer } from 'use-immer';
import { useSnapshot } from 'valtio';

import { ChunkTask, CreateFileChunkTask, DeleteTask, GetTaskList, LoadTasksStatus } from '@/apis/chunk-task';
import { CreateKnowledge } from '@/apis/knowledge';
import { FilePreview, FileUploader } from '@/components/file-uploader';
import { useMedia } from '@/hooks/use-media';
import { usePlan } from '@/hooks/use-plan';
import { useGroupedResources } from '@/hooks/use-resource';
import { useUploader } from '@/hooks/use-uploader';
import resourceStore from '@/stores/resource';
import spaceStore from '@/stores/space';

export default memo(function Component(props: CardProps & { onChanges: () => void; openCreateKnowledge: () => void }) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [knowledge, setKnowledge] = useState<string>('');

    const [isInvalid, setInvalid] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const { currentSpaceResources, currentSelectedResource } = useSnapshot(resourceStore);
    const { currentSelectedSpace } = useSnapshot(spaceStore);

    const { groupedResources } = useGroupedResources();

    const defaultResource = useMemo(() => {
        if (currentSelectedResource && currentSelectedResource.id) {
            return currentSelectedResource.id;
        }

        if (groupedResources.length > 0 && groupedResources[0].items.length > 0) {
            return groupedResources[0].items[0].id;
        }

        return '';
    }, [groupedResources, currentSelectedResource]);
    const [resource, setResource] = useState('');
    const [fileMeta, setFileMeta] = useState('');

    const onKnowledgeContentChanged = useCallback((value: string) => {
        if (isInvalid) {
            setErrorMessage('');
            setInvalid(false);
        }
        setKnowledge(value);
    }, []);

    function init() {
        setChunkFile({});
        setFileMeta('');
        setResource('');
    }

    async function createChunkTask() {
        if (!userIsPro) {
            // TODO alert upgrade plan
            return;
        }
        if (chunkFile.url !== '') {
            setLoading(true);
            try {
                await CreateFileChunkTask(currentSelectedSpace, fileMeta, resource || defaultResource, chunkFile.name, chunkFile.url);
                toast.info(t('fileMemoryTaskCreated'));
                init();
            } catch (e: any) {
                console.error(e);
            }
            setLoading(false);
            return;
        }
    }

    const { uploader } = useUploader();
    const [chunkFile, setChunkFile] = useState<{ name: string; url: string; file: File }>({});
    const navigate = useNavigate();
    const { isMobile } = useMedia();
    const [isShowTaskList, setIsShowTaskList] = useState(false);
    const { userIsPro, isPlatform } = usePlan();

    const content = isOpen ? (
        <div className="h-full w-full items-start justify-center box-border overflow-scroll pb-10 pt-10">
            <div className="flex flex-col gap-2">
                <form className="flex w-full flex-col gap-2">
                    {!chunkFile.url && (
                        <Button
                            variant="ghost"
                            size="lg"
                            onPress={() => {
                                if (isMobile) {
                                    navigate(`/dashboard/${currentSelectedSpace}/knowledge/create`);
                                } else if (props.openCreateKnowledge) {
                                    props.openCreateKnowledge();
                                }
                            }}
                        >
                            {t('TypeMemorySelf')}
                        </Button>
                    )}
                    {isPlatform && (
                        <>
                            {!chunkFile.url && !knowledge && (
                                <div className="mt-1 flex w-full items-center justify-center gap-2 px-1 text-sm">
                                    {t('OR')}&nbsp;
                                    {t('UseDocs', { types: 'doc(x)、xls(x)、pdf' })}
                                </div>
                            )}

                            {!knowledge && (
                                <>
                                    <div className="flex justify-end px-1">
                                        <Button
                                            className="w-1/5"
                                            variant="ghost"
                                            size="sm"
                                            onPress={() => {
                                                setIsShowTaskList(true);
                                            }}
                                        >
                                            {t('TaskList')}
                                        </Button>
                                        <TaskList
                                            spaceID={currentSelectedSpace}
                                            isShow={isShowTaskList}
                                            onClose={() => {
                                                setIsShowTaskList(false);
                                            }}
                                        />
                                    </div>
                                    {!chunkFile.url ? (
                                        <FileUploader
                                            className="border-zinc-600"
                                            accept={{
                                                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [],
                                                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [],
                                                'application/pdf': []
                                            }}
                                            onValueChange={e => {
                                                console.log(e);
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
                                            disabled={!userIsPro}
                                        />
                                    ) : (
                                        <>
                                            <span className="text-white my-2">{t('AIAutoChunkDescription')}</span>
                                            <FilePreview
                                                file={chunkFile.file}
                                                onRemove={() => {
                                                    setChunkFile({});
                                                }}
                                            />
                                        </>
                                    )}
                                </>
                            )}

                            <Divider className="my-2" />
                            <Textarea variant="faded" maxLength={100} labelPlacement="outside" label="简介" placeholder="提供简介可以让检索效果更优秀" onValueChange={setFileMeta} />

                            {defaultResource && (
                                <Select
                                    isRequired
                                    variant="faded"
                                    label={t('knowledgeCreateResourceLable')}
                                    defaultSelectedKeys={[defaultResource]}
                                    labelPlacement="outside"
                                    placeholder="Select an resource"
                                    className="w-full my-2"
                                    onSelectionChange={item => {
                                        if (item) {
                                            setResource(item.currentKey || '');
                                        }
                                    }}
                                >
                                    {groupedResources.map(item => {
                                        return (
                                            <SelectSection showDivider key={item.title} title={t(item.title)}>
                                                {item.items.map(v => {
                                                    return <SelectItem key={v.id}>{v.title}</SelectItem>;
                                                })}
                                            </SelectSection>
                                        );
                                    })}
                                </Select>
                            )}
                            <Button
                                className="mt-1 text-white bg-gradient-to-br from-pink-300 from-15%  to-indigo-600 dark:from-indigo-500 dark:to-pink-500"
                                isLoading={loading}
                                isDisabled={!chunkFile.url}
                                onPress={createChunkTask}
                            >
                                {t('Submit')}
                            </Button>
                        </>
                    )}
                </form>
            </div>
        </div>
    ) : (
        <ul>
            <li className="flex items-center gap-1">
                <Icon className="text-default-600" icon="ci:check" width={24} />
                <p className="text-small text-default-500">{t('createCardTag1')}</p>
            </li>
            <li className="flex items-center gap-1">
                <Icon className="text-default-600" icon="ci:check" width={24} />
                <p className="text-small text-default-500">{t('createCardTag2')}</p>
            </li>
        </ul>
    );

    return (
        <Card {...props} className="relative w-full pb-[100px] border dark:border-none">
            {isOpen ? (
                <Button className="absolute right-4 top-4 z-10" isIconOnly={isOpen} radius="full" size="sm" onPress={() => setIsOpen(prev => !prev)}>
                    <Icon icon="ci:close-sm" width={24} />
                </Button>
            ) : (
                <Button
                    className="absolute right-4 top-4 z-10 text-white bg-gradient-to-br from-pink-300 from-45%  to-indigo-600 dark:from-indigo-500 dark:to-pink-500"
                    isIconOnly={isOpen}
                    radius="full"
                    size="sm"
                    onPress={() => setIsOpen(prev => !prev)}
                >
                    {t('Create')}
                </Button>
            )}
            <CardBody className="relative min-h-[300px] bg-gradient-to-br from-content1 to-default-100/50 p-8 before:inset-0 before:h-full before:w-full before:content-['']">
                <h1 className="mb-4 text-default-400 top-[-12px] relative">{t('quick to')}</h1>
                <h2 className="inline bg-gradient-to-br from-foreground-800 to-foreground-500 bg-clip-text text-6xl font-semibold tracking-tight text-transparent dark:to-foreground-200">
                    New
                    <br />
                    Memory
                    <br />
                    Create
                </h2>
            </CardBody>
            <CardFooter
                className={cn('absolute bottom-0 h-[100px] overflow-visible bg-content1 px-6 duration-300 ease-in-out transition-height', {
                    'h-full': isOpen,
                    'border-t-1 border-default-100': !isOpen
                })}
            >
                {content}
            </CardFooter>
        </Card>
    );
});

interface TaskListProps {
    isShow: boolean;
    spaceID: string;
    onClose: () => void;
}

export function TaskList({ isShow, spaceID, onClose }: TaskListProps) {
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const { t } = useTranslation();

    const [taskList, setTaskList] = useImmer<ChunkTask[]>([]);
    const [page, setPage] = useImmer(1);
    const [total, setTotal] = useState(0);
    const pageSize = 20;
    async function loadTaskList(page: number) {
        if (page !== 1 && !hasMore) {
            return;
        }
        setIsLoading(true);
        try {
            const resp = await GetTaskList(spaceID, page, pageSize);
            setTotal(resp.total);
            if (page == 1) {
                setTaskList(resp.list);
            } else {
                setTaskList((prev: ChunkTask[]) => {
                    prev = prev.concat(resp.list);
                });
            }
            if (page * pageSize >= resp.total) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }
            setPage(page);
        } catch (e: any) {
            console.error(e);
        }
        setIsLoading(false);
    }

    useEffect(() => {
        if (isShow) {
            // 创建 interval
            const intervalID = setInterval(() => {
                refreshTaskStatus();
            }, 10000);

            // 清理函数：组件销毁时清除 interval
            return () => {
                clearInterval(intervalID);
            };
        }
    }, [isShow]);

    async function refreshTaskStatus() {
        const needToRefresh = [];
        const taskMap = new Map<string, number>();
        taskList.forEach(v => {
            if (v.status !== 1 && v.retry_times < 3) {
                needToRefresh.push(v.task_id);
                taskMap.set(v.task_id, v.status);
            }
        });

        if (needToRefresh.length == 0) {
            return;
        }
        try {
            const resp = await LoadTasksStatus(spaceID, needToRefresh);
            resp.forEach(v => {
                if (taskMap.get(v.task_id) != v.status) {
                    setTaskList(prev => {
                        let task = prev.find(item => item.task_id == v.task_id);
                        if (task) {
                            task.status = v.status;
                        }
                    });
                }
            });
        } catch (e: any) {
            console.error(e);
        }
    }
    useEffect(() => {
        if (!spaceID || !isShow) {
            setTaskList([]);
            return;
        }
        loadTaskList(1);
    }, [spaceID, isShow]);

    const columns = [
        { name: 'ID', uid: 'task_id' },
        { name: t('FileName'), uid: 'file_name' },
        { name: t('Resource'), uid: 'resource_title' },
        { name: t('Operator'), uid: 'user' },
        { name: t('Status'), uid: 'status' },
        { name: t('CreatedAt'), uid: 'created_at' },
        { name: t('Operate'), uid: 'actions' }
    ];

    const classNames = useMemo(
        () => ({
            wrapper: ['max-h-[382px]', 'max-w-3xl'],
            th: ['bg-transparent', 'text-default-500', 'border-b', 'border-divider'],
            td: [
                // changing the rows border radius
                // first
                'group-data-[first=true]/tr:first:before:rounded-lg',
                'group-data-[first=true]/tr:last:before:rounded-lg',
                // middle
                'group-data-[middle=true]/tr:before:rounded-none',
                // last
                'group-data-[last=true]/tr:first:before:rounded-lg',
                'group-data-[last=true]/tr:last:before:rounded-lg'
            ]
        }),
        []
    );

    const [isDeleteLoading, setIsDeleteLoading] = useState(false);

    const renderCell = useCallback(
        (item, columnKey) => {
            const cellValue = item[columnKey];

            switch (columnKey) {
                case 'user':
                    return (
                        <User
                            avatarProps={{ radius: 'full', size: 'sm', src: item.user_avatar }}
                            classNames={{
                                description: 'text-default-500'
                            }}
                            description={item.user_email}
                            name={item.user_name}
                        >
                            {item.user_name}
                        </User>
                    );
                case 'status':
                    const color = cellValue === 1 ? 'primary' : item.retry_times === 3 ? 'error' : 'warning';
                    const desc =
                        cellValue === 1 ? (
                            <Chip className="capitalize border-none gap-1 text-default-600" color={color} size="sm" variant="dot">
                                {t('Done')}
                            </Chip>
                        ) : item.retry_times === 3 ? (
                            <Chip className="capitalize border-none gap-1 text-default-600" color={color} size="sm" variant="dot">
                                {t('Failed')}
                            </Chip>
                        ) : (
                            <div className="flex justify-center items-center gap-2">
                                <Spinner color="white" size="sm" />
                                {t('Doing')}
                            </div>
                        );
                    return desc;
                case 'actions':
                    return (
                        <div className="relative flex justify-end items-center gap-2">
                            <Popover showArrow offset={10}>
                                <PopoverTrigger>
                                    <Button size="sm" variant="ghost">
                                        {t('Delete')}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent>
                                    <Button
                                        onPress={async () => {
                                            toast.promise(deleteTask(item.task_id), {
                                                loading: t(`Doing`)
                                            });
                                        }}
                                        color="warning"
                                        size="sm"
                                    >
                                        {t('Confirm')}
                                    </Button>
                                </PopoverContent>
                            </Popover>
                        </div>
                    );
                case 'created_at':
                    return new Date(cellValue * 1000).toLocaleString();
                default:
                    return cellValue;
            }
        },
        [spaceID]
    );

    const deleteTask = useCallback(
        async (taskID: string) => {
            try {
                await DeleteTask(spaceID, taskID);
                loadTaskList(1);
            } catch (e: any) {
                console.error(e);
            }
            // setIsDeleteLoading(false);
        },
        [spaceID]
    );

    return (
        <Modal isOpen={isShow} backdrop="blur" size="5xl" onClose={onClose}>
            <ModalContent>
                {onClose => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">{t('TaskList')}</ModalHeader>
                        <ModalBody>
                            <Table
                                removeWrapper
                                aria-label="Example table with custom cells, pagination and sorting"
                                bottomContent={
                                    hasMore && !isLoading ? (
                                        <div className="flex w-full justify-center">
                                            <Button
                                                isDisabled={isLoading}
                                                variant="flat"
                                                onPress={async () => {
                                                    const nextPage = page + 1;
                                                    try {
                                                        await loadTaskList(nextPage);
                                                        setPage(nextPage);
                                                    } catch (e: any) {
                                                        console.error(e);
                                                    }
                                                }}
                                            >
                                                {isLoading && <Spinner color="white" size="sm" />}
                                                {t('LoadMore')}
                                            </Button>
                                        </div>
                                    ) : null
                                }
                                bottomContentPlacement="outside"
                                checkboxesProps={{
                                    classNames: {
                                        wrapper: 'after:bg-foreground after:text-background text-background'
                                    }
                                }}
                                classNames={classNames}
                            >
                                <TableHeader columns={columns}>
                                    {column => (
                                        <TableColumn key={column.uid} align={column.uid === 'actions' ? 'center' : 'start'}>
                                            {column.name}
                                        </TableColumn>
                                    )}
                                </TableHeader>
                                <TableBody isLoading={isLoading} loadingContent={<Spinner></Spinner>} onLoadMore={loadTaskList} emptyContent={t('Empty')} items={taskList}>
                                    {item => <TableRow key={item.task_id}>{columnKey => <TableCell>{renderCell(item, columnKey)}</TableCell>}</TableRow>}
                                </TableBody>
                            </Table>
                        </ModalBody>
                        <ModalFooter></ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}

export const VerticalDotsIcon = ({ size = 24, width, height, ...props }) => {
    return (
        <svg aria-hidden="true" fill="none" focusable="false" height={size || height} role="presentation" viewBox="0 0 24 24" width={size || width} {...props}>
            <path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" fill="currentColor" />
        </svg>
    );
};
