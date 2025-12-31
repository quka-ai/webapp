import { Button, Chip, Skeleton } from '@heroui/react';
import { Icon } from '@iconify/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSnapshot } from 'valtio';

import { createPodcast, getPodcastBySource } from '@/apis/podcast';
import type { Podcast } from '@/stores/podcast';
import podcastStore, { addCreatingPodcast, removeCreatingPodcast } from '@/stores/podcast';
import spaceStore from '@/stores/space';

interface PodcastBarProps {
    sourceType: 'knowledge' | 'journal';
    sourceId: string;
    className?: string;
}

export default function PodcastBar({ sourceType, sourceId, className = '' }: PodcastBarProps) {
    const navigate = useNavigate();
    const { t } = useTranslation('podcast');
    const { currentSelectedSpace } = useSnapshot(spaceStore);
    const [refreshKey, setRefreshKey] = React.useState(0);
    const [isCreating, setIsCreating] = React.useState(false);

    // 获取正在创建的播客状态
    const creatingPodcast = isCreating;

    // 处理创建播客
    const handleCreatePodcast = async () => {
        if (!currentSelectedSpace) {
            toast.error(t('SpaceNotSelected'));
            return;
        }

        try {
            setIsCreating(true);
            const result = await createPodcast(currentSelectedSpace, sourceType, sourceId);
            // 更新 creatingMap 状态
            addCreatingPodcast(sourceId, result.id, result.status);
            // 触发刷新
            setRefreshKey(prev => prev + 1);
            toast.success(t('PodcastCreationStarted'));
            setIsCreating(false);
        } catch (error: any) {
            console.error('Failed to create podcast:', error);
            toast.error(error.message || t('CreatePodcastFailed'));
            setIsCreating(false);
        }
    };

    // 跳转到播客详情页
    const handleNavigateToPodcast = (podcast: Podcast) => {
        // 验证 podcast 对象有效性
        if (!podcast?.space_id || !podcast?.id) {
            console.error('Invalid podcast data:', podcast);
            toast.error(t('NavigationFailed'));
            return;
        }
        navigate(`/dashboard/${podcast.space_id}/podcasts/${podcast.id}`);
    };

    // 如果正在创建播客，显示加载状态
    if (creatingPodcast) {
        return (
            <div className={`w-full flex items-center gap-2 px-2 py-1 ${className}`}>
                <Icon icon="mdi:podcast" className="text-default-400 dark:text-default-500" width={14} />
                <div className="flex items-center gap-2 flex-1">
                    <Skeleton className="h-4 w-16 rounded-full" />
                    <Skeleton className="h-4 w-12 rounded-full" />
                </div>
                <Chip color="primary" variant="flat" size="sm" className="text-xs">
                    {t('Creating')}
                </Chip>
            </div>
        );
    }

    return (
        <PodcastBarInner
            sourceType={sourceType}
            sourceId={sourceId}
            className={className}
            refreshKey={refreshKey}
            onNavigateToPodcast={handleNavigateToPodcast}
            onCreatePodcast={handleCreatePodcast}
        />
    );
}

interface PodcastBarInnerProps extends PodcastBarProps {
    onCreatePodcast: () => void;
    onNavigateToPodcast: (podcast: Podcast) => void;
    refreshKey: number;
}

function PodcastBarInner({ sourceType, sourceId, className, onCreatePodcast, onNavigateToPodcast, refreshKey }: PodcastBarInnerProps) {
    const { t } = useTranslation('podcast');
    return (
        <PodcastFetcher sourceType={sourceType} sourceId={sourceId} onPodcastFound={onNavigateToPodcast} refreshKey={refreshKey}>
            {({ podcast, loading }) => {
                // 如果有播客，显示播客信息
                if (podcast) {
                    return (
                        <div className={`w-full flex items-center justify-end gap-2 px-2 py-1 ${className}`}>
                            <Icon icon="mdi:podcast" className="text-default-500 dark:text-default-400" width={14} />
                            <div
                                className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                                role="button"
                                tabIndex={0}
                                aria-label="跳转到播客详情"
                                onClick={() => onNavigateToPodcast(podcast)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onNavigateToPodcast(podcast);
                                    }
                                }}
                            >
                                <span className="text-xs text-default-600 dark:text-default-400 truncate">{podcast.title}</span>
                                <Chip
                                    color={podcast.status === 'completed' ? 'success' : podcast.status === 'processing' ? 'primary' : podcast.status === 'pending' ? 'warning' : 'danger'}
                                    variant="flat"
                                    size="sm"
                                    className="text-xs"
                                >
                                    {podcast.status === 'completed' && t('Completed')}
                                    {podcast.status === 'processing' && t('Processing')}
                                    {podcast.status === 'pending' && t('Pending')}
                                    {podcast.status === 'failed' && t('Failed')}
                                </Chip>
                            </div>
                            <Button isIconOnly size="sm" variant="light" className="min-w-6 w-6 h-6" onPress={() => onNavigateToPodcast(podcast)}>
                                <Icon icon="mdi:chevron-right" width={14} />
                            </Button>
                        </div>
                    );
                }

                // 如果没有播客，显示创建按钮 - 靠右对齐
                return (
                    <div className={`w-full flex items-center gap-2 px-2 py-1 ${className}`}>
                        <Icon icon="mdi:podcast-outline" className="text-default-400 dark:text-default-500" width={14} />
                        <div className="flex items-center gap-2 ml-auto">
                            <span className="text-xs text-default-500 dark:text-default-400">{t('NoPodcast')}</span>
                            <Button size="sm" color="primary" variant="light" className="h-6 px-2 text-xs" isLoading={loading} onPress={onCreatePodcast}>
                                {t('Generate')}
                            </Button>
                        </div>
                    </div>
                );
            }}
        </PodcastFetcher>
    );
}

interface PodcastFetcherProps {
    sourceType: 'knowledge' | 'journal';
    sourceId: string;
    onPodcastFound: (podcast: Podcast) => void;
    refreshKey: number;
    children: (props: { podcast: Podcast | null; loading: boolean }) => React.ReactNode;
}

function PodcastFetcher({ sourceType, sourceId, onPodcastFound, refreshKey, children }: PodcastFetcherProps) {
    const { currentSelectedSpace } = useSnapshot(spaceStore);
    const { creatingMap } = useSnapshot(podcastStore);
    const [podcast, setPodcast] = React.useState<Podcast | null>(null);
    const [loading, setLoading] = React.useState(true);
    const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

    // 使用 useCallback 稳定 onPodcastFound 函数
    const handlePodcastFound = React.useCallback(
        (podcast: Podcast) => {
            onPodcastFound(podcast);
        },
        [onPodcastFound]
    );

    // 初始获取播客
    React.useEffect(() => {
        let mounted = true;

        const fetchPodcast = async () => {
            if (!currentSelectedSpace) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const result = await getPodcastBySource(currentSelectedSpace, sourceType, sourceId);
                if (mounted) {
                    setPodcast(result);
                }
            } catch (err: any) {
                if (mounted) {
                    setPodcast(null);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        fetchPodcast();

        return () => {
            mounted = false;
        };
    }, [sourceType, sourceId, currentSelectedSpace, refreshKey]);

    // 轮询逻辑 - 独立于初始获取
    React.useEffect(() => {
        const shouldPoll = creatingMap[sourceId] || (podcast && podcast.status !== 'completed' && podcast.status !== 'failed');

        if (!shouldPoll) {
            // 如果不需要轮询，清理现有的轮询
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        // 启动轮询
        if (!intervalRef.current) {
            intervalRef.current = setInterval(async () => {
                try {
                    if (!currentSelectedSpace) return;
                    const result = await getPodcastBySource(currentSelectedSpace, sourceType, sourceId);
                    if (result) {
                        setPodcast(result);
                        // 如果找到播客且之前在创建中，移除创建状态
                        if (creatingMap[sourceId]) {
                            removeCreatingPodcast(sourceId);
                        }
                        if (result.status === 'completed' || result.status === 'failed') {
                            handlePodcastFound(result);
                            // 播客完成，停止轮询
                            if (intervalRef.current) {
                                clearInterval(intervalRef.current);
                                intervalRef.current = null;
                            }
                        }
                    }
                } catch (err) {
                    console.error('Polling error:', err);
                }
            }, 5000);
        }

        return () => {
            // 清理函数由上面的逻辑处理
        };
    }, [sourceType, sourceId, currentSelectedSpace, creatingMap[sourceId], podcast?.status, handlePodcastFound]);

    // 组件卸载时清理轮询
    React.useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, []);

    return children({ podcast, loading });
}
