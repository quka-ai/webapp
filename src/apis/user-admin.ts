/**
 * 用户管理API接口封装
 */
import type {
    ApiResponse,
    CreateUserRequest,
    CreateUserResponse,
    DeleteUserRequest,
    DeleteUserResponse,
    RegenerateTokenRequest,
    RegenerateTokenResponse,
    UserListParams,
    UserListResponse
} from '@/types/user-admin';

import request from './request';
import request from './request';


export const userAdminAPI = {
    /**
     * 获取用户列表
     * @param params 查询参数
     * @returns 用户列表响应
     */
    getUserList: async (params?: UserListParams) => {
        const queryParams = new URLSearchParams();

        if (params?.page) {
            queryParams.append('page', params.page.toString());
        }
        if (params?.pagesize) {
            queryParams.append('pagesize', params.pagesize.toString());
        }
        if (params?.name && params.name.trim()) {
            queryParams.append('name', params.name.trim());
        }
        if (params?.email && params.email.trim()) {
            queryParams.append('email', params.email.trim());
        }
        if (params?.global_role) {
            queryParams.append('global_role', params.global_role);
        }

        const queryString = queryParams.toString();
        const url = `/admin/users${queryString ? `?${queryString}` : ''}`;

        const response = await request.get<ApiResponse<UserListResponse>>(url);
        return response.data.data;
    },

    /**
     * 创建用户
     * @param data 创建用户请求数据
     * @returns 创建用户响应
     */
    createUser: async (data: CreateUserRequest) => {
        const response = await request.post<ApiResponse<CreateUserResponse>>('/admin/users', data);
        return response.data.data;
    },

    /**
     * 重新生成用户AccessToken
     * @param data 重新生成Token请求数据
     * @returns 重新生成Token响应
     */
    regenerateToken: async (data: RegenerateTokenRequest) => {
        const response = await request.post<ApiResponse<RegenerateTokenResponse>>('/admin/users/token', data);
        return response.data.data;
    },

    /**
     * 删除用户
     * @param data 删除用户请求数据
     * @returns 删除用户响应
     */
    deleteUser: async (data: DeleteUserRequest) => {
        const response = await request.delete<ApiResponse<DeleteUserResponse>>('/admin/users', {
            data
        });
        return response.data.data;
    }
};

export default userAdminAPI;
