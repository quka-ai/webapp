import { SwitchProps, useSwitch, VisuallyHidden } from '@heroui/react';
import { Icon } from '@iconify/react';

interface IconSwitchProps {
    icon: string;
    selectedIcon: string;
}

const IconSwitch = (props: SwitchProps & IconSwitchProps) => {
    const { Component, slots, isSelected, getBaseProps, getInputProps, getWrapperProps } = useSwitch({
        isSelected: props.isSelected,
        onChange: () => {
            if (props.onValueChange) {
                props.onValueChange(!props.isSelected);
            }
        },
        ...props
    });

    return (
        <div className="flex flex-col gap-2">
            <Component
                {...getBaseProps({
                    className: 'cursor-pointer transition-opacity hover:opacity-80'
                })}
            >
                <VisuallyHidden>
                    <input {...getInputProps()} />
                </VisuallyHidden>
                <div
                    {...getWrapperProps()}
                    className={slots.wrapper({
                        class: ['w-8 h-8', 'flex items-center justify-center', 'rounded-lg bg-default-100 hover:bg-default-200']
                    })}
                >
                    {isSelected ? <Icon className="w-full h-full pointer-events-none" icon={props.selectedIcon} /> : <Icon className="w-full h-full pointer-events-none" icon={props.icon} />}
                </div>
            </Component>
        </div>
    );
};

export default IconSwitch;
