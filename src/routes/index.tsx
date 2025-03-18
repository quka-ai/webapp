import axios from 'axios';
import { ReactNode, useEffect, useMemo } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import { GetUserInfo, LoginWithAccessToken } from '@/apis/user';
import { App } from '@/App';
import { autoLoginDirect } from '@/lib/utils';
import Dashboard from '@/pages/dashboard';
import ChatSession from '@/pages/dashboard/chat/chat-session.tsx';
import Chat from '@/pages/dashboard/chat/chat.tsx';
import CreateKnowledge from '@/pages/dashboard/create-knowledge';
import EditKnowledge from '@/pages/dashboard/edit-knowledge';
import Journal from '@/pages/dashboard/journal/journal';
import Knowledge from '@/pages/dashboard/knowledge';
import Setting from '@/pages/dashboard/setting/setting';
import Forgot from '@/pages/forgot';
import IndexPage from '@/pages/index';
import Login from '@/pages/login';
import Reset from '@/pages/reset';
import ShareKnowledge from '@/pages/share/knowledge';
import ShareSessionPage from '@/pages/share/session';
import TestIframe from '@/pages/share/test-iframe';
import { buildTower } from '@/stores/socket';
import spaceStore, { loadUserSpaces, setCurrentSelectedSpace } from '@/stores/space';
import userStore, { logout, setUserInfo } from '@/stores/user';

function ProtectedRoute({ children }: { children: ReactNode }) {
    const { accessToken, loginToken, userInfo } = useSnapshot(userStore);
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { currentSelectedSpace, spaces } = useSnapshot(spaceStore);

    const isLogin = useMemo(() => {
        return accessToken || loginToken;
    }, [accessToken, loginToken]);

    useEffect(() => {
        if (pathname === '/dashboard' && currentSelectedSpace && userInfo) {
            navigate(`/dashboard/${currentSelectedSpace}/chat`, { replace: true });
            return;
        }

        if (isLogin && (!userInfo || !userInfo.userID)) {
            // load user info
            async function Login(type: string, accessToken: string) {
                try {
                    const resp = await GetUserInfo();
                    setUserInfo({
                        userID: resp.user_id,
                        // avatar: resp.avatar,
                        avatar: resp.avatar || 'https://avatar.vercel.sh/' + resp.user_id,
                        userName: resp.user_name,
                        email: resp.email,
                        planID: resp.plan_id,
                        serviceMode: resp.service_mode
                    });

                    await loadUserSpaces();

                    if (type == 'authorization') {
                        accessToken = `${accessToken}&token-type=authorization`;
                    }
                    buildTower(resp.user_id, accessToken, () => {
                        console.log('socket connected');
                    });
                } catch (e: any) {
                    if (axios.isAxiosError(e) && e.status === 403) {
                        logout();
                        navigate('/login');
                    }
                }
            }
            Login(accessToken ? '' : 'authorization', accessToken || loginToken);
        }
    }, [isLogin, currentSelectedSpace, spaces]);

    return isLogin ? children : <Navigate to="/login" />;
}

function PreLogin({ init, children }: { init: boolean; children: ReactNode }) {
    const { accessToken, loginToken, userInfo } = useSnapshot(userStore);
    const isLogin = useMemo(() => {
        return accessToken || loginToken;
    }, [accessToken, loginToken]);

    if (userInfo && userInfo.userID) {
        setCurrentSelectedSpace('');

        if (init) {
            if (autoLoginDirect()) {
                return <Navigate to="/dashboard" />;
            }

            return children;
        }
    }

    return isLogin ? <Navigate to="/dashboard" /> : children;
}

const routes = createBrowserRouter([
    {
        path: '*',
        element: <Navigate to="/" />
    },
    {
        path: '/',
        element: <App />,
        children: [
            {
                index: true,
                path: '/',
                element: (
                    <PreLogin init>
                        <IndexPage />
                    </PreLogin>
                )
            },
            {
                index: true,
                path: '/test',
                element: <TestIframe />
            },
            {
                path: '/login',
                element: (
                    <PreLogin>
                        <Login />
                    </PreLogin>
                )
            },
            {
                path: '/reset/password/:token',
                element: <Reset />
            },
            {
                path: '/forgot/password',
                element: <Forgot />
            },
            {
                path: '/s/k/:token', // /share/knowledge
                element: <ShareKnowledge />
            },
            {
                path: '/s/s/:token',
                element: <ShareSessionPage />
            },
            {
                path: '/dashboard/:spaceID/journal/:selectDate',
                element: (
                    <ProtectedRoute>
                        <Journal />
                    </ProtectedRoute>
                )
            },
            {
                path: '/dashboard/:spaceID/knowledge/create',
                element: (
                    <ProtectedRoute>
                        <CreateKnowledge />
                    </ProtectedRoute>
                )
            },
            {
                path: '/dashboard/:spaceID/knowledge/:knowledgeID/editor',
                element: (
                    <ProtectedRoute>
                        <EditKnowledge />
                    </ProtectedRoute>
                )
            },
            {
                path: '/dashboard/',
                element: (
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                ),
                children: [
                    {
                        path: ':spaceID/knowledge',
                        element: <Knowledge />
                    },
                    {
                        path: ':spaceID/chat',
                        element: <Chat />
                    },
                    {
                        path: ':spaceID/chat/session/:sessionID',
                        element: <ChatSession />
                    }
                ]
            },
            {
                path: '/user/*',
                element: (
                    <ProtectedRoute>
                        <Outlet />
                    </ProtectedRoute>
                ),
                children: [
                    {
                        path: 'setting',
                        element: <Setting />
                    }
                ]
            }
        ]
    }
]);

export default routes;
