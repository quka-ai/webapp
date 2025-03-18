import instance from './request';

import userStore from '@/stores/user';

export interface SharedKnowledge {
    user_id: string;
    user_name: string;
    user_avatar: string;
    knowledge_id: string;
    space_id: string;
    kind: string;
    title: string;
    tags: string[];
    content: any;
    content_type: string;
    created_at: number;
}

export async function GetSharedKnowledge(token: string): Promise<SharedKnowledge> {
    let resp = await instance.get(`/share/knowledge/${token}`);

    return resp.data.data;
}

export interface CreateKnowledgeShareURLResponse {
    token: string;
    url: string;
}

export async function CreateKnowledgeShareURL(spaceID: string, embeddingURL: string, knowledgeID: string): Promise<CreateKnowledgeShareURLResponse> {
    let resp = await instance.post(`/space/${spaceID}/knowledge/share`, {
        embedding_url: embeddingURL,
        knowledge_id: knowledgeID
    });

    return resp.data.data;
}

export interface CreateSessionShareURLResponse {
    token: string;
    url: string;
}

export async function CreateSessionShareURL(spaceID: string, embeddingURL: string, sessionID: string): Promise<CreateSessionShareURLResponse> {
    let resp = await instance.post(`/space/${spaceID}/session/share`, {
        embedding_url: embeddingURL,
        session_id: sessionID
    });

    return resp.data.data;
}
// type SessionShareInfo struct {
// 	User     *types.User          `json:"user"`
// 	Session  *types.ChatSession   `json:"chat_session"`
// 	Messages []*types.ChatMessage `json:"messages"`
// }

export interface SharedSessionUser {
    id: string;
    name: string;
    avatar: string;
    email: string;
    plan_id: string;
}

export interface SharedSession {
    id: string;
    title: string;
    user_id: string;
    space_id: string;
    created_at: number;
}

export interface SharedSessionMessage {
    id: string;
    sequence: number;
    send_time: number;
    role: number;
    user_id: string;
    session_id: string;
    complete: number;
    message_type: number;
}

export interface SharedSessionDetail {
    user: SharedSessionUser;
    session: SharedSession;
    messages: SharedSessionMessage[];
}

export async function GetSharedSession(token: string): Promise<SharedSessionDetail> {
    const res = await instance.get(`/share/session/${token}`);

    return res.data.data;
}

export async function CopyKnowledge(shareToken: string, spaceID: string, resource: string): Promise<void> {
    await instance.post('/share/copy/knowledge', {
        token: shareToken,
        user_space: spaceID,
        user_resource: resource
    });
}
