import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { SwitchProps, useSwitch } from "@heroui/switch";
import clsx from 'clsx';
import { FC, useEffect, useState } from 'react';

import { MoonFilledIcon, SunFilledIcon } from '@/components/icons';
import { useTheme } from '@/hooks/use-theme';
import { onThemeChange } from '@/stores/event';

export interface TranslationSwitchProps {
    className?: string;
    classNames?: SwitchProps['classNames'];
}

const DefaultTheme = 'en';

export const ThemeSwitch: FC<TranslationSwitchProps> = ({ className, classNames }) => {
    const [isMounted, setIsMounted] = useState(false);

    const { theme, toggleTheme } = useTheme(DefaultTheme);

    const onChange = () => {
        toggleTheme();
        onThemeChange();
    };

    const { Component, slots, isSelected, getBaseProps, getInputProps, getWrapperProps } = useSwitch({
        isSelected: theme === 'en',
        onChange
    });

    useEffect(() => {
        setIsMounted(true);
    }, [isMounted]);

    // Prevent Hydration Mismatch
    if (!isMounted) return <div className="w-6 h-6" />;

    return (
        <Dropdown>
            <DropdownTrigger>
                <div
                    {...getWrapperProps()}
                    className={slots.wrapper({
                        class: clsx(
                            [
                                'w-auto h-auto',
                                'bg-transparent',
                                'rounded-lg',
                                'flex items-center justify-center',
                                'group-data-[selected=true]:bg-transparent',
                                '!text-default-500',
                                'pt-px',
                                'px-0',
                                'mx-0'
                            ],
                            classNames?.wrapper
                        )
                    })}
                >
                    {isSelected ? <MoonFilledIcon size={22} /> : <SunFilledIcon size={22} />}
                </div>
            </DropdownTrigger>
            <DropdownMenu aria-label="Action event example" onAction={key => alert(key)}>
                <DropdownItem key="new">New file</DropdownItem>
                <DropdownItem key="copy">Copy link</DropdownItem>
            </DropdownMenu>
        </Dropdown>
    );
};
