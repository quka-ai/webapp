'use client';

import { HeroUIProvider, ToastProvider } from '@heroui/react';
import { enableMapSet } from 'immer';
import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Toaster as SonnerTotaster } from 'sonner';
import { subscribeKey } from 'valtio/utils';

// import VConsole from 'vconsole';
import { ShareProvider } from './components/share-button';
import { useMedia } from './hooks/use-media';
import { setNotAutoLoginDirect } from './lib/utils';
import eventStore from './stores/event';

import { KnowledgeProvider } from '@/components/knowledge-drawer';
import { Toaster } from '@/components/ui/toaster';
import { useTheme } from '@/hooks/use-theme';
import { Init as InitI18n } from '@/lib/i18n';

// 或者使用配置参数进行初始化
// const vConsole = new VConsole({ theme: 'dark' });

export function App({ children }: { children: React.ReactNode }) {
    const { theme, isDark } = useTheme();
    const navigate = useNavigate();

    enableMapSet();

    const [currentTheme, setCurrentTheme] = useState(theme);

    useEffect(() => {
        const unSubscribe = subscribeKey(eventStore, 'themeChange', (theme: string) => {
            setCurrentTheme(theme);
        });

        return unSubscribe;
    });

    useEffect(() => {
        const link = document.createElement('link');

        link.rel = 'stylesheet';
        link.id = 'highlight-theme';
        link.href = isDark ? '/css/hljs-github-dark.min.css' : '/css/hljs-github.min.css';
        document.head.appendChild(link);

        // 清除之前加载的主题样式
        return () => {
            const existingLink = document.getElementById('highlight-theme');

            if (existingLink) {
                existingLink.remove();
            }
        };
    }, [currentTheme]);

    setTimeout(() => {
        setNotAutoLoginDirect();
    }, 2000);

    const { isMobile } = useMedia();

    return (
        <MyProvider>
            <Outlet />
            <Toaster />
            <SonnerTotaster theme={isDark ? 'dark' : 'light'} position={isMobile ? 'top-right' : 'bottom-right'} />
        </MyProvider>
    );
}

function MyProvider({ children }: { children: React.ReactNode }) {
    const [isInit, setIsInit] = useState(false);
    async function init() {
        await InitI18n();
        setIsInit(true);
    }
    useEffect(() => {
        init();
    }, []);

    const navigate = useNavigate();

    return (
        <>
            {isInit && (
                <HeroUIProvider navigate={navigate}>
                    <ToastProvider
                        toastProps={{
                            variant: 'flat',
                            timeout: 2000,
                            classNames: {
                                closeButton: 'opacity-100 absolute right-4 top-1/2 -translate-y-1/2'
                            }
                        }}
                    />
                    <KnowledgeProvider>
                        <ShareProvider>{children}</ShareProvider>
                    </KnowledgeProvider>
                </HeroUIProvider>
            )}
        </>
    );
}
