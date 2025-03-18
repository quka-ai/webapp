import { Button, Kbd, Navbar, NavbarBrand, NavbarContent, NavbarItem, NavbarProps } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import { LogoIcon } from './logo';

import { useMedia } from '@/hooks/use-media';
import spaceStore from '@/stores/space';

export default function Component(props: NavbarProps) {
    const { t } = useTranslation();
    const { isMobile } = useMedia();
    const navigate = useNavigate();
    const { currentSelectedSpace } = useSnapshot(spaceStore);

    return (
        <Navbar
            classNames={{
                base: 'py-4 backdrop-filter-none bg-transparent',
                wrapper: 'px-0 w-full justify-center bg-transparent',
                item: 'hidden md:flex'
            }}
            height="54px"
        >
            <NavbarContent
                className="gap-2 rounded-full border-small border-default-200/20 bg-background/60 px-2 shadow-medium backdrop-blur-md backdrop-saturate-150 dark:bg-default-100/50"
                justify="center"
            >
                {/* Logo */}
                <NavbarBrand className="mr-1  md:w-auto md:max-w-fit">
                    <div className="rounded-full ml-2">
                        <LogoIcon size={40} />
                    </div>
                    {/* <span className="ml-2 font-medium md:hidden">{t('knowledgeCreateButtonTitle')}...</span> */}
                </NavbarBrand>

                {/* Items */}
                <NavbarItem className="flex">
                    <Button
                        aria-label="Got a shot"
                        className="text-sm font-normal text-default-500 bg-transparent pl-0 md:px-4"
                        endContent={<div className="w-1 h-4 rounded-full bg-black dark:bg-white animate-pulse" />}
                        onPress={e => {
                            if (isMobile) {
                                navigate(`/dashboard/${currentSelectedSpace}/knowledge/create`);
                            } else if (props.onClick) {
                                props.onClick(e);
                            }
                        }}
                    >
                        🤔 {t('knowledgeCreateButtonTitle')}...
                    </Button>
                </NavbarItem>
            </NavbarContent>
        </Navbar>
    );
}
