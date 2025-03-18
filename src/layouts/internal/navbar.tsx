import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input, Kbd, Navbar, NavbarBrand, NavbarContent, NavbarItem } from '@heroui/react';
import { Icon } from '@iconify/react';
import { PressEvent } from '@react-types/shared/src';
import { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import { CreateSessionShareURL } from '@/apis/share';
import KnowledgeDrawerButton from '@/components/knowledge-drawer';
import ManageSpaceComponent from '@/components/manage-space';
import ResourceManage from '@/components/resource-modal';
import ShareButton, { useShare } from '@/components/share-button';
import { useChatPageCondition } from '@/hooks/use-chat-page';
import { useMedia } from '@/hooks/use-media';
import { usePlan } from '@/hooks/use-plan';
import { useRole } from '@/hooks/use-role';
import { SpaceSetting } from '@/pages/dashboard/space-setting';
import { triggerKnowledgeSearch } from '@/stores/knowledge';
import { onKnowledgeSearchKeywordsChange } from '@/stores/knowledge';
// import NotificationsCard from './notifications-card';
import resourceStore, { onResourceUpdate } from '@/stores/resource';
import spaceStore from '@/stores/space';

export default function Component({ onSideBarOpenChange }: { onSideBarOpenChange: (e: PressEvent) => void }) {
    const { t } = useTranslation();
    const { currentSelectedResource } = useSnapshot(resourceStore);
    const { spaces, currentSelectedSpace } = useSnapshot(spaceStore);
    const { isChat, isSession } = useChatPageCondition();
    const resourceManage = useRef<HTMLElement>();
    const currentSpace = useMemo(() => {
        return spaces.find(v => v.space_id === currentSelectedSpace);
    }, [spaces, currentSelectedSpace]);
    const { sessionID } = useParams();

    const navigate = useNavigate();
    const { pathname, state } = useLocation();
    const goToKnowledge = useCallback(() => {
        // TODO: 支持 keep-alive 后再使用 state
        navigate(`/dashboard/${currentSelectedSpace}/knowledge`, {
            // state: isChat
            //     ? {
            //           from: pathname
            //       }
            //     : ''
        });
    }, [pathname, currentSelectedSpace]);

    const goToChat = useCallback(() => {
        if (state && state.from) {
            navigate(-1);
        } else {
            navigate(`/dashboard/${currentSelectedSpace}/chat`);
        }
    }, [pathname, currentSelectedSpace]);

    const showResourceSetting = useCallback(() => {
        currentSelectedResource && resourceManage.current.show(currentSelectedResource);
    }, [currentSelectedResource]);

    const handleKeyDown = async (event: KeyboardEvent) => {
        // 阻止默认的提交行为
        if (event.key === 'Enter') {
            event.preventDefault();
            const keyCode = event.which || event.keyCode;

            if (keyCode === 229) {
                // 触发中文输入法确认中文等回车行为
                return;
            }
            triggerKnowledgeSearch();
        }
    };

    const { userIsPro } = usePlan();
    const { isSpaceViewer } = useRole();
    const { isMobile } = useMedia();

    const {
        createShareURL,
        shareText,
        shareIcon,
        isLoading: createShareURLLoading
    } = useShare({
        genUrlFunc: async () => {
            try {
                const res = await CreateSessionShareURL(currentSelectedSpace, window.location.origin + '/s/s/{token}', sessionID);
                return res.url;
            } catch (e: any) {
                console.error(e);
            }
        }
    });

    return (
        <Navbar
            classNames={{
                base: 'bg-transparent lg:backdrop-filter-none md:mt-3 flex',
                item: 'data-[active=true]:text-primary',
                wrapper: 'px-2 md:px-6 w-full max-w-full justify-between items-center'
            }}
            height="60px"
        >
            <NavbarBrand className="flex gap-2">
                <Button isIconOnly className="sm:hidden" variant="flat" onPress={onSideBarOpenChange}>
                    <Icon className="text-default-500" icon="solar:sidebar-minimalistic-linear" width={26} />
                </Button>
                {(() => {
                    if (isChat) {
                        return (
                            <Button
                                className="float-right text-white bg-gradient-to-br from-pink-300 from-15%  to-indigo-600 dark:from-indigo-500 dark:to-pink-500"
                                endContent={<Icon icon="material-symbols:arrow-forward-ios-rounded" />}
                                onPress={goToKnowledge}
                            >
                                {t('View Brain')}
                            </Button>
                        );
                    }

                    return (
                        <Button
                            className="float-right text-white bg-gradient-to-br from-pink-300 from-15%  to-indigo-600 dark:from-indigo-500 dark:to-pink-500"
                            startContent={<Icon icon="material-symbols:arrow-back-ios-rounded" />}
                            onPress={goToChat}
                        >
                            {t('Back to chat')}
                        </Button>
                    );
                    // if (currentSelectedResource) {
                    //     return <h1 className="text-3xl font-bold leading-9 text-default-foreground">{currentSelectedResource.title}</h1>;
                    // }

                    // return <Skeleton className="h-6 w-1/2 rounded-lg" />;
                })()}
            </NavbarBrand>

            {isSession && userIsPro && (
                <>
                    <NavbarContent className="h-12 max-w-fit gap-4 rounded-full" justify="end">
                        {isMobile ? (
                            <Dropdown>
                                <DropdownTrigger>
                                    <Button isIconOnly variant="ghost" isLoading={createShareURLLoading}>
                                        <Icon icon="tabler:dots" width={24} />
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu variant="faded">
                                    <DropdownItem key="share" className="h-10" startContent={<Icon icon={shareIcon} width={24} />} onPress={createShareURL}>
                                        {shareText}
                                    </DropdownItem>
                                    <DropdownItem key="new-content">
                                        <KnowledgeDrawerButton className="w-full" temporaryStorage="session-knowledge" />
                                    </DropdownItem>
                                </DropdownMenu>
                            </Dropdown>
                        ) : (
                            <>
                                <ShareButton
                                    genUrlFunc={async () => {
                                        try {
                                            const res = await CreateSessionShareURL(currentSelectedSpace, window.location.origin + '/s/s/{token}', sessionID);
                                            return res.url;
                                        } catch (e: any) {
                                            console.error(e);
                                        }
                                    }}
                                />
                                <KnowledgeDrawerButton temporaryStorage="session-knowledge" />
                            </>
                        )}
                    </NavbarContent>
                </>
            )}

            {!isChat && !isSpaceViewer && (
                <NavbarContent className="ml-4 hidden h-12 w-full max-w-fit gap-4 rounded-full px-4  lg:flex" justify="end">
                    {/* <NavbarItem>
                        <Link className="flex gap-2 text-inherit" href="#">
                            Prompt
                        </Link>
                    </NavbarItem> */}
                    {currentSpace && (
                        <NavbarItem>
                            <SpaceSetting space={currentSpace} />
                            {/* <ManageSpaceComponent radius="full" label={t('Space Setting')} variant="ghost" className="flex gap-2 text-inherit" space={currentSpace} /> */}
                        </NavbarItem>
                    )}

                    {currentSelectedResource && currentSelectedResource.id && currentSelectedResource.id !== 'knowledge' && (
                        <>
                            <NavbarItem>
                                <Button variant="ghost" className="flex gap-2 text-inherit" onPress={showResourceSetting}>
                                    {t('Resource Setting')}
                                </Button>
                            </NavbarItem>
                            <ResourceManage
                                ref={resourceManage}
                                onModify={() => {
                                    onResourceUpdate();
                                }}
                            />
                        </>
                    )}
                </NavbarContent>
            )}

            {!isChat && (
                <NavbarContent className="flex gap-2 h-12 max-w-fit items-center  p-0 lg:px-1" justify="end">
                    <NavbarItem className="flex">
                        {/* <Button isIconOnly radius="full" variant="light">
                        <Icon className="text-default-500" icon="solar:magnifer-linear" width={22} />
                    </Button> */}
                        <Input
                            classNames={{
                                base: 'max-w-full sm:max-w-[20rem] h-10',
                                mainWrapper: 'h-full',
                                input: 'text-small',
                                inputWrapper: 'h-full rounded-xl font-normal text-default-500 bg-default-400/20 dark:bg-default-500/20'
                            }}
                            placeholder={t('Search')}
                            size="sm"
                            startContent={<Icon className="text-default-500" icon="solar:magnifer-linear" width={18} />}
                            endContent={<Kbd keys={['enter']} className="cursor-pointer" onClick={_ => triggerKnowledgeSearch()} />}
                            type="search"
                            onValueChange={onKnowledgeSearchKeywordsChange}
                            onKeyDown={handleKeyDown}
                        />
                    </NavbarItem>

                    {/* <NavbarItem className="flex">
                    <Popover offset={12} placement="bottom-end">
                        <PopoverTrigger>
                            <Button disableRipple isIconOnly className="overflow-visible" radius="full" variant="light">
                                <Badge color="danger" content="5" showOutline={false} size="md">
                                    <Icon className="text-default-500" icon="solar:bell-linear" width={22} />
                                </Badge>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="max-w-[90vw] p-0 sm:max-w-[380px]">
                            <NotificationsCard className="w-full shadow-none" />
                        </PopoverContent>
                    </Popover>
                </NavbarItem> */}
                </NavbarContent>
            )}

            {/* Mobile Menu */}
        </Navbar>
    );
}
