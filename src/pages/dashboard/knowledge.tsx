import {
    BreadcrumbItem,
    Breadcrumbs,
    Button,
    ButtonGroup,
    Card,
    CardBody,
    CardFooter,
    CardHeader,
    Chip,
    Image,
    Link,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    Progress,
    ScrollShadow,
    Skeleton,
    Textarea,
    useDisclosure
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { current } from 'immer';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from 'usehooks-ts';
import { useSnapshot } from 'valtio';
import { subscribeKey } from 'valtio/utils';

import { GetKnowledge, type Knowledge, ListKnowledge } from '@/apis/knowledge';
import CreateKnowledge from '@/components/create';
import GoTop from '@/components/go-top';
import KnowledgeEdit from '@/components/knowledge-edit';
import KnowledgeModal from '@/components/knowledge-modal';
import MainQuery from '@/components/main-query';
import Markdown from '@/components/markdown';
import WorkBar from '@/components/work-bar';
import { useMedia } from '@/hooks/use-media';
import { useRole } from '@/hooks/use-role';
import { useUserAgent } from '@/hooks/use-user-agent';
import { FireTowerMsg } from '@/lib/firetower';
import knowledgeStore, { onKnowledgeSearchKeywordsChange } from '@/stores/knowledge';
import resourceStore from '@/stores/resource';
import socketStore, { CONNECTION_OK } from '@/stores/socket';
import spaceStore from '@/stores/space';
import { Role } from '@/types';

export default memo(function Component() {
    const { t } = useTranslation();
    const { isMobile } = useMedia();
    const { currentSelectedSpace } = useSnapshot(spaceStore);
    const { currentSelectedResource } = useSnapshot(resourceStore);
    const [page, setPage] = useState(1);
    const [pageSize, _] = useState(isMobile ? 10 : 30);
    let [dataList, setDataList] = useState<Knowledge[]>([]);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const { onKnowledgeSearch } = useSnapshot(knowledgeStore);
    const navigate = useNavigate();

    const { isSpaceViewer } = useRole();

    useEffect(() => {
        if (!currentSelectedResource || !currentSelectedSpace) {
            return;
        }

        const unSubscribe = subscribeKey(knowledgeStore, 'onKnowledgeSearch', (keywords: string) => {
            initPage();
            loadData(1, pageSize, currentSelectedSpace, keywords, currentSelectedResource?.id);
        });

        return unSubscribe;
    }, [currentSelectedSpace, currentSelectedResource]);

    // load knowledge logic
    function initPage() {
        if (ssDom && ssDom.current) {
            ssDom.current.goToTop();
        }
        setPage(1);
        setHasMore(true);
        setDataList([]);
    }

    async function loadData(page: number, pageSize: number, spaceID: string, searchKeywords: string, resourceID: string = '') {
        let _dataList: Knowledge[] = [];

        if (page !== 1 && dataList.length > 0) {
            _dataList = dataList;
        }
        setIsLoading(true);
        try {
            const resp = await ListKnowledge(spaceID, searchKeywords, resourceID, page, pageSize);

            setPage(_ => page);
            if (resp.total <= page * pageSize) {
                setHasMore(_ => false);
            }

            if (resp.list && _dataList.length > 0) {
                resp.list.forEach(v => {
                    _dataList.push(v);
                });
            } else {
                _dataList = resp.list || [];
            }
            setDataList(_ => _dataList);
            setTotal(_ => resp.total);
        } catch (e: any) {
            console.error(e);
        }
        setIsLoading(false);
    }

    const refreshDataList = useCallback(() => {
        initPage();

        loadData(1, pageSize, currentSelectedSpace, onKnowledgeSearch, currentSelectedResource?.id);
    }, [currentSelectedResource, currentSelectedSpace, onKnowledgeSearch]);

    // reload on selected resource or space changed
    useEffect(() => {
        if (!currentSelectedResource || !currentSelectedResource.title || !currentSelectedSpace) {
            return;
        }

        refreshDataList();
    }, [currentSelectedResource, currentSelectedSpace]);

    const [onLoadingMore, setOnLoadingMore] = useState(false);

    async function onLoadMore() {
        if (!hasMore || onLoadingMore) {
            return;
        }
        setOnLoadingMore(true);
        await loadData(page + 1, pageSize, currentSelectedSpace, onKnowledgeSearch, currentSelectedResource?.id);
        setTimeout(() => {
            setOnLoadingMore(false);
        }, 500);
    }

    // show / edit / create knowledge detail
    // @ts-ignore
    const viewKnowledge = useRef(null);
    // @ts-ignore

    const showKnowledge = useCallback(
        (knowledge: Knowledge) => {
            if (isMobile) {
                navigate(`/dashboard/${knowledge.space_id}/knowledge/${knowledge.id}/editor`);
                return;
            }
            if (viewKnowledge && viewKnowledge.current) {
                // @ts-ignore
                viewKnowledge.current.show(knowledge);
            }
        },
        [viewKnowledge]
    );

    function onChanges() {
        refreshDataList();
    }

    const onDelete = useCallback(
        (knowledgeID: string) => {
            setDataList(dataList.filter(a => a.id !== knowledgeID));
        },
        [dataList]
    );

    //@ts-ignore
    const ssDom = useRef<{ goToTop: () => void }>();

    const isShowCreate = useMemo(() => {
        return !isSpaceViewer;
    }, [isMobile, isSpaceViewer]);

    return (
        <>
            <div className="overflow-hidden w-full h-full flex flex-col relative">
                {/* <div className="w-full px-6 space-y-1 mb-6">
                    <div className="flex justify-between">
                        <h1 className="text-2xl font-bold leading-9 text-default-foreground mb-4">{t('Your Memories')}</h1>
                        {isLoading && <Progress isIndeterminate size="sm" aria-label="Loading..." className="w-14" />}
                    </div>

                    <Skeleton isLoaded={total > 0 || !isLoading} className="max-w-64 rounded-lg">
                        <p className="text-small text-default-400">{t('memories count', { total: total, title: currentSelectedResource?.title })}</p>
                    </Skeleton>
                </div> */}

                <KnowledgeList
                    ref={ssDom}
                    total={total}
                    isLoading={isLoading}
                    isShowCreate={isShowCreate}
                    knowledgeList={dataList}
                    onSelect={showKnowledge}
                    onChanges={onChanges}
                    onLoadMore={onLoadMore}
                />
            </div>

            <KnowledgeModal ref={viewKnowledge} onChange={onChanges} onDelete={onDelete} />
        </>
    );
});

interface KnowledgeListProps {
    knowledgeList: Knowledge[];
    total: number;
    isShowCreate: boolean;
    isLoading: boolean;
    onSelect: (data: Knowledge) => void;
    onChanges: () => void;
    onLoadMore: () => void;
    onShowCreate?: () => void;
}

const KnowledgeList = memo(
    forwardRef(function KnowledgeList({ knowledgeList, total, onSelect, isLoading = false, isShowCreate = true, onShowCreate, onChanges, onLoadMore }: KnowledgeListProps, ref: any) {
        const { t } = useTranslation();
        const [dataList, setDataList] = useState(knowledgeList);
        const [onEvent, setEvent] = useState<FireTowerMsg | null>();
        const { currentSelectedSpace } = useSnapshot(spaceStore);
        const { subscribe, connectionStatus } = useSnapshot(socketStore);
        const { currentSelectedResource } = useSnapshot(resourceStore);
        const { isMobile } = useMedia();

        useEffect(() => {
            setDataList(knowledgeList);
        }, [knowledgeList]);

        useEffect(() => {
            if (connectionStatus !== CONNECTION_OK || currentSelectedSpace === '' || !subscribe) {
                return;
            }
            // data : {\"subject\":\"stage_changed\",\"version\":\"v1\",\"data\":{\"knowledge_id\":\"n9qU71qKbqhHak6weNrH7UpCzU4yNiBv\",\"stage\":\"Done\"}}"
            const unSubscribe = subscribe(['/knowledge/list/' + currentSelectedSpace], (msg: FireTowerMsg) => {
                if (msg.data.subject !== 'stage_changed') {
                    return;
                }

                setEvent(msg);
            });

            return unSubscribe;
        }, [connectionStatus, currentSelectedSpace]);

        useEffect(() => {
            if (!onEvent || !onEvent.data || onEvent.data.subject !== 'stage_changed') {
                return;
            }

            switch (onEvent.data.data.stage) {
                case 'Embedding':
                    const nextList = [...dataList];
                    const item = nextList.find(a => a.id === onEvent.data.data.knowledge_id);

                    if (item) {
                        item.stage = 2; // TODO const
                        setDataList(nextList);
                    }
                    break;
                case 'Done':
                    const doneLogic = async function () {
                        try {
                            const data = await GetKnowledge(currentSelectedSpace, onEvent.data.data.knowledge_id);
                            const newDataList = dataList.map(item => {
                                if (item.id === onEvent.data.data.knowledge_id) {
                                    return data;
                                }

                                return item;
                            });

                            setDataList(newDataList);
                        } catch (e: any) {
                            console.error(e);
                        }
                    };

                    doneLogic();
                    break;
                default:
                    console.log('unknown event', onEvent);
            }
            setEvent(null);
        }, [onEvent]);

        const ssDom = useRef<HTMLElement>(null);

        function goToTop() {
            if (ssDom) {
                // @ts-ignore
                ssDom.current.scrollTop = 0;
            }
        }

        // @ts-ignore
        useImperativeHandle(ref, () => {
            return {
                goToTop
            };
        });

        const [showGoTop, setShowGoTop] = useState(false);

        // @ts-ignore
        async function scrollChanged(e) {
            if (!showGoTop && e.target.scrollTop > 300) {
                setShowGoTop(true);
            } else if (showGoTop && e.target.scrollTop <= 300) {
                setShowGoTop(false);
            }

            if (e.target.scrollTop + e.target.clientHeight + 50 > e.target.scrollHeight) {
                onLoadMore();
            }
        }
        const { isSafari } = useUserAgent();
        const [isShowMemoryCreate, setIsShowMemoryCreate] = useState(false);
        return (
            <>
                <ScrollShadow ref={ssDom} hideScrollBar className="w-full flex-grow box-border mb-6" onScroll={scrollChanged}>
                    <WorkBar spaceid={currentSelectedSpace} onSubmit={onChanges} isShowCreate={isShowMemoryCreate} onShowChange={setIsShowMemoryCreate} />
                    <div className="w-full  space-y-1 mb-6  py-1">
                        <div className="flex justify-between items-center gap-4 px-6">
                            <div className="flex flex-col gap-2">
                                <div className="text-xl font-bold leading-9 text-default-foreground">{t('Your Memories')}</div>
                                <div className="text-small text-default-400">{t('memories count', { total: total, title: currentSelectedResource?.title })}</div>
                            </div>
                            {isLoading && <Progress isIndeterminate size="sm" aria-label="Loading..." className="w-14" />}
                        </div>

                        {/* <Skeleton isLoaded={total > 0} className="max-w-64 rounded-lg">
                            <p className="text-small text-default-400">{t('memories count', { total: total, title: currentSelectedResource?.title })}</p>
                        </Skeleton> */}
                    </div>
                    <div className={[isSafari ? 'm-auto w-full max-w-[900px]' : 'columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 3xl:columns-5', 'gap-[24px] px-6'].join(' ')}>
                        {/* {isShowCreate && (
                            <div className="mb-[24px]">
                                <CreateKnowledge shadow={isMobile ? 'none' : 'sm'} onChanges={onChanges} openCreateKnowledge={onShowCreate} />
                            </div>
                        )} */}
                        {dataList.map(item => {
                            return (
                                <div key={item.id} role="button" tabIndex={0} className="mb-[24px] relative" onClick={() => onSelect(item)} onKeyDown={() => {}}>
                                    <NormalCard shadow={isMobile ? 'none' : 'sm'} content={item.content} tags={item.tags} title={item.title} stage={item.stage} />
                                </div>
                            );
                        })}
                    </div>
                </ScrollShadow>
                <div className="absolute w-[260px] bottom-2 right-1/2 mr-[-130px]">
                    <MainQuery
                        onClick={() => {
                            setIsShowMemoryCreate(true);
                        }}
                    />
                </div>
                {showGoTop && <GoTop className="fixed bottom-7 right-2 backdrop-blur backdrop-saturate-150 dark:border-white/20 dark:bg-white/10 dark:text-white text-gray-500" onPress={goToTop} />}
            </>
        );
    })
);

const NormalCard = memo(function NormalCard({
    shadow,
    title,
    content,
    tags,
    stage
}: {
    shadow: 'none' | 'sm' | 'md' | 'lg' | undefined;
    title: string;
    content: string;
    tags: string[] | undefined;
    stage: number;
}) {
    return (
        <>
            <Card
                shadow={shadow}
                className="w-full flex flex-col relative border-small border-foreground/10 bg-right-bottom bg-no-repeat
                hover:border-indigo-500/50 hover:outset-1 hover:outset-x-1 hover:outset-y-1 hover:blur-2.5 hover:spread-1 cursor-pointer"
            >
                {title !== '' ? (
                    <CardHeader>
                        <div className="flex items-center">
                            <p className="text-large font-medium dark:text-zinc-300 text-gray-800">{title}</p>
                        </div>
                    </CardHeader>
                ) : (
                    <></>
                )}
                <CardBody className="px-3 relative max-h-[460px]">
                    <div className="flex flex-col gap-2 px-1 w-full overflow-hidden">
                        {tags && (
                            <div className="flex flex-wrap gap-1">
                                {tags.map(item => {
                                    return (
                                        <Chip key={item} className="text-gray-600 dark:text-gray-300" size="sm" variant="bordered">
                                            {item}
                                        </Chip>
                                    );
                                })}
                            </div>
                        )}
                        <div className="text-base dark:text-white/60 text-gray-500 h-full overflow-ellipsis overflow-hidden line-clamp-6 text-wrap break-words">
                            <Markdown isLight>{content}</Markdown>
                        </div>
                    </div>
                </CardBody>
                {(() => {
                    if (stage === 3) {
                        return <></>;
                    }

                    return (
                        <CardFooter className="justify-end gap-2">
                            <Button fullWidth className="border-small backdrop-blur backdrop-saturate-150 border-white/20 bg-white/10 dark:text-white" isLoading={true}>
                                <p className="text-tiny dark:text-white/80">{stage === 1 ? 'Summarizing.' : 'Embedding.'}</p>
                            </Button>
                        </CardFooter>
                    );
                })()}
            </Card>
        </>
    );
});
