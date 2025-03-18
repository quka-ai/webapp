import instance from './request';

export interface ChunkTask {
    task_id: string;
    space_id: string;
    user_id: string;
    user_name: string;
    user_avatar: string;
    user_email: string;
    resource: string;
    resource_title: string;
    file_url: string;
    file_name: string;
    status: number;
    retry_times: number;
    task_type: string;
    created_at: number;
    updated_at: number;
}

export interface GetTaskListResponse {
    list: ChunkTask[];
    total: number;
}

export async function GetTaskList(spaceID: string, page: number, pagesize: number): Promise<GetTaskListResponse> {
    const resp = await instance.get(`/${spaceID}/task/list`, {
        params: {
            page: page,
            pagesize: pagesize
        }
    });
    return resp.data.data;
}

export async function DeleteTask(spaceID: string, taskID: string): Promise<void> {
    await instance.delete(`/${spaceID}/task/file-chunk`, {
        data: { task_id: taskID }
    });
}

export async function CreateFileChunkTask(spaceID: string, meta: string, resource: string, fileName: string, fileURL: string): Promise<void> {
    await instance.post(`/${spaceID}/task/file-chunk`, {
        meta_info: meta,
        resource: resource,
        file_name: fileName,
        file_url: fileURL
    });
}

export interface TaskStatus {
    task_id: string;
    status: number;
    updated_at: number;
    retry_times: number;
}

export async function LoadTasksStatus(spaceID: string, taskIDs: string[]): Promise<TaskStatus[]> {
    const resp = await instance.get(`/${spaceID}/task/status`, {
        params: {
            task_ids: taskIDs
        }
    });
    return resp.data.data;
}
