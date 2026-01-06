import { proxy } from 'valtio';

import type { RSSDigest, RSSDigestItem, RSSSubscription } from '@/@types/rss';
import { deleteRSSDigest, generateRSSDigest, getRSSDigest, getRSSDigestDetail, getRSSDigestHistory, getRSSSubscriptions, getTodayRSSDigest } from '@/apis/rss';

interface RSSStore {
    subscriptions: RSSSubscription[] | undefined;
    todayDigest: RSSDigest | null | undefined;
    digestHistory: RSSDigestItem[] | undefined;
    currentDigest: RSSDigest | undefined;
    loading: boolean;
    loadingHistory: boolean;
    loadingDigest: boolean;
}

const rssStore = proxy<RSSStore>({
    subscriptions: undefined,
    todayDigest: undefined,
    digestHistory: undefined,
    currentDigest: undefined,
    loading: false,
    loadingHistory: false,
    loadingDigest: false
});

/**
 * 设置订阅列表
 */
export const setSubscriptions = (subscriptions: RSSSubscription[]) => {
    rssStore.subscriptions = subscriptions;
};

/**
 * 设置今日摘要
 */
export const setTodayDigest = (digest: RSSDigest | null) => {
    rssStore.todayDigest = digest;
};

/**
 * 设置历史摘要列表
 */
export const setDigestHistory = (history: RSSDigestItem[]) => {
    rssStore.digestHistory = history;
};

/**
 * 设置当前摘要详情
 */
export const setCurrentDigest = (digest: RSSDigest | undefined) => {
    rssStore.currentDigest = digest;
};

/**
 * 设置加载状态
 */
export const setLoading = (loading: boolean) => {
    rssStore.loading = loading;
};

/**
 * 设置历史摘要加载状态
 */
export const setLoadingHistory = (loading: boolean) => {
    rssStore.loadingHistory = loading;
};

/**
 * 设置摘要详情加载状态
 */
export const setLoadingDigest = (loading: boolean) => {
    rssStore.loadingDigest = loading;
};

/**
 * 加载订阅列表
 */
export const loadSubscriptions = async (spaceId: string): Promise<RSSSubscription[]> => {
    try {
        setLoading(true);
        const subscriptions = await getRSSSubscriptions(spaceId);
        setSubscriptions(subscriptions);
        return subscriptions;
    } catch (error) {
        console.error('Failed to load RSS subscriptions:', error);
        return [];
    } finally {
        setLoading(false);
    }
};

/**
 * 加载今日摘要
 */
export const loadTodayDigest = async (spaceId: string): Promise<RSSDigest | null> => {
    try {
        const digest = await getTodayRSSDigest(spaceId);
        if (digest && digest.article_count > 0) {
            setTodayDigest(digest);
            return digest;
        }

        return null;
    } catch (error) {
        console.error('Failed to load today digest:', error);
        setTodayDigest(null);
        return null;
    }
};

/**
 * 添加订阅到列表
 */
export const addSubscription = (subscription: RSSSubscription) => {
    if (rssStore.subscriptions) {
        rssStore.subscriptions = [...rssStore.subscriptions, subscription];
    } else {
        rssStore.subscriptions = [subscription];
    }
};

/**
 * 更新订阅
 */
export const updateSubscriptionInStore = (subscriptionId: string, updates: Partial<RSSSubscription>) => {
    if (rssStore.subscriptions) {
        rssStore.subscriptions = rssStore.subscriptions.map(sub => (sub.id === subscriptionId ? { ...sub, ...updates } : sub));
    }
};

/**
 * 从列表中删除订阅
 */
export const removeSubscription = (subscriptionId: string) => {
    if (rssStore.subscriptions) {
        rssStore.subscriptions = rssStore.subscriptions.filter(sub => sub.id !== subscriptionId);
    }
};

/**
 * 加载历史摘要列表
 */
export const loadDigestHistory = async (spaceId: string, params?: { start_date?: string; end_date?: string; limit?: number }): Promise<RSSDigestItem[]> => {
    try {
        setLoadingHistory(true);
        const history = await getRSSDigestHistory(spaceId, params);
        setDigestHistory(history);
        return history;
    } catch (error) {
        console.error('Failed to load digest history:', error);
        setDigestHistory([]);
        return [];
    } finally {
        setLoadingHistory(false);
    }
};

/**
 * 加载摘要详情
 */
export const loadDigestDetail = async (spaceId: string, digestId: string): Promise<RSSDigest | null> => {
    try {
        setLoadingDigest(true);
        const digest = await getRSSDigestDetail(spaceId, digestId);
        setCurrentDigest(digest);
        return digest;
    } catch (error) {
        console.error('Failed to load digest detail:', error);
        setCurrentDigest(undefined);
        return null;
    } finally {
        setLoadingDigest(false);
    }
};

/**
 * 手动生成摘要
 */
export const loadDigestByDate = async (spaceId: string, date?: string): Promise<RSSDigest | null> => {
    try {
        const digest = await getRSSDigest(spaceId, date);
        return digest;
    } catch (error) {
        console.error('Failed to load digest:', error);
        return null;
    }
};

/**
 * 生成新摘要
 */
export const generateDigest = async (spaceId: string, date?: string): Promise<RSSDigest> => {
    try {
        const digest = await generateRSSDigest(spaceId, date);
        // 更新今日摘要（如果生成的是今天的）
        if (!date || date === getYesterdayDate()) {
            setTodayDigest(digest);
        }
        return digest;
    } catch (error) {
        console.error('Failed to generate digest:', error);
        throw error;
    }
};

/**
 * 删除摘要
 */
export const removeDigest = async (spaceId: string, digestId: string): Promise<void> => {
    try {
        await deleteRSSDigest(spaceId, digestId);
        // 从历史列表中移除
        if (rssStore.digestHistory) {
            rssStore.digestHistory = rssStore.digestHistory.filter(item => item.id !== digestId);
        }
        // 如果删除的是当前摘要，清除当前摘要
        if (rssStore.currentDigest?.id === digestId) {
            setCurrentDigest(undefined);
        }
    } catch (error) {
        console.error('Failed to delete digest:', error);
        throw error;
    }
};

/**
 * 添加摘要到历史列表
 */
export const addDigestToHistory = (digest: RSSDigestItem) => {
    if (rssStore.digestHistory) {
        rssStore.digestHistory = [digest, ...rssStore.digestHistory];
    } else {
        rssStore.digestHistory = [digest];
    }
};

/**
 * 从历史列表移除摘要
 */
export const removeDigestFromHistory = (digestId: string) => {
    if (rssStore.digestHistory) {
        rssStore.digestHistory = rssStore.digestHistory.filter(item => item.id !== digestId);
    }
};

/**
 * 获取昨天的日期字符串 (YYYY-MM-DD)
 */
const getYesterdayDate = (): string => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
};

export default rssStore;
