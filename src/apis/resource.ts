import instance from './request';

export interface Resource {
    id: string;
    title: string;
    space_id: string;
    description: string;
    tag: string;
    cycle: number;
    created_at: number;
}

export async function CreateResource(spaceID: string, id: string, title: string, cycle: number, tag: string, description: string): Promise<void> {
    await instance.post(`/${spaceID}/resource`, {
        id,
        title,
        description,
        cycle: Number(cycle),
        tag: tag
    });
}

export async function UpdateResource(spaceID: string, id: string, title: string, cycle: number, tag: string, description: string): Promise<void> {
    await instance.put(`/${spaceID}/resource`, {
        id,
        title,
        description,
        cycle: Number(cycle),
        tag: tag
    });
}

export async function ListResources(spaceID: string): Promise<Resource[]> {
    let resp = await instance.get(`/${spaceID}/resource/list`);

    return resp.data.data.list;
}

export async function DeleteResource(spaceID: string, resourceID: string): Promise<void> {
    await instance.delete(`/${spaceID}/resource/${resourceID}`);
}
