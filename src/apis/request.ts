import axios, { AxiosError } from 'axios';
import { UNSAFE_ErrorResponseImpl } from 'react-router-dom';
import { toast } from 'sonner';

import i18n from '@/lib/i18n';
import userStore, { logout } from '@/stores/user';

const instance = axios.create({
    baseURL: userStore.host
});

export function ChangeBaseURL(url: string) {
    instance.defaults.baseURL = url;
}

export const ACCESS_TOKEN_KEY = 'X-Access-Token';
export const AUTH_TOKEN_KEY = 'X-Authorization';
export const ACCEPT_LANGUAGE_KEY = 'Accept-Language';

instance.interceptors.request.use(
    function (config) {
        // Do something before request is sent
        config.headers.setContentType('application/json');
        if (!config.headers.get(ACCESS_TOKEN_KEY) && userStore.accessToken) {
            config.headers.set(ACCESS_TOKEN_KEY, userStore.accessToken);
        }
        if (!config.headers.get(AUTH_TOKEN_KEY) && userStore.loginToken) {
            config.headers.set(AUTH_TOKEN_KEY, userStore.loginToken);
        }
        config.headers.set(ACCEPT_LANGUAGE_KEY, i18n.language);

        return config;
    },
    function (error) {
        // Do something with request error
        return Promise.reject(error);
    }
);

// Add a response interceptor
instance.interceptors.response.use(
    function (response) {
        // Any status code that lie within the range of 2xx cause this function to trigger
        // Do something with response data
        return response;
    },
    function (error) {
        // Any status codes that falls outside the range of 2xx cause this function to trigger
        // Do something with response error
        if (axios.isAxiosError(error)) {
            handleAxiosError(error);
        }

        return Promise.reject(error);
    }
);

function handleAxiosError(error: AxiosError) {
    if (error.status && error.status === 401) {
        logout();
    }

    toast.error(i18n.t('RequestError'), {
        description: error.response ? error.response.data.meta.message + ', ' + error.message : error.message
    });
}

export default instance;
