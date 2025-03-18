import React from 'react';

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
            <svg
                version="1.0"
                xmlns="http://www.w3.org/2000/svg"
                width={size || width}
                height={size || height}
                fill="currentColor"
                viewBox="0 0 792.000000 717.000000"
                preserveAspectRatio="xMidYMid meet"
                {...props}
            >
                <g transform="translate(0.000000,717.000000) scale(0.100000,-0.100000)" fill="#000000" stroke="none">
                    <path
                        d="M2788 7154 c-95 -23 -177 -70 -253 -148 -69 -70 -82 -93 -1278 -2287
-702 -1288 -1217 -2242 -1229 -2280 -31 -93 -29 -231 3 -321 13 -36 235 -473
494 -970 l470 -903 75 -76 c78 -80 135 -115 235 -146 57 -17 119 -18 1110 -18
l1049 0 1428 2615 c785 1438 1435 2629 1444 2645 l16 30 -442 810 c-243 445
-457 831 -476 857 -42 57 -118 119 -187 152 -119 58 -73 56 -1287 55 -914 -1
-1125 -3 -1172 -15z"
                        fill="currentColor"
                    />
                    <path
                        d="M5292 2427 c-722 -1322 -1312 -2409 -1312 -2415 0 -9 137 -12 555
-12 l555 0 24 37 c13 21 481 876 1039 1900 l1016 1862 -280 512 c-153 282
-280 514 -282 516 -2 1 -594 -1079 -1315 -2400z"
                        fill="currentColor"
                    />

                    <path
                        d="M7397 3289 c-68 -118 -1787 -3274 -1787 -3282 0 -4 213 -7 478 -5
428 4 483 6 532 22 125 41 213 101 280 190 47 63 963 1818 992 1901 29 84 34
195 14 288 -14 63 -52 138 -241 485 -123 226 -228 419 -233 428 -8 14 -13 10
-35 -27z"
                        fill="currentColor"
                    />
                </g>
            </svg>
        </div>
    );
};

export const Name = import.meta.env.VITE_APP_NAME || 'Brew';
