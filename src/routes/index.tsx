import axios from 'axios';
import { Button, Spinner } from '@heroui/react';
import { KeepAliveOutlet } from 'keepalive-react-router';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createBrowserRouter, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import { GetUserInfo } from '@/apis/user';
import { App } from '@/App';
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
import PodcastDetail from '@/pages/dashboard/podcast/[id]';
import PodcastList from '@/pages/dashboard/podcast/podcasts';
import RSSDigestDetail from '@/pages/dashboard/rss-digest/[id]/page';
import RSSDigest from '@/pages/dashboard/rss-digest/page';
import RSSSubscriptions from '@/pages/dashboard/rss-subscriptions';
import Setting from '@/pages/dashboard/setting/setting';
import SpaceSetting from '@/pages/dashboard/space-setting/setting';
import UserAdmin from '@/pages/dashboard/user-admin/user-admin';
import Users from '@/pages/dashboard/user-admin/users/users';
import Forgot from '@/pages/forgot';
import Login from '@/pages/login';
import Reset from '@/pages/reset';
import ShareKnowledge from '@/pages/share/knowledge';
import PodcastSharePage from '@/pages/share/podcast';
import ShareSessionPage from '@/pages/share/session';
import SpaceLandingPage from '@/pages/space-landing';
import Test from '@/pages/test';
import { setLoginRedirect } from '@/stores/event';
import { buildTower } from '@/stores/socket';
import spaceStore, { loadUserSpaces } from '@/stores/space';
import userStore, { logout, setUserInfo } from '@/stores/user';

function ProtectedRoute({ children }: { children: ReactNode }) {
    const { t } = useTranslation('backend-availability');
    const { accessToken, loginToken, userInfo } = useSnapshot(userStore);
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { currentSelectedSpace, spaces } = useSnapshot(spaceStore);
    const loadingUserInfo = useRef(false);
    const loadingSpaces = useRef(false);
    const [spacesLoadFinished, setSpacesLoadFinished] = useState(false);
    const isDashboardHome = pathname === '/dashboard' || pathname === '/dashboard/';

    function reloadSpaces() {
        if (loadingSpaces.current) return;
        loadingSpaces.current = true;
        setSpacesLoadFinished(false);
        loadUserSpaces().finally(() => {
            loadingSpaces.current = false;
            setSpacesLoadFinished(true);
        });
    }

    const isLogin = useMemo(() => {
        return accessToken || loginToken;
    }, [accessToken, loginToken]);

    useEffect(() => {
        if (isDashboardHome && currentSelectedSpace && userInfo) {
            navigate(`/dashboard/${currentSelectedSpace}/chat`, { replace: true });
            return;
        }

        if (isLogin && (!userInfo || !userInfo.userID) && !loadingUserInfo.current) {
            loadingUserInfo.current = true;
            // load user info
            async function Login(type: string, accessToken: string) {
                try {
                    const resp = await GetUserInfo();
                    setUserInfo({
                        appid: resp.appid,
                        userID: resp.user_id,
                        avatar: processAvatarUrl(resp.avatar, resp.user_id, true),
                        userName: resp.user_name,
                        email: resp.email,
                        planID: resp.plan_id,
                        serviceMode: resp.service_mode,
                        systemRole: resp.system_role
                    });

                    buildTower(resp.user_id, resp.appid, accessToken, type, () => {
                        console.log('socket connected');
                    });
                } catch (e: any) {
                    if (axios.isAxiosError(e) && e.status === 403) {
                        logout();
                        navigate('/login');
                    }
                } finally {
                    loadingUserInfo.current = false;
                }
            }
            Login(accessToken ? 'access' : 'authorization', accessToken || loginToken || '');
        }

        if (isLogin && userInfo?.userID && spaces.length === 0 && !loadingSpaces.current && !spacesLoadFinished) {
            reloadSpaces();
        }
    }, [isLogin, userInfo?.userID, currentSelectedSpace, spaces.length, isDashboardHome, spacesLoadFinished]);

    if (isLogin && isDashboardHome && !currentSelectedSpace) {
        return <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
            {spacesLoadFinished ? <p>{t('workspaceLoadFailed')}</p> : <><Spinner /><p>{t('workspaceLoading')}</p></>}
            {spacesLoadFinished && <Button color="primary" onPress={reloadSpaces}>{t('retry')}</Button>}
        </div>;
    }

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
        if (init) {
            if (autoLoginDirect()) {
                return <Navigate to="/dashboard" />;
            }

            return children;
        }
    }

    return isLogin ? (
        <>
            <Navigate to="/dashboard" />
        </>
    ) : (
        children
    );
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
                path: '/s/p/:token', // /share/podcast
                element: <PodcastSharePage />
            },
            {
                path: '/s/sp/:token',
                element: (
                    <ProtectedRoute>
                        <SpaceLandingPage />
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
                path: '/dashboard/:spaceID/rss-subscriptions',
                element: (
                    <ProtectedRoute>
                        <RSSSubscriptions />
                    </ProtectedRoute>
                )
            },
            {
                path: '/dashboard/:spaceID/rss-digest',
                element: (
                    <ProtectedRoute>
                        <RSSDigest />
                    </ProtectedRoute>
                )
            },
            {
                path: '/dashboard/:spaceID/rss-digest/:id',
                element: (
                    <ProtectedRoute>
                        <RSSDigestDetail />
                    </ProtectedRoute>
                )
            },
            {
                path: '/dashboard/',
                element: (
                    <ProtectedRoute>
                        <KeepAliveOutlet />
                    </ProtectedRoute>
                ),
                children: [
                    {
                        path: ':spaceID',
                        element: <Dashboard />,
                        children: [
                            {
                                path: 'knowledge',
                                element: <Knowledge />,
                                handle: { keepAlive: true }
                            },
                            {
                                path: 'chat',
                                element: <Chat />
                            },
                            {
                                path: 'chat/session/:sessionID',
                                element: <ChatSession />
                            }
                        ]
                    },
                    {
                        path: ':spaceID/knowledge/create',
                        element: <CreateKnowledge />
                    },
                    {
                        path: ':spaceID/knowledge/:knowledgeID/editor',
                        element: <EditKnowledge />
                    }
                ]
            },
            {
                path: '/dashboard/:spaceID/podcasts',
                element: (
                    <ProtectedRoute>
                        <PodcastList />
                    </ProtectedRoute>
                )
            },
            {
                path: '/dashboard/:spaceID/podcasts/:id',
                element: (
                    <ProtectedRoute>
                        <PodcastDetail />
                    </ProtectedRoute>
                )
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
