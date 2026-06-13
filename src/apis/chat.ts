/* eslint-disable import/order */
import instance from './request';

import {
    CreateHermesChatSession,
    DeleteHermesChatSession,
    GenHermesChatMessageID,
    GetHermesChatSessionHistory,
    GetHermesChatSessionList,
    GetHermesMessageExt,
    isHermesDesktopAvailable,
    NamedHermesChatSession,
    SendHermesChatMessage,
    StopHermesChatStream
} from '@/apis/hermes-desktop';
import type { AgentRun, ToolTips } from '@/types/chat';

export interface ChatMessageExt {
    rel_docs: RelDoc[];
    tool_name: string;
    tool_args: string;
    tool_tips?: ToolTips[];
    agent_run?: AgentRun;
}

export interface RelDoc {
    id: string;
    title: string;
    resource: string;
    space_id: string;
}

export async function GetMessageExt(spaceID: string, sessionID: string, messageID: string): Promise<ChatMessageExt> {
    if (isHermesDesktopAvailable()) {
        return GetHermesMessageExt();
    }

    const resp = await instance.get(`/${spaceID}/chat/${sessionID}/message/${messageID}/ext`);

    return resp.data.data;
}

export async function StopChatStream(spaceID: string, sessionID: string): Promise<void> {
    if (isHermesDesktopAvailable()) {
        return StopHermesChatStream(spaceID, sessionID);
    }

    await instance.post(`/${spaceID}/chat/${sessionID}/stop`);
}

export async function CreateChatSession(spaceID: string): Promise<string> {
    if (isHermesDesktopAvailable()) {
        return CreateHermesChatSession(spaceID);
    }

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
    latest_access_time: number;
}

export async function GetChatSessionList(spaceID: string, page: number, pageSize: number): Promise<ChatSessionList> {
    if (isHermesDesktopAvailable()) {
        return GetHermesChatSessionList(spaceID, page, pageSize);
    }

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
        tool_name: string;
        tool_args: string;
        tool_tips?: ToolTips[];
        agent_run?: AgentRun;
    };
}

export async function GetChatSessionHistory(spaceID: string, sessionID: string, afterSequence: number = 0, page: number, pageSize: number): Promise<ChatMessageList> {
    if (isHermesDesktopAvailable()) {
        return GetHermesChatSessionHistory(spaceID, sessionID, page, pageSize);
    }

    const resp = await instance.get(`/${spaceID}/chat/${sessionID}/history/list`, {
        params: {
            page: page,
            pagesize: pageSize,
            after_sequence: afterSequence
        }
    });

    return resp.data.data;
}

export async function GenChatMessageID(spaceID: string, sessionID: string): Promise<string> {
    if (isHermesDesktopAvailable()) {
        return GenHermesChatMessageID();
    }

    const resp = await instance.post(`/${spaceID}/chat/${sessionID}/message/id`);

    return resp.data.data;
}

export interface SendMessageArgs {
    messageID: string;
    message: string;
    agent: string;
    enableThinking: boolean;
    enableSearch: boolean;
    enableKnowledge: boolean;
    files?: Attach[];
}

export interface SendMessageResponse {
    sequence: number;
    answer_id: string;
}

export async function SendMessage(spaceID: string, sessionID: string, args: SendMessageArgs): Promise<SendMessageResponse> {
    console.info('[hermes] SendMessage called', {
        desktop: isHermesDesktopAvailable(),
        spaceID,
        sessionID,
        messageID: args.messageID,
        messageLength: args.message.length
    });
    if (isHermesDesktopAvailable()) {
        return SendHermesChatMessage(spaceID, sessionID, args);
    }

    const resp = await instance.post(`/${spaceID}/chat/${sessionID}/message`, {
        message_id: args.messageID,
        message: args.message,
        agent: args.agent,
        files: args.files,
        enable_thinking: args.enableThinking,
        enable_search: args.enableSearch,
        enable_knowledge: args.enableKnowledge
    });

    return resp.data.data;
}

export interface ChatSessionNamedResult {
    session_id: string;
    name: string;
}

export async function NamedChatSession(spaceID: string, sessionID: string, firstMessage: string): Promise<ChatSessionNamedResult> {
    if (isHermesDesktopAvailable()) {
        return NamedHermesChatSession(spaceID, sessionID, firstMessage);
    }

    const resp = await instance.put(`/${spaceID}/chat/${sessionID}/named`, {
        first_message: firstMessage
    });

    return resp.data.data;
}

export async function DeleteChatSession(spaceID: string, sessionID: string): Promise<void> {
    if (isHermesDesktopAvailable()) {
        return DeleteHermesChatSession(spaceID, sessionID);
    }

    await instance.delete(`/${spaceID}/chat/${sessionID}`);
}
