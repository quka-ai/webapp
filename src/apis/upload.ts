import axios from 'axios';

import instance from './request';

export interface CreateUploadKeyResponse {
    status: string;
    static_domain: string;
    url: string;
    full_path: string;
    key: string;
}

export async function CreateUploadKey(spaceID: string, object_type: string, kind: string, file_name: string, size: number): Promise<CreateUploadKeyResponse> {
    const resp = await instance.post(`/space/${spaceID}/object/upload/key`, {
        object_type,
        kind,
        file_name,
        size
    });

    return resp.data.data;
}

export async function UploadFileToKey(key: string, contentType: string, body: File): Promise<void> {
    await axios.put(key, body, {
        headers: {
            'Content-Type': contentType
        }
    });

    return;
}
