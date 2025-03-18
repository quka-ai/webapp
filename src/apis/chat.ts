import instance from './request';

export interface ChatMessageExt {
    rel_docs: RelDoc[];
}

export interface RelDoc {
    id: string;
    title: string;
    resource: string;
    space_id: string;
}

export async function GetMessageExt(spaceID: string, sessionID: string, messageID: string): Promise<ChatMessageExt> {
    const resp = await instance.get(`/${spaceID}/chat/${sessionID}/message/${messageID}/ext`);

    return resp.data.data;
}

export async function CreateChatSession(spaceID: string): Promise<string> {
    const resp = await instance.post(`/${spaceID}/chat`);

    return resp.data.data.session_id;
}

export interface ChatSessionList {
    list: ChatSession[];
    total: number;
}

export interface ChatSession {
    id: string;
    title: string;
    user_id: string;
    space_id: string;
    latest_access_time: string;
}

export async function GetChatSessionList(spaceID: string, page: number, pageSize: number): Promise<ChatSessionList> {
    const resp = await instance.get(`/${spaceID}/chat/list`, {
        params: {
            page: page,
            pagesize: pageSize
        }
    });

    return resp.data.data;
}

export interface ChatMessageList {
    list: MessageDetail[];
    total: number;
}

export interface MessageDetail {
    meta: {
        message_id: string;
        sequence: number;
        send_time: number;
        role: number;
        user_id: string;
        session_id: string;
        complete: number;
        message_type: number;
        message: {
            text: string;
        };
        attach: Attach[];
    };
    ext?: {
        is_read: boolean | null;
        rel_docs: RelDoc[];
        evaluate: number;
        is_evaluate_enable: boolean;
    };
}

export async function GetChatSessionHistory(spaceID: string, sessionID: string, afterMsgID: string = '', page: number, pageSize: number): Promise<ChatMessageList> {
    const resp = await instance.get(`/${spaceID}/chat/${sessionID}/history/list`, {
        params: {
            page: page,
            pagesize: pageSize,
            after_message_id: afterMsgID
        }
    });

    return resp.data.data;
}

export async function GenChatMessageID(spaceID: string, sessionID: string): Promise<string> {
    const resp = await instance.post(`/${spaceID}/chat/${sessionID}/message/id`);

    return resp.data.data;
}

export interface SendMessageArgs {
    messageID: string;
    message: string;
    agent: string;
    files?: Attach[];
}

export interface SendMessageResponse {
    sequence: number;
}

export async function SendMessage(spaceID: string, sessionID: string, args: SendMessageArgs): Promise<SendMessageResponse> {
    const resp = await instance.post(`/${spaceID}/chat/${sessionID}/message`, {
        message_id: args.messageID,
        message: args.message,
        agent: args.agent,
        files: args.files
    });

    return resp.data.data;
}

export interface ChatSessionNamedResult {
    session_id: string;
    name: string;
}

export async function NamedChatSession(spaceID: string, sessionID: string, firstMessage: string): Promise<ChatSessionNamedResult> {
    const resp = await instance.put(`/${spaceID}/chat/${sessionID}/named`, {
        first_message: firstMessage
    });

    return resp.data.data;
}
