import React from 'react';

import { Logo } from './icons';

import { cn } from '@/lib/utils';
import type { IconSvgProps } from '@/types';

export const LogoIcon: React.FC<IconSvgProps> = ({ size = 32, width, height, ...props }) => {
    width = width || size;
    height = height || size;
    return import.meta.env.VITE_APP_LOGO ? (
        <div style={{ width: width + 'px', height: height + 'px' }}>
            <div dangerouslySetInnerHTML={{ __html: import.meta.env.VITE_APP_LOGO }} {...props} className="w-full h-full" />
        </div>
    ) : (
        <div className="text-foreground opacity-85">
            <Logo size={size} width={width} height={height} />
        </div>
    );
};

export const Name = import.meta.env.VITE_APP_NAME || 'Brew';
