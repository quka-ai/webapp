import { useSnapshot } from 'valtio';

import userStore from '@/stores/user';

export default function useUserAvatar() {
    const { userInfo } = useSnapshot(userStore);

    return userInfo.avatar ? userInfo.avatar : 'https://avatar.vercel.sh/' + userInfo.userID;
}
