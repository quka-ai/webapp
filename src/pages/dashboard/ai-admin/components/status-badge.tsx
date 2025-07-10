import { Chip } from '@heroui/react';
import { StatusLabels, StatusColors } from '@/types/ai-admin';

interface StatusBadgeProps {
    status: 0 | 1;
    size?: 'sm' | 'md' | 'lg';
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
    return (
        <Chip
            color={StatusColors[status] as any}
            variant="flat"
            size={size}
        >
            {StatusLabels[status]}
        </Chip>
    );
}