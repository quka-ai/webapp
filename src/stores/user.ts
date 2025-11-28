import { proxy } from 'valtio';

import { ChangeBaseURL } from '@/apis/request';
import { closeSocket } from '@/stores/socket';

const userStore = proxy<UserStore>({
    accessToken: localStorage.getItem('access_token'),
    loginToken: localStorage.getItem('login_token'),
    userInfo: {
        userID: '',
        userName: '',
        avatar: '',
        email: '',
        planID: '',
        serviceMode: '',
        appid: '',
        systemRole: ''
    },
    host: localStorage.getItem('self-host') || import.meta.env.VITE_BASE_URL
});

export const setHost = (host: string) => {
    userStore.host = host;
    localStorage.setItem('self-host', host);
    ChangeBaseURL(host);
};

export const logout = () => {
    closeSocket();
    userStore.accessToken = '';
    userStore.loginToken = '';
    //@ts-ignore
    userStore.userInfo = {};
    localStorage.removeItem('access_token');
    localStorage.removeItem('login_token');
};

export const setUserAccessToken = (token: string) => {
    userStore.accessToken = token;
    localStorage.setItem('access_token', token);
};

export const setUserLoginToken = (token: string) => {
    userStore.loginToken = token;
    localStorage.setItem('login_token', token);
};

export const setUserInfo = (userInfo?: UserInfo) => {
    if (!userInfo) {
        userStore.userInfo = {
            email: '',
            userID: '',
            userName: '',
            avatar: '',
            planID: '',
            serviceMode: '',
            appid: '',
            systemRole: ''
        };

        return;
    }
    userStore.userInfo = {
        userID: userInfo.userID || userStore.userInfo.userID,
        userName: userInfo.userName || userStore.userInfo.userName,
        avatar: userInfo.avatar || userStore.userInfo.avatar,
        email: userInfo.email || userStore.userInfo.email,
        planID: userInfo.planID || userStore.userInfo.planID,
        serviceMode: userInfo.serviceMode || userStore.userInfo.serviceMode,
        appid: userInfo.appid || userStore.userInfo.appid,
        systemRole: userInfo.systemRole || userStore.userInfo.systemRole
    };
};

export default userStore;
