import { Chip, Divider } from "@heroui/react";
import React from 'react';

import { LogoIcon, Name } from '@/components/logo';

export default function Component() {
    const icpCode = import.meta.env.VITE_ICP_CODE;
    const icpLink = import.meta.env.VITE_ICP_LINK || '#';
    return (
        <footer className="flex w-full flex-col">
            <div className="mx-auto w-full max-w-7xl px-6 py-12 md:flex md:items-center md:justify-between lg:px-8">
                <div className="flex flex-col items-center justify-center gap-2 md:order-2 md:items-end"></div>
                <div className="mt-4 md:order-1 md:mt-0">
                    <div className="flex items-center justify-center gap-3 md:justify-start mb-2">
                        <div className="flex items-center">
                            <LogoIcon size={34} />
                            <span className="text-small font-medium header-text">{Name}</span>
                        </div>
                        <Divider className="h-4" orientation="vertical" />
                        <Chip className="border-none px-0 text-default-500" color="success" variant="dot">
                            All systems operational
                        </Chip>
                    </div>
                    <p className="text-center text-tiny text-default-400 md:text-start">
                        &copy; 2025 {Name}. All rights reserved.{' '}
                        {icpCode && (
                            <a href={icpLink} target="_blank">
                                {icpCode}
                            </a>
                        )}
                    </p>
                </div>
            </div>
        </footer>
    );
}
