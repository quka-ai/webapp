import { useMemo } from 'react';
import { useSnapshot } from 'valtio';

import userStore from '@/stores/user';
import { Role } from '@/types';

export function usePlan(): { userIsPro: boolean; isPlatform: boolean; userPlan: string } {
    const { userInfo } = useSnapshot(userStore);

    const userIsPro = useMemo(() => {
        return userInfo && userInfo.planID && userInfo.planID != '';
    }, [userInfo]);

    const userPlan = useMemo(() => {
        if (userInfo.planID == '') return '';
        if (userInfo.planID.startsWith('pro')) {
            return 'Pro';
        }
        return userInfo.planID;
    }, [userInfo]);

    const isPlatform = useMemo(() => {
        return userInfo && userInfo.serviceMode == 'saas';
    }, [userInfo]);

    return { userIsPro, isPlatform, userPlan };
}
