import {
    Button,
    Card,
    CardBody,
    CardFooter,
    Chip,
    cn,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownSection,
    DropdownTrigger,
    Link,
    ScrollShadow,
    Skeleton,
    Spacer,
    useDisclosure,
    User
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { getLocalTimeZone, today } from '@internationalized/date';
import React, { Key, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useImmer } from 'use-immer';
import { useSnapshot } from 'valtio';
import { subscribeKey } from 'valtio/utils';

import NavBar from './navbar';
import Sidebar from './sidebar';
import SidebarDrawer from './sidebar-drawer';
import WorkSpaceSelection from './space-selection';

import { ChatSession, GetChatSessionList } from '@/apis/chat';
import { ListResources } from '@/apis/resource';
import { GithubIcon } from '@/components/icons';
import { LogoIcon, Name } from '@/components/logo';
import ResourceManage from '@/components/resource-modal';
import { useChatPageCondition } from '@/hooks/use-chat-page';
import { useMedia } from '@/hooks/use-media';
import { usePlan } from '@/hooks/use-plan';
import { useGroupedResources } from '@/hooks/use-resource';
import resourceStore, { loadSpaceResource, setCurrentSelectedResource, setSpaceResource } from '@/stores/resource';
import sessionStore, { setCurrentSelectedSession } from '@/stores/session';
import { closeSocket } from '@/stores/socket';
import spaceStore from '@/stores/space';
import userStore, { logout, setUserAccessToken, setUserInfo } from '@/stores/user';

interface SidebarItem {
    id: string;
    title: string;
}

export default function Component({ children }: { children: React.ReactNode }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isOpen, onOpenChange } = useDisclosure();
    const [isCollapsed, _] = React.useState(false);
    const { isMobile } = useMedia();
    const { currentSelectedSpace } = useSnapshot(spaceStore);
    const { currentSelectedResource } = useSnapshot(resourceStore);
    const { currentSelectedSession } = useSnapshot(sessionStore);
    const { userInfo } = useSnapshot(userStore);
    const { isChat } = useChatPageCondition();
    const { sessionID } = useParams();

    const { groupedResources, resourceList, resourceLoading, listResource } = useResourceMode();

    const resourceManage = useRef<HTMLElement>();
    const showCreateResource = useCallback(() => {
        if (resourceManage.current) {
            resourceManage.current.show();
        }
    }, [resourceManage]);

    const onResourceModify = useCallback(() => {
        listResource(currentSelectedSpace);
    }, [currentSelectedSpace]);

    const { sessionLoading, sessionList, reload } = useChatMode();

    useEffect(() => {
        if (!currentSelectedSpace) {
            return;
        }
        if (isChat) {
            !sessionList.find((v: ChatSessionGroup) => {
                return v.items?.find((v: ChatSession) => {
                    return v.id === sessionID && v.space_id === currentSelectedSpace;
                });
            }) && reload(currentSelectedSpace);

            return;
        }
        // not chat mode logic
        listResource(currentSelectedSpace);
    }, [currentSelectedSpace, isChat, sessionID]);

    useEffect(() => {
        if (!sessionID && !currentSelectedSession?.key) {
            return;
        }
        if (!sessionID || (currentSelectedSession?.space_id !== '' && currentSelectedSession?.space_id !== currentSelectedSpace)) {
            setCurrentSelectedSession({
                key: '',
                title: '',
                space_id: ''
            });

            return;
        }

        for (const item of sessionList) {
            const result = item.items?.find(v => {
                if (v.id === sessionID) {
                    return v;
                }
            });

            if (result) {
                setCurrentSelectedSession({
                    key: result.id,
                    title: result.title,
                    space_id: result.space_id
                });
                break;
            }
        }
    }, [sessionID, sessionList, currentSelectedSpace]);

    // @ts-ignore
    const userAction = useCallback((actionName: Key) => {
        switch (actionName) {
            case 'logout':
                closeSocket();
                logout();
                navigate('/');
                break;
            case 'setting':
                navigate('/user/setting');
                break;
            default:
        }
    }, []);

    const createNewSession = useCallback(() => {
        navigate(`/dashboard/${currentSelectedSpace}/chat`);
        if (isMobile && isOpen) {
            onOpenChange();
        }
    }, [currentSelectedSpace, isOpen, isMobile]);

    const redirectSession = useCallback(
        (key: string) => {
            navigate(`/dashboard/${currentSelectedSpace}/chat/session/${key}`);
        },
        [currentSelectedSpace]
    );

    function goJournal() {
        const t = today(getLocalTimeZone()).toString();
        navigate(`/dashboard/${currentSelectedSpace}/journal/${t}`);
    }

    const { userPlan } = usePlan();

    return (
        <div className="flex h-dvh w-full dark:bg-zinc-900">
            {/* Sidebar */}
            <SidebarDrawer className="min-w-64" sidebarWidth={260} hideCloseButton={true} isOpen={isOpen} onOpenChange={onOpenChange}>
                <div
                    className={cn('will-change relative flex w-[260px] flex-col bg-default-100 py-6 px-4 box-border transition-width h-dvh', {
                        'items-center': isCollapsed
                    })}
                >
                    <div className="flex items-center justify-between">
                        <Link color="foreground" href="/" className="cursor-pointer">
                            <div className="flex items-center gap-2 px-2">
                                <LogoIcon size={40} />

                                <span className="text-lg font-bold header-text">{Name}</span>
                            </div>
                        </Link>
                        {/* <div className="flex items-center justify-end">
                            <div className={cn('flex-end flex', { hidden: isCollapsed })}>
                                <Icon
                                    className="cursor-pointer dark:text-primary-foreground/60 [&>g]:stroke-[1px]"
                                    icon="solar:round-alt-arrow-left-line-duotone"
                                    width={24}
                                    onClick={isMobile ? onOpenChange : onToggle}
                                />
                            </div>
                        </div> */}
                    </div>

                    <Spacer y={8} />

                    <div className="flex flex-col gap-y-2">
                        <WorkSpaceSelection />

                        <Spacer y={2} />
                        <Button className="mx-1" startContent={<Icon icon="stash:data-date" width={24} />} onPress={goJournal}>
                            {t('Journal')}
                        </Button>
                        <Spacer y={2} />
                    </div>

                    <ScrollShadow hideScrollBar className="-mr-6 h-full max-h-full pr-6">
                        <div className="flex flex-col gap-y-2">
                            <div className=" pb-2 px-2 text-zinc-500 text-sm">{isChat ? t('Chat Sessions') : t('Resource List')}</div>
                            {isChat ? (
                                <Button className="mx-1" variant="ghost" startContent={<Icon icon="bx:chat" width={24} />} onPress={createNewSession}>
                                    {t('New Session')}
                                </Button>
                            ) : (
                                <>
                                    <Button className="mx-1" variant="ghost" startContent={<Icon icon="ic:outline-create-new-folder" width={24} />} onPress={showCreateResource}>
                                        {t('New Resource')}
                                    </Button>
                                    <ResourceManage ref={resourceManage} onModify={onResourceModify} />
                                    {/* <Spacer y={2} /> */}
                                    {/* <Input
                                    fullWidth
                                    aria-label="search"
                                    classNames={{
                                        base: 'px-1',
                                        input: 'dark:bg-default-50',
                                        inputWrapper: 'dark:bg-default-50 data-[focus]:dark:bg-default-50'
                                    }}
                                    labelPlacement="outside"
                                    placeholder="Search resources"
                                    startContent={<Icon className="text-default-500 [&>g]:stroke-[2px]" icon="solar:magnifer-linear" width={18} />}
                                /> */}
                                </>
                            )}
                        </div>
                        <Spacer y={2} />
                        {resourceLoading || (sessionLoading && sessionList.length === 0) ? (
                            <div className="w-full flex flex-col gap-2">
                                <Skeleton className="h-3 w-3/5 rounded-lg" />
                                <Skeleton className="h-3 w-4/5 rounded-lg" />
                                <Spacer y={2} />
                                <Skeleton className="h-3 w-3/5 rounded-lg" />
                                <Skeleton className="h-3 w-4/5 rounded-lg" />
                            </div>
                        ) : (
                            (() => {
                                if (isChat) {
                                    return (
                                        <Sidebar
                                            defaultSelectedKey={currentSelectedSession?.key}
                                            iconClassName="group-data-[selected=true]:text-primary-foreground"
                                            itemClasses={{
                                                base: 'data-[selected=true]:bg-primary-400 data-[selected=true]:focus:bg-primary-400 dark:data-[selected=true]:bg-primary-300 data-[hover=true]:bg-default-300/20 dark:data-[hover=true]:bg-default-200/40',
                                                title: 'group-data-[selected=true]:text-primary-foreground'
                                            }}
                                            sectionClasses={{
                                                heading: 'text-zinc-500 font-bold'
                                            }}
                                            items={(() => {
                                                const items: ChatSessionGroup[] = [];

                                                for (const item of sessionList) {
                                                    items.push({
                                                        key: item.key,
                                                        title: item.title,
                                                        items: item.items?.map(v => {
                                                            return {
                                                                key: v.id,
                                                                title: v.title || v.id
                                                            };
                                                        })
                                                    });
                                                }

                                                return items;
                                            })()}
                                            onSelect={key => {
                                                for (const item of sessionList) {
                                                    const result = item.items.find(v => v.id == key);

                                                    if (result) {
                                                        setCurrentSelectedSession({
                                                            key: key,
                                                            title: result.title,
                                                            space_id: result.space_id
                                                        });
                                                        redirectSession(key);
                                                        break;
                                                    }
                                                }
                                                if (isMobile && isOpen) {
                                                    onOpenChange();
                                                }
                                            }}
                                        />
                                    );
                                } else {
                                    return (
                                        <Sidebar
                                            defaultSelectedKey={currentSelectedResource?.id}
                                            iconClassName="group-data-[selected=true]:text-primary-foreground"
                                            itemClasses={{
                                                base: 'data-[selected=true]:bg-primary-400 data-[selected=true]:focus:bg-primary-400 dark:data-[selected=true]:bg-primary-300 data-[hover=true]:bg-default-300/20 dark:data-[hover=true]:bg-default-200/40',
                                                title: 'group-data-[selected=true]:text-primary-foreground'
                                            }}
                                            sectionClasses={{
                                                heading: 'text-zinc-500 font-bold'
                                            }}
                                            items={(() => {
                                                const items: ChatSessionGroup[] = [];

                                                for (const item of groupedResources) {
                                                    items.push({
                                                        key: item.title,
                                                        title: t(item.title),
                                                        items: item.items?.map(v => {
                                                            return {
                                                                key: v.id,
                                                                title: t(v.title) || v.id
                                                            };
                                                        })
                                                    });
                                                }

                                                return items;
                                            })()}
                                            onSelect={key => {
                                                const targetResource = resourceList?.find(v => v.id === key);
                                                if (targetResource) {
                                                    setCurrentSelectedResource(
                                                        targetResource.id === 'knowledge'
                                                            ? {
                                                                  ...targetResource,
                                                                  title: t(targetResource.title)
                                                              }
                                                            : targetResource
                                                    );
                                                }

                                                if (isMobile && isOpen) {
                                                    onOpenChange();
                                                }
                                            }}
                                        />
                                    );
                                }
                            })()
                        )}

                        <Spacer y={8} />
                        {/* <Card className="mx-2 overflow-visible" shadow="sm">
                            <CardBody className="items-center py-5 text-center">
                                <h3 className="text-medium font-medium text-default-700">
                                    {t('Upgrade to Pro')}
                                    <span aria-label="rocket-emoji" className="ml-2" role="img">
                                        🚀
                                    </span>
                                </h3>
                                <p className="p-4 text-small text-default-500">{t('preProInfo')}</p>
                            </CardBody>
                            <CardFooter className="absolute -bottom-8 justify-center">
                                <Button className="px-10" color="primary" radius="full">
                                    {t('Upgrade')}
                                </Button>
                            </CardFooter>
                        </Card> */}
                        <Card className="mx-2 overflow-visible" shadow="sm">
                            <CardBody className="items-center py-5 text-center">
                                <h3 className="text-medium font-medium text-default-700">
                                    Sponsor
                                    <span aria-label="rocket-emoji" className="ml-2" role="img">
                                        🚀
                                    </span>
                                </h3>
                                <p className="p-4 text-small text-default-500">⭐️ Give us a star</p>
                            </CardBody>
                            <CardFooter className="absolute -bottom-8 justify-center">
                                <Link isExternal href="https://github.com/breeew/brew">
                                    <Button className="px-10" color="primary" radius="full">
                                        <GithubIcon />
                                        Github
                                    </Button>
                                </Link>
                            </CardFooter>
                        </Card>
                    </ScrollShadow>

                    <Dropdown placement="top" className="w-full">
                        <DropdownTrigger>
                            {userInfo && userInfo.userID ? (
                                <Button
                                    className="mb-2 min-h-14 items-center justify-between"
                                    variant="bordered"
                                    endContent={
                                        userInfo.planID && (
                                            <>
                                                <Chip
                                                    variant="shadow"
                                                    size="sm"
                                                    classNames={{
                                                        base: 'bg-gradient-to-br from-indigo-500 to-pink-500 border-small border-white/50 shadow-pink-500/30',
                                                        content: 'drop-shadow shadow-black text-white'
                                                    }}
                                                >
                                                    {userPlan}
                                                </Chip>
                                                <Icon className="text-default-400" icon="lucide:chevrons-up-down" width={16} />
                                            </>
                                        )
                                    }
                                >
                                    <User
                                        avatarProps={{
                                            size: 'sm',
                                            isBordered: false,
                                            src: userInfo.avatar
                                        }}
                                        className="justify-start transition-transform"
                                        // description={userInfo.role}
                                        name={userInfo.userName}
                                    />
                                </Button>
                            ) : (
                                <div className="w-full mb-6 flex flex-col gap-2">
                                    <Skeleton className="h-3 w-3/5 rounded-lg" />
                                    <Skeleton className="h-3 w-4/5 rounded-lg" />
                                </div>
                            )}
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Account switcher" variant="flat" onAction={userAction}>
                            <DropdownSection classNames={{ heading: 'text-sm mb-2' }} showDivider title={t('UserMenu')}>
                                <DropdownItem key="setting" textValue="setting">
                                    <div className="flex items-center gap-x-3">
                                        <div className="flex flex-col">
                                            <p className="text-base font-medium text-default-600">{t('Setting')}</p>
                                        </div>
                                    </div>
                                </DropdownItem>
                            </DropdownSection>
                            <DropdownSection>
                                <DropdownItem key="logout" color="danger" textValue="logout">
                                    <div className="flex items-center gap-x-3">
                                        <div className="flex flex-col">
                                            <p className="text-base font-medium text-default-600">{t('Logout')}</p>
                                        </div>
                                    </div>
                                </DropdownItem>
                            </DropdownSection>
                        </DropdownMenu>
                    </Dropdown>
                </div>
            </SidebarDrawer>
            <div className="w-full h-full flex flex-col overflow-hidden">
                <NavBar onSideBarOpenChange={onOpenChange} />

                {children}
            </div>
            {!isMobile ? <div>{/* for gap, dont delete */}</div> : <></>}
        </div>
    );
}

function useResourceMode() {
    const { t } = useTranslation();
    // const [resourceList, setResourceList] = useState<SidebarItem[]>([]);
    const [resourceLoading, setResourceLoading] = useState(false);
    const { currentSelectedResource, currentSpaceResources } = useSnapshot(resourceStore);
    const { currentSelectedSpace } = useSnapshot(spaceStore);

    useEffect(() => {
        if (!currentSelectedSpace) {
            return;
        }
        const cancel = subscribeKey(resourceStore, 'onResourceUpdate', () => {
            listResource(currentSelectedSpace);
        });
        return cancel;
    }, [currentSelectedSpace]);

    const { groupedResources } = useGroupedResources();

    const appendAllForGroupedResources = useMemo(() => {
        return [
            {
                title: '',
                items: [
                    {
                        id: '',
                        title: 'all'
                    }
                ]
            },
            ...groupedResources
        ];
    }, [groupedResources]);
    const listResource = useCallback(
        async function (spaceID: string) {
            setResourceLoading(true);
            try {
                let resp = await loadSpaceResource(spaceID);

                let currentSelectedResourceAlreadyExist = currentSelectedResource && currentSelectedResource.id === '';

                resp.forEach(v => {
                    if (currentSelectedResource && v.id === currentSelectedResource.id && v.space_id === currentSelectedResource.space_id) {
                        currentSelectedResourceAlreadyExist = true;
                        return;
                    }
                });

                if (!currentSelectedResourceAlreadyExist && resp.length > 0) {
                    setCurrentSelectedResource({
                        id: '',
                        title: t('all')
                    });
                }
            } catch (e: any) {
                console.error(e);
            }
            setResourceLoading(false);
        },
        [currentSelectedResource, currentSelectedSpace]
    );

    const resourceList = useMemo(() => {
        if (!currentSpaceResources) {
            return [];
        }
        return [
            {
                id: '',
                title: t('all')
            },
            ...currentSpaceResources
        ];
    }, [currentSpaceResources]);

    return {
        resourceList,
        groupedResources: appendAllForGroupedResources,
        resourceLoading,
        listResource
    };
}

export interface ChatSessionGroup {
    key: string;
    title: string;
    items: ChatSession[];
}

function categorizeTimestamp(timestamp: number): string {
    // 将时间戳转换为毫秒（Unix 时间戳通常以秒为单位）
    const date = new Date(timestamp * 1000);

    // 获取当前日期的时间
    const now = new Date();

    // 判断是否为今天
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();

    if (isToday) {
        return 'today';
    }

    if (isYesterday(date)) {
        return 'yesterday';
    }

    // 判断是否为前7天
    const sevenDaysAgo = new Date();

    sevenDaysAgo.setDate(now.getDate() - 7);

    if (date > sevenDaysAgo) {
        return 'previousDays';
    }

    // 更早之前
    return 'earlier';
}

function isYesterday(date: Date): boolean {
    const now = new Date();
    const yesterday = new Date(now.setDate(now.getDate() - 1));

    return date.toDateString() === yesterday.toDateString();
}

function useGroupSessions(): () => ChatSessionGroup[] {
    const { t } = useTranslation();

    return (list: ChatSession[]): ChatSessionGroup[] => {
        if (!list || list.length === 0) {
            return [];
        }

        const todayGroup: ChatSessionGroup = {
            key: 'today',
            title: t('Today'),
            items: []
        };

        const yesterdayGroup: ChatSessionGroup = {
            key: 'yesterday',
            title: t('Yesterday'),
            items: []
        };

        const previous7Days: ChatSessionGroup = {
            key: 'previous7days',
            title: t('PreviousDays', { day: '7' }),
            items: []
        };

        const earlier: ChatSessionGroup = {
            key: 'earlier',
            title: t('Earlier'),
            items: []
        };

        const result: ChatSessionGroup[] = [];

        list.forEach(v => {
            switch (categorizeTimestamp(v.latest_access_time)) {
                case 'today':
                    todayGroup.items.push(v);
                    break;
                case 'yesterday':
                    yesterdayGroup.items.push(v);
                    break;
                case 'previousDays':
                    previous7Days.items.push(v);
                    break;
                default:
                    earlier.items.push(v);
            }
        });

        if (todayGroup.items.length > 0) {
            result.push(todayGroup);
        }
        if (yesterdayGroup.items.length > 0) {
            result.push(yesterdayGroup);
        }
        if (previous7Days.items.length > 0) {
            result.push(previous7Days);
        }
        if (earlier.items.length > 0) {
            result.push(earlier);
        }

        return result;
    };
}

function useChatMode() {
    const [sessionList, setSessionList] = useImmer<ChatSessionGroup[]>([]);
    const [sessionLoading, setSessionLoading] = useState<boolean>(false);
    const pageSize = 20;
    const [page, setPage] = useState<number>(0);
    // const [total, setTotal] = useState<number>(0);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const groupSessions = useGroupSessions();

    useEffect(() => {
        const unSubscribe = subscribeKey(sessionStore, 'sessionNamedEvent', (data: SessionNamedEvent | undefined) => {
            if (!data) {
                return;
            }
            setSessionList((prev: ChatSessionGroup[]) => {
                const todo = prev[0]?.items?.find(v => v.id === data.sessionID);

                if (todo) {
                    todo.title = data.name;
                }
            });
        });

        const unSubscribe2 = subscribeKey(sessionStore, 'sessionReload', (sessionID: string) => {
            if (!sessionList || !sessionList[0]) {
                return;
            }

            if (sessionList[0].items && sessionList[0].items[0] && (sessionList[0].items[0].id !== sessionID || sessionList[0].key !== 'today')) {
                reload(sessionList[0].items[0].space_id);
            }
        });

        return () => {
            unSubscribe();
            unSubscribe2();
        };
    }, [sessionList]);

    const loadData = useCallback(
        async (spaceID: string, page: number) => {
            if (!hasMore && page !== 1) {
                return;
            }
            setSessionLoading(true);
            try {
                const resp = await GetChatSessionList(spaceID, page, pageSize);

                setPage(page);
                if (page * pageSize >= resp.total) {
                    setHasMore(false);
                }

                if (page === 1) {
                    setSessionList(groupSessions(resp.list) || []);
                } else if (resp.list) {
                    setSessionList((prev: ChatSessionGroup[]) => {
                        const groups = groupSessions(resp.list);

                        groups.forEach((v, k) => {
                            if (!prev[k]) {
                                prev.push(v);

                                return;
                            }
                            prev[k].concat(v);
                        });

                        return prev;
                    });
                }
                // setTotal(resp.total);
            } catch (e: any) {
                console.error(e);
            }
            setSessionLoading(false);
        },
        [hasMore, sessionList]
    );

    const reload = useCallback(async (spaceID: string) => {
        if (!spaceID) {
            return;
        }
        setHasMore(true);
        await loadData(spaceID, 1);
    }, []);

    const loadNext = useCallback(
        async (spaceID: string) => {
            if (!hasMore || !spaceID) {
                return;
            }
            await loadData(spaceID, page + 1);
        },
        [page]
    );

    return {
        sessionLoading,
        sessionList,
        reload,
        loadNext
    };
}
