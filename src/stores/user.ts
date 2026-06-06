import { proxy } from 'valtio';

import { ChangeBaseURL } from '@/apis/request';
import { closeSocket } from '@/stores/socket';

const ACCESS_TOKEN_STORAGE_KEY = 'access_token';
const LOGIN_TOKEN_STORAGE_KEY = 'login_token';
const LEGACY_ACCESS_TOKEN_STORAGE_KEY = 'accessToken';
const LEGACY_LOGIN_TOKEN_STORAGE_KEY = 'loginToken';

function removeStoredAccessToken() {
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    localStorage.removeItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY);
}

function removeStoredLoginToken() {
    localStorage.removeItem(LOGIN_TOKEN_STORAGE_KEY);
    localStorage.removeItem(LEGACY_LOGIN_TOKEN_STORAGE_KEY);
}

function readInitialTokens(): Pick<UserStore, 'accessToken' | 'loginToken'> {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || localStorage.getItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY) || '';
    const loginToken = localStorage.getItem(LOGIN_TOKEN_STORAGE_KEY) || localStorage.getItem(LEGACY_LOGIN_TOKEN_STORAGE_KEY) || '';

    if (accessToken) {
        localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
        removeStoredLoginToken();
        return {
            accessToken,
            loginToken: ''
        };
    }

    if (loginToken) {
        localStorage.setItem(LOGIN_TOKEN_STORAGE_KEY, loginToken);
        removeStoredAccessToken();
        return {
            accessToken: '',
            loginToken
        };
    }

    removeStoredAccessToken();
    removeStoredLoginToken();
    return {
        accessToken: '',
        loginToken: ''
    };
}

const initialTokens = readInitialTokens();

const userStore = proxy<UserStore>({
    accessToken: initialTokens.accessToken,
    loginToken: initialTokens.loginToken,
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
    removeStoredAccessToken();
    removeStoredLoginToken();
};

export const setUserAccessToken = (token: string) => {
    userStore.accessToken = token;
    userStore.loginToken = '';
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    removeStoredLoginToken();
};

export const setUserLoginToken = (token: string) => {
    userStore.accessToken = '';
    userStore.loginToken = token;
    removeStoredAccessToken();
    localStorage.setItem(LOGIN_TOKEN_STORAGE_KEY, token);
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
