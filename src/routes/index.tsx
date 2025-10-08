import axios from 'axios';
import { ReactNode, useEffect, useMemo } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import { GetUserInfo } from '@/apis/user';
import { App } from '@/App';
import ToolUsing from '@/components/tool-using';
import { autoLoginDirect, processAvatarUrl } from '@/lib/utils';
import Dashboard from '@/pages/dashboard';
import AIAdmin from '@/pages/dashboard/ai-admin/ai-admin';
import Models from '@/pages/dashboard/ai-admin/models/models';
import Providers from '@/pages/dashboard/ai-admin/providers/providers';
import System from '@/pages/dashboard/ai-admin/system/system';
import Usage from '@/pages/dashboard/ai-admin/usage/usage';
import ChatSession from '@/pages/dashboard/chat/chat-session.tsx';
import Chat from '@/pages/dashboard/chat/chat.tsx';
import CreateKnowledge from '@/pages/dashboard/create-knowledge';
import EditKnowledge from '@/pages/dashboard/edit-knowledge';
import Journal from '@/pages/dashboard/journal/journal';
import Knowledge from '@/pages/dashboard/knowledge';
import Setting from '@/pages/dashboard/setting/setting';
import SpaceSetting from '@/pages/dashboard/space-setting/setting';
import UserAdmin from '@/pages/dashboard/user-admin/user-admin';
import Users from '@/pages/dashboard/user-admin/users/users';
import Forgot from '@/pages/forgot';
import Login from '@/pages/login';
import Reset from '@/pages/reset';
import ShareKnowledge from '@/pages/share/knowledge';
import ShareSessionPage from '@/pages/share/session';
import SpaceLnadingPage from '@/pages/space-landing';
import Test from '@/pages/test';
import { setLoginRedirect } from '@/stores/event';
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
                        avatar: processAvatarUrl(resp.avatar, resp.user_id, true),
                        userName: resp.user_name,
                        email: resp.email,
                        planID: resp.plan_id,
                        serviceMode: resp.service_mode,
                        appid: resp.appid
                    });

                    await loadUserSpaces();

                    buildTower(resp.user_id, resp.appid, accessToken, type, () => {
                        console.log('socket connected');
                    });
                } catch (e: any) {
                    if (axios.isAxiosError(e) && e.status === 403) {
                        logout();
                        navigate('/login');
                    }
                }
            }
            Login(accessToken ? '' : 'authorization', accessToken || loginToken || '');
        }
    }, [isLogin, currentSelectedSpace, spaces]);

    return isLogin
        ? children
        : (() => {
              setLoginRedirect(pathname);
              return <Navigate to="/login" />;
          })();
}

function PreLogin({ init, children }: { init?: boolean; children: ReactNode }) {
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
        element: <App>{<Outlet />}</App>,
        children: [
            {
                path: '/test',
                element: <Test />
            },
            {
                index: true,
                path: '/',
                element: (
                    <PreLogin init>
                        <Login />
                    </PreLogin>
                )
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
                path: '/s/sp/:token',
                element: (
                    <ProtectedRoute>
                        <SpaceLnadingPage />
                    </ProtectedRoute>
                )
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
                path: '/dashboard/space-setting/:spaceID',
                element: (
                    <ProtectedRoute>
                        <SpaceSetting />
                    </ProtectedRoute>
                )
            },
            {
                path: '/dashboard/ai-admin',
                element: (
                    <ProtectedRoute>
                        <AIAdmin />
                    </ProtectedRoute>
                ),
                children: [
                    {
                        path: 'providers',
                        element: <Providers />
                    },
                    {
                        path: 'models',
                        element: <Models />
                    },
                    {
                        path: 'system',
                        element: <System />
                    },
                    {
                        path: 'usage',
                        element: <Usage />
                    }
                ]
            },
            {
                path: '/dashboard/user-admin',
                element: (
                    <ProtectedRoute>
                        <UserAdmin />
                    </ProtectedRoute>
                ),
                children: [
                    {
                        path: 'users',
                        element: <Users />
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
