import { useMemo } from 'react';

export function useUserAgent(): { isSafari: boolean } {
    const isSafari = useMemo(() => {
        const ua = navigator.userAgent;
        if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
            return true;
        }

        return false;
    }, []);

    return { isSafari };
}
