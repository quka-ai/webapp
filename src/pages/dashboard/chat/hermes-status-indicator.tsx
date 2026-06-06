import { Tooltip } from '@heroui/react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GetHermesAgentStatus, SubscribeHermesAgentStatus, type HermesStatusEvent } from '@/apis/hermes-desktop';
import { cn } from '@/lib/utils';

interface HermesStatusIndicatorProps {
    className?: string;
}

export default function HermesStatusIndicator({ className }: HermesStatusIndicatorProps) {
    const { t } = useTranslation();
    const [status, setStatus] = useState<HermesStatusEvent>({ ready: false, mode: 'stopped' });

    useEffect(() => {
        let disposed = false;

        GetHermesAgentStatus()
            .then(nextStatus => {
                if (!disposed) {
                    setStatus(nextStatus);
                }
            })
            .catch(error => {
                if (!disposed) {
                    setStatus({ ready: false, mode: 'unavailable', error: error?.message || String(error) });
                }
            });

        const unsubscribe = SubscribeHermesAgentStatus(event => {
            setStatus(event);
        });

        return () => {
            disposed = true;
            unsubscribe();
        };
    }, []);

    const ready = Boolean(status.ready);
    const label = ready ? t('Hermes Agent Available') : t('Hermes Agent Unavailable');
    const detail = useMemo(() => {
        if (status.error) {
            return status.error;
        }
        if (status.mode) {
            return `${label} (${status.mode})`;
        }
        return label;
    }, [label, status.error, status.mode]);

    return (
        <Tooltip showArrow content={detail}>
            <div
                aria-label={label}
                className={cn(
                    'flex h-9 items-center gap-2 rounded-full border border-default-200 bg-content1/90 px-3 text-small font-medium shadow-sm backdrop-blur',
                    className
                )}
                role="status"
            >
                <span
                    className={cn(
                        'h-2.5 w-2.5 rounded-full',
                        ready ? 'bg-success shadow-[0_0_0_3px_rgba(23,201,100,0.18)]' : 'bg-danger shadow-[0_0_0_3px_rgba(243,18,96,0.16)]'
                    )}
                />
                <span className="hidden text-default-600 sm:inline">{t('Hermes Agent')}</span>
            </div>
        </Tooltip>
    );
}
