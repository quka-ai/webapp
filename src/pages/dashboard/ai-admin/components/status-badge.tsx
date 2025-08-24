import { Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { StatusColors } from '@/types/ai-admin';

interface StatusBadgeProps {
    status: 0 | 1;
    size?: 'sm' | 'md' | 'lg';
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
    const { t } = useTranslation('ai-admin');
    
    const getStatusLabel = (status: 0 | 1) => {
        return status === 1 ? t('Enabled') : t('Disabled');
    };
    
    return (
        <Chip
            color={StatusColors[status] as any}
            variant="flat"
            size={size}
        >
            {getStatusLabel(status)}
        </Chip>
    );
}