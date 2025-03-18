import { OutputData } from '@editorjs/editorjs';

import instance from './request';

export interface Knowledge {
    content: string;
    content_type: string;
    blocks: OutputData;
    id: string;
    kind: string;
    maybe_date: string;
    resource: string;
    retry_times: string;
    space_id: string;
    stage: number;
    summary: string;
    tags: string[];
    title: string;
    user_id: string;
    created_at: number;
    updated_at: number;
}

export interface ListKnowledgeResponse {
    list: Knowledge[];
    total: number;
}

export async function ListKnowledge(spaceID: string, keywords: string, resource: string = '', page: number, pageSize: number): Promise<ListKnowledgeResponse> {
    const resp = await instance.get(`/${spaceID}/knowledge/list`, {
        params: {
            page: page,
            pagesize: pageSize,
            keywords,
            resource
        }
    });

    return resp.data.data;
}

export async function GetKnowledge(spaceID: string, knowledgeID: string): Promise<Knowledge> {
    const resp = await instance.get(`/${spaceID}/knowledge`, {
        params: {
            id: knowledgeID
        }
    });

    return resp.data.data;
}

export async function CreateKnowledge(spaceID: string, resource: string, content: string, content_type: string, async: boolean = true): Promise<string> {
    const resp = await instance.post(`/${spaceID}/knowledge`, {
        resource,
        content,
        content_type,
        async
    });

    return resp.data.data.id;
}

export interface UpdateKnowledgeArgs {
    title: string;
    content: string;
    content_type: string;
    tags: string[];
    resource: string;
    kind?: string;
}

export async function UpdateKnowledge(spaceID: string, id: string, args: UpdateKnowledgeArgs): Promise<void> {
    await instance.put(`/${spaceID}/knowledge`, {
        id,
        ...args
    });
}

export async function DeleteKnowledge(spaceID: string, id: string): Promise<void> {
    await instance.delete(`/${spaceID}/knowledge`, {
        data: {
            id
        }
    });
}

interface QueryResponse {
    refs: QueryRefs[];
    message: string;
}

interface QueryRefs {
    id: string;
    knowledge_id: string;
    cos: number;
}

export async function Query(spaceID: string, query: string): Promise<QueryResponse> {
    const resp = await instance.post(`/${spaceID}/knowledge/query`, {
        query
    });

    return resp.data.data;
}

export interface KnowledgeLite {
    id: string;
    space_id: string;
    resource: string;
    title: string;
    tags: string[];
    user_id: string;
}

export async function GetTimeRangeLiteKnowledges(spaceID: string, st: number, et: number): Promise<KnowledgeLite[]> {
    const resp = await instance.get(`/${spaceID}/knowledge/time/list`, {
        params: {
            start_time: st,
            end_time: et
        }
    });

    return resp.data.data;
}

