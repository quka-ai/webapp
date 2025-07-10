import { Chip } from '@heroui/react';
import { ModelConfig, ModelTypeLabels, ModelTypeColors } from '@/types/ai-admin';

interface ModelTypeBadgeProps {
    type: ModelConfig['model_type'];
    size?: 'sm' | 'md' | 'lg';
}

export default function ModelTypeBadge({ type, size = 'sm' }: ModelTypeBadgeProps) {
    return (
        <Chip
            color={ModelTypeColors[type] as any}
            variant="flat"
            size={size}
        >
            {ModelTypeLabels[type]}
        </Chip>
    );
}