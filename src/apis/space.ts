import instance from './request';

export async function ListUserSpace(): Promise<UserSpace[]> {
    let resp = await instance.get(`/space/list`);

    return resp.data.data.list;
}

export async function CreateUserSpace(title: string, description: string, basePrompt: string, chatPrompt: string): Promise<void> {
    await instance.post(`/space`, {
        title,
        description,
        base_prompt: basePrompt,
        chat_prompt: chatPrompt
    });
}

export async function UpdateUserSpace(spaceID: string, title: string, description: string, basePrompt: string, chatPrompt: string): Promise<void> {
    await instance.put(`/space/${spaceID}`, {
        title,
        description,
        base_prompt: basePrompt,
        chat_prompt: chatPrompt
    });
}

export async function DeleteUserSpace(spaceID: string): Promise<void> {
    await instance.delete(`/space/${spaceID}`);
}

export interface SpaceUser {
    user_id: string;
    name: string;
    avatar: string;
    email: string;
    role: string;
    created_at: number;
}

export interface ListSpaceUsersResponse {
    list: SpaceUser[];
    total: number;
}

export async function ListSpaceUsers(spaceID: string, keywords: string, page: number, pagesize: number): Promise<ListSpaceUsersResponse> {
    let resp = await instance.get(`/space/${spaceID}/users`, {
        params: {
            keywords: keywords,
            page: page,
            pagesize: pagesize
        }
    });

    return resp.data.data;
}
export interface SpaceApplicationItem {
    user: SpaceApplicationUser;
    desc: string;
    user_id: string;
    status: string;
    id: string;
}

export interface SpaceApplicationUser {
    id: string;
    name: string;
    email: string;
    avatar: string;
}

export interface ListSpaceApplicationUsersResponse {
    list: SpaceApplicationItem[];
    total: number;
}

export async function ListSpaceApplicationUsers(spaceID: string, keywords: string, page: number, pagesize: number): Promise<ListSpaceApplicationUsersResponse> {
    let resp = await instance.get(`/space/${spaceID}/application/users`, {
        params: {
            keywords: keywords,
            page: page,
            pagesize: pagesize
        }
    });

    return resp.data.data;
}

export async function HandlerSpaceApplication(spaceID: string, ids: string[], status: string): Promise<void> {
    await instance.put(`/space/${spaceID}/application/handler`, {
        ids: ids,
        status: status
    });
}

export interface SpaceLandingDetail {
    id: string;
    title: string;
    desc: string;
    space_id: string;
    user: {
        id: string;
        name: string;
        avatar: string;
    };
    application_status: string;
}

export async function GetSpaceLandingDetail(token: string): Promise<SpaceLandingDetail> {
    let resp = await instance.get(`/space/landing/${token}`);

    return resp.data.data;
}

export async function ApplySpace(spaceToken: string, desc: string): Promise<void> {
    let resp = await instance.post(`/space/landing/${spaceToken}/apply`, {
        desc
    });

    return resp.data.data;
}