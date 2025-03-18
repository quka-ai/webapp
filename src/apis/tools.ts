import instance from './request';

export async function DescribeImage(url: string): Promise<string> {
    const resp = await instance.post(`/tools/describe/image`, {
        url: url
    });

    return resp.data.data.content;
}

export interface ReadResponse {
    warning: string;
    title: string;
    description: string;
    url: string;
    content: string;
    usage: {
        tokens: number;
    };
}

export async function Reader(url: string): Promise<ReadResponse> {
    const resp = await instance.get(`/tools/reader`, {
        params: {
            endpoint: url
        }
    });

    return resp.data.data;
}
