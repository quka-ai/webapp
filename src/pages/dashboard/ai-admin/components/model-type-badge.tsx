import { Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { ModelConfig, ModelTypeColors } from '@/types/ai-admin';

interface ModelTypeBadgeProps {
    type: ModelConfig['model_type'];
    size?: 'sm' | 'md' | 'lg';
}

export default function ModelTypeBadge({ type, size = 'sm' }: ModelTypeBadgeProps) {
    const { t } = useTranslation('ai-admin');
    
    const getModelTypeLabel = (type: ModelConfig['model_type']) => {
        switch (type) {
            case 'chat':
                return t('Chat');
            case 'embedding':
                return t('Embedding');
            case 'vision':
                return t('Vision');
            case 'rerank':
                return t('Rerank');
            case 'reader':
                return t('Reader');
            case 'enhance':
                return t('Enhance');
            default:
                return type;
        }
    };
    
    return (
        <Chip
            color={ModelTypeColors[type] as any}
            variant="flat"
            size={size}
        >
            {getModelTypeLabel(type)}
        </Chip>
    );
}