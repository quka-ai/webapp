import instance from './request';

import type { Podcast } from '@/stores/podcast';

export interface GetPodcastsParams {
    source_type?: string;
    status?: string;
    page?: number;
    pagesize?: number;
}

interface PodcastsListData {
    podcasts: Podcast[];
    total: number;
}

interface CreatePodcastData {
    id: string;
    status: Podcast['status'];
}

interface BatchCreatePodcastsData {
    created_count: number;
    podcast_ids: string[];
}

/**
 * 获取播客列表
 */
export async function getPodcasts(spaceId: string, params: GetPodcastsParams = {}): Promise<PodcastsListData> {
    const resp = await instance.get(`/${spaceId}/podcasts`, {
        params: {
            source_type: params.source_type,
            status: params.status,
            page: params.page || 1,
            pagesize: params.pagesize || 20
        }
    });

    return resp.data.data;
}

/**
 * 获取单个播客
 */
export async function getPodcast(spaceId: string, id: string): Promise<Podcast> {
    const resp = await instance.get(`/${spaceId}/podcasts/${id}`);
    return resp.data.data;
}

/**
 * 根据源获取播客
 */
export async function getPodcastBySource(spaceId: string, sourceType: string, sourceId: string): Promise<Podcast | null> {
    try {
        const resp = await instance.get(`/${spaceId}/podcasts/source`, {
            params: {
                source_type: sourceType,
                source_id: sourceId
            }
        });
        return resp.data.data;
    } catch (error: any) {
        if (error.response?.data?.error?.code === 'PODCAST_NOT_FOUND') {
            return null;
        }
        throw error;
    }
}

/**
 * 创建播客
 */
export async function createPodcast(spaceId: string, sourceType: string, sourceId: string): Promise<CreatePodcastData> {
    const resp = await instance.post(`/${spaceId}/podcasts`, {
        source_type: sourceType,
        source_id: sourceId
    });
    return resp.data.data;
}

/**
 * 批量创建播客
 */
export async function batchCreatePodcasts(spaceId: string, sourceType: string, sourceIds: string[]): Promise<BatchCreatePodcastsData> {
    const resp = await instance.post(`/${spaceId}/podcasts/batch`, {
        source_type: sourceType,
        source_ids: sourceIds
    });
    return resp.data.data;
}

/**
 * 重新生成播客
 */
export async function regeneratePodcast(spaceId: string, id: string): Promise<void> {
    await instance.post(`/${spaceId}/podcasts/${id}/regenerate`);
}

/**
 * 删除播客
 */
export async function deletePodcast(spaceId: string, id: string): Promise<void> {
    await instance.delete(`/${spaceId}/podcasts/${id}`);
}
