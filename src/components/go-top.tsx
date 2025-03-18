import { Button, ButtonProps } from "@heroui/react";

export default function Component(props: ButtonProps) {
    return (
        <Button isIconOnly radius="full" {...props}>
            <Icon />
        </Button>
    );
}

const Icon = ({ fill = 'currentColor', filled = '', size = 24, height = 24, width = 24, ...props }) => {
    return (
        <svg width={size || width || 24} height={size || height || 24} viewBox="0 0 1024 1024" fill={filled ? filled : fill} xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M325.450697 862.306736" />
            <path d="M882.088359 862.306736" />
            <path d="M236.00336 877.09995" />
            <path d="M960.182765 877.09995" />
            <path d="M63.645221 788.684697" />
            <path d="M958.462624 788.684697" />
            <path d="M64.84932 858.69444" />
            <path d="M959.494709 858.69444" />
            <path d="M842.009071 396.492525l-296.036284-295.86427c-18.749538-18.749538-49.196036-18.749538-67.945574 0l-295.86427 296.036284c-26.662187 26.662187-4.472367 73.278011 30.446498 73.278011l146.728036 0 0 420.5745c0 25.974131 20.985721 47.131866 47.131866 47.131866l211.233328 0c25.974131 0 47.131866-20.985721 47.131866-47.131866L664.834537 469.770536 811.906602 469.770536C847.513523 469.770536 867.811188 422.63867 842.009071 396.492525z" />
        </svg>
    );
};
