import request from '@/apis/request';
import { Provider, ProviderFormData } from '@/types/ai-admin';

// API 响应格式
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// API 基础路径
const API_BASE = '/admin';

// 提供商相关接口
export const providerAPI = {
  // 获取提供商列表
  getProviders: async (params?: {
    page?: number;
    limit?: number;
    name?: string;
    status?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.name) queryParams.append('name', params.name);
    if (params?.status !== undefined) queryParams.append('status', params.status.toString());

    const url = `${API_BASE}/model/providers${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await request.get<ApiResponse<{
      list: Provider[];
      total: number;
      page: number;
      limit: number;
    }>>(url);
    return response.data.data;
  },

  // 获取提供商详情
  getProvider: async (id: string) => {
    const response = await request.get<ApiResponse<Provider>>(`${API_BASE}/model/providers/${id}`);
    return response.data.data;
  },

  // 创建提供商
  createProvider: async (data: ProviderFormData) => {
    const response = await request.post<ApiResponse<Provider>>(`${API_BASE}/model/providers`, {
      name: data.name,
      description: data.description,
      api_url: data.api_url,
      api_key: data.api_key,
      config: data.config
    });
    return response.data.data;
  },

  // 更新提供商
  updateProvider: async (id: string, data: ProviderFormData) => {
    const response = await request.put<ApiResponse<Provider>>(`${API_BASE}/model/providers/${id}`, {
      name: data.name,
      description: data.description,
      api_url: data.api_url,
      api_key: data.api_key,
      status: data.status,
      config: data.config
    });
    return response.data.data;
  },

  // 删除提供商
  deleteProvider: async (id: string) => {
    const response = await request.delete<ApiResponse<{ message: string }>>(`${API_BASE}/model/providers/${id}`);
    return response.data.data;
  },

  // 切换提供商状态
  toggleProviderStatus: async (id: string) => {
    // 先获取当前状态，然后切换
    const provider = await providerAPI.getProvider(id);
    const newStatus = provider.status === 1 ? 0 : 1;
    
    const response = await request.put<ApiResponse<Provider>>(`${API_BASE}/model/providers/${id}`, {
      status: newStatus
    });
    return response.data.data;
  }
};

// 模型配置相关接口
export const modelConfigAPI = {
  // 获取模型配置列表
  getModelConfigs: async (params?: {
    page?: number;
    limit?: number;
    provider_id?: string;
    model_type?: string;
    status?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.provider_id) queryParams.append('provider_id', params.provider_id);
    if (params?.model_type) queryParams.append('model_type', params.model_type);
    if (params?.status !== undefined) queryParams.append('status', params.status.toString());

    const url = `${API_BASE}/model/configs${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await request.get<ApiResponse<{
      list: any[];
      total: number;
      page: number;
      limit: number;
    }>>(url);
    return response.data.data;
  },

  // 获取模型配置详情
  getModelConfig: async (id: string) => {
    const response = await request.get<ApiResponse<any>>(`${API_BASE}/model/configs/${id}`);
    return response.data.data;
  },

  // 创建模型配置
  createModelConfig: async (data: any) => {
    const response = await request.post<ApiResponse<any>>(`${API_BASE}/model/configs`, data);
    return response.data.data;
  },

  // 更新模型配置
  updateModelConfig: async (id: string, data: any) => {
    const response = await request.put<ApiResponse<any>>(`${API_BASE}/model/configs/${id}`, data);
    return response.data.data;
  },

  // 删除模型配置
  deleteModelConfig: async (id: string) => {
    const response = await request.delete<ApiResponse<{ message: string }>>(`${API_BASE}/model/configs/${id}`);
    return response.data.data;
  }
};

// AI 系统管理相关接口
export const aiSystemAPI = {
  // 获取系统状态
  getSystemStatus: async () => {
    const response = await request.get<ApiResponse<{
      chat_drivers_count: number;
      embed_drivers_count: number;
      vision_drivers_count: number;
      rerank_drivers_count: number;
      reader_drivers_count: number;
      enhance_drivers_count: number;
      last_reload_time: number;
    }>>(`${API_BASE}/ai/system/status`);
    return response.data.data;
  },

  // 重新加载配置
  reloadConfig: async () => {
    const response = await request.post<ApiResponse<{
      message: string;
      time: number;
    }>>(`${API_BASE}/ai/system/reload`);
    return response.data.data;
  },

  // 获取使用配置
  getUsageConfig: async () => {
    const response = await request.get<ApiResponse<{
      chat: string;
      embedding: string;
      vision: string;
      rerank: string;
      reader: string;
      enhance: string;
    }>>(`${API_BASE}/ai/system/usage`);
    return response.data.data;
  },

  // 更新使用配置
  updateUsageConfig: async (data: {
    chat: string;
    embedding: string;
    vision?: string;
    rerank?: string;
    reader?: string;
    enhance?: string;
  }) => {
    const response = await request.put<ApiResponse<{
      message: string;
      configs: any[];
    }>>(`${API_BASE}/ai/system/usage`, data);
    return response.data.data;
  }
};