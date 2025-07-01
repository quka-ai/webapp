import { useSwitch, VisuallyHidden } from '@heroui/react';
import { Icon } from '@iconify/react';

interface IconSwitchProps {
    isSelected?: boolean;
    onValueChange?: (isSelected: boolean) => void;
    icon: string;
    selectedIcon: string;
    [key: string]: any;
}

const IconSwitch = (props: IconSwitchProps) => {
    const { Component, slots, isSelected, getBaseProps, getInputProps, getWrapperProps } = useSwitch(props);
    return (
        <div className="flex flex-col gap-2">
            <Component {...getBaseProps()}>
                <VisuallyHidden>
                    <input {...getInputProps()} />
                </VisuallyHidden>
                <div
                    {...getWrapperProps()}
                    className={slots.wrapper({
                        class: ['w-8 h-8', 'flex items-center justify-center', 'rounded-lg bg-default-100 hover:bg-default-200']
                    })}
                >
                    {isSelected ? <Icon className="w-full h-full" icon={props.selectedIcon} /> : <Icon className="w-full h-full" icon={props.icon} />}
                </div>
            </Component>
        </div>
    );
};

export default IconSwitch;
