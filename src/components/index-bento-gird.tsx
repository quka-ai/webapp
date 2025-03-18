import { Calendar } from '@heroui/react';
import { Icon } from '@iconify/react';
import { getLocalTimeZone, today } from '@internationalized/date';

import { XiaohongshuLogo } from './icons';
import AnimatedBeamMultipleOutput from './index-beam';
import { LogoIcon } from './logo';
import Marquee from './marquee';
import { VelocityScroll } from './scroll-based-velocity';

import { BentoCard, BentoGrid } from '@/components/bento-grid';
import { cn } from '@/lib/utils';

const files = [
    {
        name: 'Journal',
        body: 'Provide a journaling feature that allows users to record their daily schedules and tasks. At the end of the day, users can quickly save useful memory points through the interface for future reference.'
    },
    {
        name: '记录停车位置',
        body: '昨天将车停在了家楼下B2层B996号车位'
    },
    {
        name: 'Oblivion',
        body: 'Throw your memories into an endless black hole; it devours and digests them, ready to echo back when you need them.'
    }
];

const features = [
    {
        Icon: Brain,
        name: 'SaveYourMemory',
        description: 'SiteDescription',
        href: '#',
        cta: 'Learn more',
        className: 'col-span-3 lg:col-span-1',
        background: (
            <Marquee pauseOnHover className="absolute top-10 [--duration:20s] [mask-image:linear-gradient(to_top,transparent_40%,#000_100%)] ">
                {files.map((f, idx) => (
                    <figure
                        key={idx}
                        className={cn(
                            'relative w-32 cursor-pointer overflow-hidden rounded-xl border p-4',
                            'border-gray-950/[.1] bg-gray-950/[.01] hover:bg-gray-950/[.05]',
                            'dark:border-gray-50/[.1] dark:bg-gray-50/[.10] dark:hover:bg-gray-50/[.15]',
                            'transform-gpu blur-[1px] transition-all duration-300 ease-out hover:blur-none'
                        )}
                    >
                        <div className="flex flex-row items-center gap-2">
                            <div className="flex flex-col">
                                <figcaption className="text-sm font-medium dark:text-white ">{f.name}</figcaption>
                            </div>
                        </div>
                        <blockquote className="mt-2 text-xs">{f.body}</blockquote>
                    </figure>
                ))}
            </Marquee>
        )
    },
    {
        Icon: LogoIcon,
        name: 'Vision',
        description: 'VisionDescription',
        href: '#',
        cta: 'Learn more',
        className: 'col-span-3 lg:col-span-2',
        background: (
            <AnimatedBeamMultipleOutput className="absolute right-2 top-4 h-[300px] border-none transition-all duration-300 ease-out [mask-image:linear-gradient(to_top,transparent_10%,#000_100%)] group-hover:scale-105" />
        )
    },
    {
        Icon: LockIcon,
        name: 'PrivacySecurity',
        description: 'PrivacySecurityDescription',
        href: '#',
        cta: 'Learn more',
        className: 'col-span-3 lg:col-span-2',
        background: (
            <VelocityScroll defaultVelocity={1} numRows="2" className="absolute right-4 text-zinc-600 top-4">
                0e477179d37ad20781bbecef6e4f81025fba2da5e775e0ef9e9a78
            </VelocityScroll>
        )
    },
    {
        Icon: CalendarIcon,
        name: 'Journal',
        description: 'JournalDescription',
        className: 'col-span-3 lg:col-span-1',
        href: '#',
        cta: 'Learn more',
        background: (
            <Calendar
                isReadOnly
                aria-label="Date (Read Only)"
                className="absolute right-4 top-4 transition-all duration-300 ease-out [mask-image:linear-gradient(to_top,transparent_10%,#000_100%)] group-hover:scale-105"
                value={today(getLocalTimeZone())}
            />
        )
    }
];

function CalendarIcon(props) {
    return <Icon icon="stash:data-date" width={24} {...props} />;
}

function LockIcon(props) {
    return <Icon icon="mdi:database-lock-outline" width={24} {...props} />;
}

function Brain(props) {
    return <Icon icon="fluent:brain-sparkle-20-regular" width={24} {...props} />;
}

export default function BentoDemo() {
    return (
        <BentoGrid>
            {features.map((feature, idx) => (
                <BentoCard key={idx} {...feature} />
            ))}
        </BentoGrid>
    );
}
