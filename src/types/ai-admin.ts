// 模型提供商接口
export interface Provider {
    id: string;
    name: string;
    description: string;
    api_url: string;
    api_key: string;
    status: 0 | 1; // 0=禁用, 1=启用
    config: {
        timeout: number;
        max_retries: number;
        is_reader?: boolean;
        [key: string]: any;
    };
    created_at: number;
    updated_at: number;
}

// 模型配置接口
export interface ModelConfig {
    id: string;
    provider_id: string;
    model_name: string;
    display_name: string;
    model_type: 'chat' | 'embedding' | 'vision' | 'rerank' | 'reader' | 'enhance';
    is_multi_modal: boolean;
    status: 0 | 1;
    config: {
        max_tokens?: number;
        temperature?: number;
        top_p?: number;
        [key: string]: any;
    };
    created_at: number;
    updated_at: number;
    provider?: {
        id: string;
        name: string;
        api_url?: string;
    };
}

// 系统状态接口
export interface SystemStatus {
    chat_drivers_count: number;
    embed_drivers_count: number;
    vision_drivers_count: number;
    rerank_drivers_count: number;
    reader_drivers_count: number;
    enhance_drivers_count: number;
    last_reload_time: number;
}

// 使用配置接口
export interface UsageConfig {
    chat: string;
    embedding: string;
    vision: string;
    rerank: string;
    reader: string;
    enhance: string;
}

// 分页数据接口
export interface PaginationData<T> {
    list: T[];
    total: number;
    page: number;
    limit: number;
}

// API响应接口
export interface APIResponse<T> {
    code: number;
    message: string;
    data: T;
}

// 提供商状态管理接口
export interface ProviderStore {
    providers: Provider[];
    loading: boolean;
    error: string | null;
    pagination: {
        page: number;
        limit: number;
        total: number;
    };
    filters: {
        name: string;
        status: number | null;
    };
}

// 模型配置状态管理接口
export interface ModelStore {
    models: ModelConfig[];
    loading: boolean;
    error: string | null;
    pagination: {
        page: number;
        limit: number;
        total: number;
    };
    filters: {
        provider_id: string;
        model_type: string;
        status: number | null;
    };
}

// 系统状态管理接口
export interface SystemStore {
    status: SystemStatus | null;
    usageConfig: UsageConfig | null;
    loading: boolean;
    error: string | null;
    reloading: boolean;
}

// 表单数据接口
export interface ProviderFormData {
    name: string;
    description: string;
    api_url: string;
    api_key: string;
    status: 0 | 1;
    config: {
        timeout: number;
        max_retries: number;
        is_reader?: boolean;
        [key: string]: any;
    };
}

export interface ModelFormData {
    provider_id: string;
    model_name: string;
    display_name: string;
    model_type: 'chat' | 'embedding' | 'vision' | 'rerank' | 'reader' | 'enhance';
    is_multi_modal: boolean;
    status: 0 | 1;
    config: {
        max_tokens?: number;
        temperature?: number;
        top_p?: number;
        [key: string]: any;
    };
}

// 模型类型颜色映射
export const ModelTypeColors: Record<ModelConfig['model_type'], string> = {
    chat: 'primary',
    embedding: 'secondary',
    vision: 'success',
    rerank: 'warning',
    reader: 'danger',
    enhance: 'default'
};

// 状态颜色映射
export const StatusColors: Record<0 | 1, string> = {
    0: 'default',
    1: 'success'
};
