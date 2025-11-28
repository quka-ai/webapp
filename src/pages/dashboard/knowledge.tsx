import { Card, Chip, Progress, ScrollShadow } from '@heroui/react';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSnapshot } from 'valtio';
import { subscribeKey } from 'valtio/utils';

import { GetKnowledge, type Knowledge, ListKnowledge } from '@/apis/knowledge';
import GoTop from '@/components/go-top';
import KnowledgeModal from '@/components/knowledge-modal';
import MainQuery from '@/components/main-query';
import Markdown from '@/components/markdown';
import MultiDayJournalTodos from '@/components/multi-day-journal-todos';
import WorkBar, { WorkBarRef } from '@/components/work-bar';
import { useMedia } from '@/hooks/use-media';
import { useSpaceRole } from '@/hooks/use-role';
import knowledgeStore from '@/stores/knowledge';
import resourceStore from '@/stores/resource';
import socketStore, { CONNECTION_OK } from '@/stores/socket';
import spaceStore from '@/stores/space';

export default memo(function Component() {
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
    const [onEvent, setEvent] = useState<FireTowerMsg | null>();
    const { subscribe, connectionStatus } = useSnapshot(socketStore);
    const navigate = useNavigate();

    const { isSpaceViewer } = useSpaceRole();

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
            // ssDom.current.goToTop();
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

            // 处理响应数据：清理HTML标签和隐藏敏感信息
            const processedList = (resp.list || []).map(v => ({
                ...v,
                content: v.content.replace(/\$hidden\[([^\]]*)\]/g, '[Secret]') // 隐藏敏感信息
            }));

            if (_dataList.length > 0) {
                _dataList.push(...processedList);
            } else {
                _dataList = processedList;
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
        if (!hasMore || onLoadingMore || isLoading) {
            return;
        }
        setOnLoadingMore(true);
        await loadData(page + 1, pageSize, currentSelectedSpace, onKnowledgeSearch, currentSelectedResource?.id);
        setTimeout(() => {
            setOnLoadingMore(false);
        }, 500);
    }

    // show / edit / create knowledge detail
    const viewKnowledge = useRef<{ show: (id: string) => void }>(null);

    const showKnowledge = useCallback(
        (knowledge: Knowledge) => {
            if (isMobile) {
                navigate(`/dashboard/${knowledge.space_id}/knowledge/${knowledge.id}/editor`);
                return;
            }
            if (viewKnowledge && viewKnowledge.current) {
                viewKnowledge.current.show(knowledge.id);
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
            setTotal(prevTotal => prevTotal - 1);
        },
        [dataList]
    );

    //@ts-ignore
    const ssDom = useRef<{ goToTop: () => void }>();

    const isShowCreate = useMemo(() => {
        return !isSpaceViewer;
    }, [isMobile, isSpaceViewer]);

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
                        const data = await GetKnowledge(currentSelectedSpace, onEvent.data.data.knowledge_id, true);
                        data.content = data.content.replace(/\$hidden\[([^\]]*)\]/g, '[Secret]'); // 隐藏敏感信息
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

        const { currentSelectedSpace } = useSnapshot(spaceStore);

        const { currentSelectedResource } = useSnapshot(resourceStore);
        const { isMobile } = useMedia();

        useEffect(() => {
            setDataList(knowledgeList);
        }, [knowledgeList]);

        const workBarRef = useRef<WorkBarRef>(null);

        const showKnowledgeCreate = useCallback(() => {
            if (workBarRef.current) {
                workBarRef.current.showCreateModal();
            }
        }, []);

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

            if (e.target.scrollTop + e.target.clientHeight + 50 > e.target.scrollHeight && knowledgeList && knowledgeList.length >= 0) {
                onLoadMore();
            }
        }

        return (
            <>
                <ScrollShadow ref={ssDom} hideScrollBar className="w-full flex-grow box-border mb-6 pb-20" onScroll={scrollChanged}>
                    <WorkBar ref={workBarRef} spaceid={currentSelectedSpace} isShowCreate={isShowCreate} onSubmit={onChanges} />

                    <MultiDayJournalTodos />

                    <div className="w-full  space-y-1 mb-6  py-1">
                        <div className="flex justify-between items-center gap-4 md:px-6 px-3">
                            <div className="flex flex-col gap-2">
                                <div id="knowledgebox" className="text-xl font-bold leading-9 text-default-foreground">
                                    {t('Your Memories')}
                                </div>
                                <div className="text-small text-default-400">{t('memories count', { total: total, title: currentSelectedResource?.title })}</div>
                            </div>
                            {isLoading && <Progress isIndeterminate size="sm" aria-label="Loading..." className="w-14" />}
                        </div>

                        {/* <Skeleton isLoaded={total > 0} className="max-w-64 rounded-lg">
                            <p className="text-small text-default-400">{t('memories count', { total: total, title: currentSelectedResource?.title })}</p>
                        </Skeleton> */}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7 3xl:grid-cols-5 gap-4 md:px-6 px-3">
                        {/* {isShowCreate && (
                            <div className="mb-[24px]">
                                <CreateKnowledge shadow={isMobile ? 'none' : 'sm'} onChanges={onChanges} openCreateKnowledge={onShowCreate} />
                            </div>
                        )} */}
                        {dataList.map(item => {
                            return (
                                <div key={item.id} role="button" tabIndex={0} className="relative" onClick={() => onSelect(item)} onKeyDown={() => {}}>
                                    <NormalCard shadow={isMobile ? 'none' : 'sm'} content={item.content} tags={item.tags} title={item.title} stage={item.stage} />
                                </div>
                            );
                        })}
                    </div>
                </ScrollShadow>
                {isShowCreate && (
                    <div className="absolute w-[260px] bottom-2 right-1/2 mr-[-130px]">
                        <MainQuery
                            onClick={() => {
                                showKnowledgeCreate();
                            }}
                        />
                    </div>
                )}

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
                className="w-full h-80 relative border-small dark:border-default-100 overflow-hidden bg-linear-to-br from-default-400/30 to-default-400 dark:from-default-400 dark:to-default-400/30
                hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all duration-200 cursor-pointer"
            >
                {/* 前景内容层 */}
                <div className="relative z-10 flex flex-col h-full p-5 bg-linear-to-b from-background/70 to-background/70 text-sm">
                    {/* 标题 */}
                    {title && title.trim() !== '' && <h3 className="text-lg font-semibold text-foreground mb-2.5 line-clamp-2 leading-snug min-h-10 shrink-0">{title}</h3>}

                    {/* 标签 */}
                    {tags && tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3 shrink-0">
                            {tags.slice(0, 3).map(item => (
                                <Chip key={item} size="sm" variant="flat" className="bg-default-200/80 dark:bg-default-200/60 text-foreground-600 dark:text-foreground-700 text-xs h-5">
                                    {item}
                                </Chip>
                            ))}
                            {tags.length > 3 && (
                                <Chip size="sm" variant="flat" className="bg-default-200/60 dark:bg-default-100/10 text-foreground-500 text-xs h-5">
                                    +{tags.length - 3}
                                </Chip>
                            )}
                        </div>
                    )}

                    {/* 内容预览区域 - 占据剩余空间 */}
                    <div className="flex-1 mb-3 relative min-h-[300px] w-full m-auto mt-2 p-2">
                        <div className="text-[0.7rem] leading-relaxed text-foreground-500 dark:text-foreground-400 line-clamp-9 opacity-70">
                            <Markdown isLight>{content}</Markdown>
                        </div>
                    </div>

                    {/* 底部状态 */}
                    <div className="flex items-center gap-2 pt-2 border-foreground/5">
                        {stage !== 3 && (
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                <span className="text-xs text-foreground-400">{stage === 1 ? 'Summarizing' : 'Embedding'}</span>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </>
    );
});
