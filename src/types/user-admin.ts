/**
 * 用户管理相关的TypeScript类型定义
 */

// 用户全局角色枚举
export enum GlobalRole {
    CHIEF = 'role-chief',
    ADMIN = 'role-admin',
    MEMBER = 'role-member'
}

// 用户对象类型
export interface User {
    id: string;
    appid: string;
    name: string;
    email: string;
    plan_id: string;
    global_role: GlobalRole;
    created_at: number;
    updated_at: number;
}

// 创建用户请求类型
export interface CreateUserRequest {
    name: string;
    email: string;
}

// 创建用户响应类型
export interface CreateUserResponse {
    user_id: string;
    name: string;
    email: string;
    access_token: string;
    created_at: number;
}

// 用户列表查询参数类型
export interface UserListParams {
    page?: number;
    pagesize?: number;
    name?: string;
    email?: string;
    global_role?: GlobalRole | '';
}

// 用户列表响应类型
export interface UserListResponse {
    list: User[];
    total: number;
}

// 重新生成Token请求类型
export interface RegenerateTokenRequest {
    user_id: string;
}

// 重新生成Token响应类型
export interface RegenerateTokenResponse {
    user_id: string;
    access_token: string;
}

// 删除用户请求类型
export interface DeleteUserRequest {
    user_id: string;
}

// 删除用户响应类型
export interface DeleteUserResponse {
    user_id: string;
    message: string;
}

// API统一响应格式类型
export interface ApiResponse<T> {
    meta: {
        code: number;
        message: string;
        request_id: string;
    };
    data: T;
}

// 表单数据类型
export interface UserFormData {
    name: string;
    email: string;
}

// 用户操作状态类型
export interface UserActionState {
    regeneratingTokenIds: Set<string>;
    creatingUser: boolean;
}

// 用户列表过滤器类型
export interface UserFilters {
    search: string;
    global_role: GlobalRole | '';
}

// 分页配置类型
export interface PaginationConfig {
    page: number;
    pageSize: number;
    total: number;
}

// 用户卡片显示数据类型
export interface UserCardData extends User {
    sourceLabel: string;
    formattedCreatedAt: string;
    formattedUpdatedAt: string;
}

// 表单验证错误类型
export interface FormErrors {
    name?: string;
    email?: string;
}

// 用户操作结果类型
export type UserActionResult = {
    success: boolean;
    message?: string;
    data?: any;
};
