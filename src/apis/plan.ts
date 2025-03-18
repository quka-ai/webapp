import instance from './request';

export interface Plan {
    title: string;
    plan_id: string;
    features: string[];
    plan_cycle: string;
    price: number;
}

export async function GetPlanList(): Promise<Plan[]> {
    const res = await instance.get(`/plan/list`);
    return res.data.data;
}

export interface RedeemGiftCodeResponse {
    title: string;
    gift: number;
}

export async function RedeemGiftCode(code: string): Promise<RedeemGiftCodeResponse> {
    const res = await instance.post('/user/redeem/giftcode', {
        code
    });
    return res.data.data;
}
