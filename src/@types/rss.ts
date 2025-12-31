/**
 * RSS 订阅相关类型定义
 */

/**
 * RSS 订阅信息
 */
export interface RSSSubscription {
    id: string;
    user_id: string;
    space_id: string;
    resource_id: string;
    url: string;
    title: string;
    description: string;
    category: string;
    update_frequency: number; // 更新频率（秒）
    last_fetched_at: number; // Unix 时间戳
    enabled: boolean;
    created_at: number;
    updated_at: number;
}

/**
 * 创建订阅请求参数
 */
export interface CreateRSSSubscriptionRequest {
    resource_id: string;
    url: string;
    title?: string;
    description?: string;
    category?: string;
    update_frequency?: number;
}

/**
 * 更新订阅请求参数
 */
export interface UpdateRSSSubscriptionRequest {
    title?: string;
    description?: string;
    category?: string;
    update_frequency?: number;
    enabled?: boolean;
    resource_id?: string;
}

/**
 * RSS 每日摘要
 */
export interface RSSDigest {
    id: string;
    date: string; // YYYY-MM-DD
    content: string; // Markdown 格式
    article_count: number; // 文章总数
    article_ids: number[]; // 文章 ID 列表
    model: string; // AI 模型名称
    generated_at: number; // 生成时间戳
}

/**
 * RSS 摘要列表项（用于历史列表，不包含 content 字段）
 */
export interface RSSDigestItem {
    id: string;
    date: string; // YYYY-MM-DD
    article_count: number; // 文章总数
    model: string; // AI 模型名称
    generated_at: number; // 生成时间戳
}

/**
 * API 响应元数据
 */
export interface ApiMeta {
    code: number;
    message: string;
    request_id: string;
}

/**
 * API 响应格式
 */
export interface ApiResponse<T> {
    meta: ApiMeta;
    data: T;
}

/**
 * 更新频率选项
 */
export const UPDATE_FREQUENCY_OPTIONS = [
    { value: 900, label: '15分钟' },
    { value: 1800, label: '30分钟' },
    { value: 3600, label: '1小时' },
    { value: 10800, label: '3小时' },
    { value: 21600, label: '6小时' },
    { value: 43200, label: '12小时' },
    { value: 86400, label: '24小时' }
] as const;
