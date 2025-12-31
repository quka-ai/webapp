import instance from './request';

import type { ApiResponse, CreateRSSSubscriptionRequest, RSSDigest, RSSDigestItem, RSSSubscription, UpdateRSSSubscriptionRequest } from '@/@types/rss';

/**
 * 创建 RSS 订阅
 * @param spaceId - 空间ID
 * @param data - 订阅数据
 * @returns 创建的订阅信息
 */
export async function createRSSSubscription(spaceId: string, data: CreateRSSSubscriptionRequest): Promise<RSSSubscription> {
    const resp = await instance.post<ApiResponse<RSSSubscription>>(`/${spaceId}/rss/subscriptions`, data);
    return resp.data.data;
}

/**
 * 获取 RSS 订阅列表
 * @param spaceId - 空间ID
 * @returns 订阅列表
 */
export async function getRSSSubscriptions(spaceId: string): Promise<RSSSubscription[]> {
    const resp = await instance.get<ApiResponse<RSSSubscription[]>>(`/${spaceId}/rss/subscriptions`);
    return resp.data.data;
}

/**
 * 获取 RSS 订阅详情
 * @param spaceId - 空间ID
 * @param subscriptionId - 订阅ID
 * @returns 订阅详情
 */
export async function getRSSSubscription(spaceId: string, subscriptionId: string): Promise<RSSSubscription> {
    const resp = await instance.get<ApiResponse<RSSSubscription>>(`/${spaceId}/rss/subscriptions/${subscriptionId}`);
    return resp.data.data;
}

/**
 * 更新 RSS 订阅
 * @param spaceId - 空间ID
 * @param subscriptionId - 订阅ID
 * @param data - 更新数据
 */
export async function updateRSSSubscription(spaceId: string, subscriptionId: string, data: UpdateRSSSubscriptionRequest): Promise<void> {
    await instance.put(`/${spaceId}/rss/subscriptions/${subscriptionId}`, data);
}

/**
 * 删除 RSS 订阅
 * @param spaceId - 空间ID
 * @param subscriptionId - 订阅ID
 */
export async function deleteRSSSubscription(spaceId: string, subscriptionId: string): Promise<void> {
    await instance.delete(`/${spaceId}/rss/subscriptions/${subscriptionId}`);
}

/**
 * 手动触发 RSS 抓取
 * @param spaceId - 空间ID
 * @param subscriptionId - 订阅ID
 */
export async function triggerRSSFetch(spaceId: string, subscriptionId: string): Promise<{ message: string }> {
    const resp = await instance.post<ApiResponse<{ message: string }>>(`/${spaceId}/rss/subscriptions/${subscriptionId}/fetch`);
    return resp.data.data;
}

/**
 * 获取 RSS 摘要
 * @param spaceId - 空间ID
 * @param date - 日期 (YYYY-MM-DD格式，不填则默认为前一天)
 * @returns 摘要信息
 */
export async function getRSSDigest(spaceId: string, date?: string): Promise<RSSDigest | null> {
    try {
        const url = date ? `/${spaceId}/rss/digest/daily?date=${date}` : `/${spaceId}/rss/digest/daily`;
        const resp = await instance.get<ApiResponse<RSSDigest>>(url);
        return resp.data.data;
    } catch (error) {
        // 如果指定日期没有摘要，返回 null
        return null;
    }
}

/**
 * 获取今日 RSS 摘要 (向后兼容的别名)
 * @param spaceId - 空间ID
 * @returns 今日摘要
 */
export async function getTodayRSSDigest(spaceId: string): Promise<RSSDigest | null> {
    return getRSSDigest(spaceId);
}

/**
 * 验证 RSS URL 并获取 Feed 信息
 * @param url - RSS Feed URL
 * @returns Feed 信息（标题和描述）
 */
export async function verifyRssUrl(url: string): Promise<{ title: string; description: string } | null> {
    try {
        const resp = await instance.post<ApiResponse<{ title: string; description: string }>>('/rss/verify', { url });
        return resp.data.data;
    } catch (error) {
        console.error('Failed to verify RSS URL:', error);
        return null;
    }
}

/**
 * 手动生成 RSS 摘要
 * @param spaceId - 空间ID
 * @param date - 日期 (YYYY-MM-DD格式，不填则默认为前一天)
 * @returns 生成的摘要信息
 */
export async function generateRSSDigest(spaceId: string, date?: string): Promise<RSSDigest> {
    const resp = await instance.post<ApiResponse<RSSDigest>>(`/${spaceId}/rss/digest/generate`, { date });
    return resp.data.data;
}

/**
 * 获取历史摘要列表
 * @param spaceId - 空间ID
 * @param params - 查询参数
 * @returns 历史摘要列表
 */
export async function getRSSDigestHistory(
    spaceId: string,
    params?: {
        start_date?: string;
        end_date?: string;
        limit?: number;
    }
): Promise<RSSDigestItem[]> {
    const searchParams = new URLSearchParams();
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    if (params?.limit) searchParams.append('limit', String(params.limit));

    const url = `/${spaceId}/rss/digest/history${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const resp = await instance.get<ApiResponse<RSSDigestItem[]>>(url);
    return resp.data.data;
}

/**
 * 获取摘要详情
 * @param spaceId - 空间ID
 * @param digestId - 摘要ID
 * @returns 摘要详情
 */
export async function getRSSDigestDetail(spaceId: string, digestId: string): Promise<RSSDigest> {
    const resp = await instance.get<ApiResponse<RSSDigest>>(`/${spaceId}/rss/digest/${digestId}`);
    return resp.data.data;
}

/**
 * 删除摘要
 * @param spaceId - 空间ID
 * @param digestId - 摘要ID
 */
export async function deleteRSSDigest(spaceId: string, digestId: string): Promise<void> {
    await instance.delete(`/${spaceId}/rss/digest/${digestId}`);
}
