import instance from './request';

export interface Journal {
    id: string;
    title: string;
    space_id: string;
    user_id: string;
    content: OutputData;
    date: string;
    created_at: number;
    updated_at: number;
}

export async function GetJournal(spaceID: string, date: string): Promise<Journal> {
    const resp = await instance.get(`/space/${spaceID}/journal`, {
        params: {
            date: date
        }
    });
    return resp.data.data;
}

export async function UpsertJournal(spaceID: string, date: string, content: any): Promise<void> {
    return await instance.put(`/space/${spaceID}/journal`, {
        date: date,
        content: content
    });
}

// date layout: "2006-01-02"
export async function ListJournals(spaceID: string, startDate: string, endDate: string): Promise<Journal[]> {
    const resp = await instance.get(`/space/${spaceID}/journal/list`, {
        params: {
            start_date: startDate,
            end_date: endDate
        }
    });

    return resp.data.data;
}
