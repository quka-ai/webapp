'use client';

import { HeroUIProvider } from '@heroui/react';
import { enableMapSet } from 'immer';
import { Children, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Toaster as SonnerTotaster } from 'sonner';
import { subscribeKey } from 'valtio/utils';

import { ShareProvider } from './components/share-button';
import { setNotAutoLoginDirect } from './lib/utils';
import eventStore from './stores/event';

import { KnowledgeProvider } from '@/components/knowledge-drawer';
import { Toaster } from '@/components/ui/toaster';
import { useTheme } from '@/hooks/use-theme';
import '@/lib/i18n';

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

    return (
        <MyProvider>
            <Outlet />
            <Toaster />
            <SonnerTotaster theme={isDark ? 'dark' : 'light'} />
            <span className="bg-zinc-800" />
        </MyProvider>
    );
}

function MyProvider({ children }: { children: React.ReactNode }) {
    const navigate = useNavigate();

    return (
        <HeroUIProvider navigate={navigate}>
            <KnowledgeProvider>
                <ShareProvider>{children}</ShareProvider>
            </KnowledgeProvider>
        </HeroUIProvider>
    );
}
