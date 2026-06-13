import type { PartialBlock } from '@blocknote/core';

import instance from './request';

export type FixedPinContent = PartialBlock[];

export interface FixedPin {
    id: string;
    space_id: string;
    user_id: string;
    content: FixedPinContent;
    content_type: 'blocks_v2';
    created_at: number;
    updated_at: number;
}

export async function GetFixedPin(spaceID: string): Promise<FixedPin | null> {
    const resp = await instance.get(`/${spaceID}/fixed-pin`);

    return resp.data.data;
}

export async function UpsertFixedPin(spaceID: string, content: FixedPinContent): Promise<FixedPin> {
    const resp = await instance.put(`/${spaceID}/fixed-pin`, {
        content,
        content_type: 'blocks_v2'
    });

    return resp.data.data;
}

export async function DeleteFixedPin(spaceID: string): Promise<void> {
    await instance.delete(`/${spaceID}/fixed-pin`);
}
