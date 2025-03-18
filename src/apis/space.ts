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

export async function ListSpaceUsers(spaceID: string, page: number, pagesize: number): Promise<ListSpaceUsersResponse> {
    let resp = await instance.get(`/space/${spaceID}/users`, {
        params: {
            page: page,
            pagesize: pagesize
        }
    });

    return resp.data.data;
}
