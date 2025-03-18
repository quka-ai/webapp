import { TokensIcon } from '@radix-ui/react-icons';

import instance from './request';

export interface LoginResponse {
    email: string;
    user_name: string;
    user_id: string;
    avatar: string;
    service_mode: string;
    plan_id: string;
}

export async function LoginWithAccessToken(accessToken: string): Promise<LoginResponse> {
    const resp = await instance.get(`/user/info`, {
        headers: {
            'X-Access-Token': accessToken
        }
    });

    return resp.data.data;
}

export async function GetUserInfo(): Promise<LoginResponse> {
    const resp = await instance.get(`/user/info`);

    return resp.data.data;
}

export interface EmailLoginResponse {
    meta: LoginResponse;
    token: string;
    expire_at: number;
}

export async function Login(email: string, password: string): Promise<EmailLoginResponse> {
    const resp = await instance.post(`/login`, {
        email: email,
        password: password
    });

    return resp.data.data;
}

export async function UpdateUserProfile(userName: string, email: string, avatar: string): Promise<void> {
    return await instance.put(`/user/profile`, {
        user_name: userName,
        email: email,
        avatar: avatar
    });
}

export async function SendVerifyEmail(email: string): Promise<void> {
    return await instance.post(`/signup/verify/email`, {
        email: email
    });
}

export async function Signup(email: string, userName: string, spaceName: string, password: string, verifyCode: string): Promise<void> {
    return await instance.post('/signup', {
        email: email,
        user_name: userName,
        init_work_space: spaceName,
        password: password,
        verify_code: verifyCode
    });
}

export async function ResetPassword(token: string, password: string): Promise<void> {
    return await instance.put('/profile/password/reset', {
        token: token,
        password: password
    });
}

export async function RequestResetPassword(endpoint: string, email: string): Promise<string> {
    const resp = await instance.post('/profile/password/request_reset', {
        endpoint: endpoint,
        email: email
    });

    resp.data.data;
}

export interface UserPlanDescription {
    user_id: string;
    plan_id: string;
    start_time: number;
    end_time: number;
}

export async function GetUserPlanDescription(): Promise<UserPlanDescription> {
    const resp = await instance.get('/user/plan');
    return resp.data.data;
}

export async function ListUserResources(): Promise<Resource[]> {
    const resp = await instance.get('/resource/list');
    return resp.data.data.list;
}

export interface AccessToken {
    id: number;
    user_id: string;
    token: string;
    desc: string;
    created_at: number;
    expires_at: number;
}

export async function ListUserAccessTokens(page: number, pagesize: number): Promise<AccessToken[]> {
    const resp = await instance.get('/user/secret/tokens', {
        params: {
            page: page,
            pagesize: pagesize
        }
    });

    return resp.data.data.list;
}

export async function CreateUserAccessToken(desc: string): Promise<string> {
    const resp = await instance.post('/user/secret/token', {
        desc: desc
    });

    return resp.data.data;
}

export async function DeleteUserAccessTokens(ids: number[]): Promise<void> {
    await instance.delete('/user/secret/tokens', {
        data: {
            ids: ids
        }
    });
}
