import { proxy } from 'valtio';

import type { GetPodcastsParams } from '@/apis/podcast';
import { createPodcast, deletePodcast, getPodcast, getPodcasts, regeneratePodcast } from '@/apis/podcast';

export interface Podcast {
    id: string;
    user_id: string;
    space_id: string;
    source_type: 'knowledge' | 'journal' | 'rss_digest';
    source_id: string;
    title: string;
    description: string;
    tags: readonly string[];
    audio_url?: string;
    audio_duration?: number;
    audio_size?: number;
    audio_format?: string;
    tts_provider: string;
    tts_model: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error_message?: string;
    retry_times: number;
    created_at: number;
    updated_at: number;
    generated_at?: number;
    generation_last_updated?: number;
}

interface PodcastStore {
    podcasts: Podcast[] | undefined;
    currentPodcast: Podcast | undefined;
    loading: boolean;
    loadingDetail: boolean;
    creatingMap: Record<string, { id: string; status: Podcast['status'] }>;
    pollingMap: Record<string, NodeJS.Timeout>;
}

const podcastStore = proxy<PodcastStore>({
    podcasts: undefined,
    currentPodcast: undefined,
    loading: false,
    loadingDetail: false,
    creatingMap: proxy({}),
    pollingMap: proxy({})
});

/**
 * 设置播客列表
 */
export const setPodcasts = (podcasts: Podcast[] | undefined) => {
    podcastStore.podcasts = podcasts;
};

/**
 * 设置当前播客
 */
export const setCurrentPodcast = (podcast: Podcast | undefined) => {
    podcastStore.currentPodcast = podcast;
};

/**
 * 设置加载状态
 */
export const setLoading = (loading: boolean) => {
    podcastStore.loading = loading;
};

/**
 * 设置详情加载状态
 */
export const setLoadingDetail = (loading: boolean) => {
    podcastStore.loadingDetail = loading;
};

/**
 * 添加正在创建的播客
 */
export const addCreatingPodcast = (sourceId: string, id: string, status: Podcast['status']) => {
    podcastStore.creatingMap[sourceId] = { id, status };
};

/**
 * 更新创建中的播客状态
 */
export const updateCreatingPodcast = (sourceId: string, status: Podcast['status']) => {
    if (podcastStore.creatingMap[sourceId]) {
        podcastStore.creatingMap[sourceId].status = status;
    }
};

/**
 * 移除正在创建的播客
 */
export const removeCreatingPodcast = (sourceId: string) => {
    delete podcastStore.creatingMap[sourceId];
};

/**
 * 从播客列表中移除播客
 */
export const removePodcastFromStore = (podcastId: string) => {
    if (podcastStore.podcasts) {
        podcastStore.podcasts = podcastStore.podcasts.filter(p => p.id !== podcastId);
    }
};

/**
 * 更新播客列表中的播客
 */
export const updatePodcastInStore = (podcast: Podcast) => {
    if (podcastStore.podcasts) {
        const index = podcastStore.podcasts.findIndex(p => p.id === podcast.id);
        if (index !== -1) {
            podcastStore.podcasts[index] = podcast;
        }
    }
    if (podcastStore.currentPodcast?.id === podcast.id) {
        podcastStore.currentPodcast = podcast;
    }
};

/**
 * 开始轮询播客状态
 */
export const startPolling = (podcastId: string, interval: NodeJS.Timeout) => {
    podcastStore.pollingMap[podcastId] = interval;
};

/**
 * 停止轮询播客状态
 */
export const stopPolling = (podcastId: string) => {
    if (podcastStore.pollingMap[podcastId]) {
        clearInterval(podcastStore.pollingMap[podcastId]);
        delete podcastStore.pollingMap[podcastId];
    }
};

/**
 * 停止所有轮询
 */
export const stopAllPolling = () => {
    Object.values(podcastStore.pollingMap).forEach(interval => {
        clearInterval(interval);
    });
    podcastStore.pollingMap = {};
};

/**
 * 加载播客列表
 */
export const loadPodcasts = async (spaceId: string, params?: GetPodcastsParams) => {
    try {
        setLoading(true);
        const result = await getPodcasts(spaceId, params);
        setPodcasts(result.podcasts);
        return result.podcasts;
    } catch (error) {
        console.error('Failed to load podcasts:', error);
        throw error;
    } finally {
        setLoading(false);
    }
};

/**
 * 加载单个播客
 */
export const loadPodcast = async (spaceId: string, id: string) => {
    try {
        setLoadingDetail(true);
        const podcast = await getPodcast(spaceId, id);
        setCurrentPodcast(podcast);
        return podcast;
    } catch (error) {
        console.error('Failed to load podcast:', error);
        throw error;
    } finally {
        setLoadingDetail(false);
    }
};

/**
 * 创建播客
 */
export const createPodcastAndPoll = async (spaceId: string, sourceType: string, sourceId: string) => {
    try {
        const result = await createPodcast(spaceId, sourceType, sourceId);
        addCreatingPodcast(sourceId, result.id, result.status);

        // 开始轮询
        const pollInterval = setInterval(async () => {
            try {
                const podcast = await getPodcast(spaceId, result.id);
                updateCreatingPodcast(sourceId, podcast.status);
                updatePodcastInStore(podcast);

                if (podcast.status === 'completed' || podcast.status === 'failed') {
                    stopPolling(result.id);
                    removeCreatingPodcast(sourceId);
                }
            } catch (error) {
                console.error('Polling error:', error);
                stopPolling(result.id);
                removeCreatingPodcast(sourceId);
            }
        }, 5000);

        startPolling(result.id, pollInterval);

        // 5 分钟后停止轮询
        setTimeout(() => {
            stopPolling(result.id);
            removeCreatingPodcast(sourceId);
        }, 300000);

        return result;
    } catch (error) {
        console.error('Failed to create podcast:', error);
        throw error;
    }
};

/**
 * 重新生成播客
 */
export const regeneratePodcastAndReload = async (spaceId: string, podcastId: string) => {
    try {
        await regeneratePodcast(spaceId, podcastId);
        // 重新加载播客
        const podcast = await loadPodcast(spaceId, podcastId);
        return podcast;
    } catch (error) {
        console.error('Failed to regenerate podcast:', error);
        throw error;
    }
};

/**
 * 删除播客
 */
export const deletePodcastAndRemove = async (spaceId: string, podcastId: string) => {
    try {
        await deletePodcast(spaceId, podcastId);
        removePodcastFromStore(podcastId);
        if (podcastStore.currentPodcast?.id === podcastId) {
            setCurrentPodcast(undefined);
        }
    } catch (error) {
        console.error('Failed to delete podcast:', error);
        throw error;
    }
};

export default podcastStore;
