import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

export const useChatPageCondition = () => {
    const { pathname } = useLocation();

    const isChat = useMemo(() => {
        return pathname.indexOf('/chat') !== -1;
    }, [pathname]);

    const isSession = useMemo(() => {
        return isChat && pathname.indexOf(`/chat/session`) !== -1;
    }, [pathname, isChat]);

    return { isChat, isSession };
};
