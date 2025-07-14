import { 
    Button, 
    Card, 
    CardBody, 
    Chip, 
    Dropdown, 
    DropdownItem, 
    DropdownMenu, 
    DropdownTrigger,
    Spinner
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';

import StatusBadge from '../components/status-badge';
import ModelTypeBadge from '../components/model-type-badge';
import { ModelConfig } from '@/types/ai-admin';

interface ModelCardProps {
    model: ModelConfig;
    onEdit: () => void;
    onDelete: () => void;
    onToggleStatus: () => void;
    isToggleLoading?: boolean;
    isDeleteLoading?: boolean;
}

export default function ModelCard({ 
    model, 
    onEdit, 
    onDelete, 
    onToggleStatus, 
    isToggleLoading = false, 
    isDeleteLoading = false 
}: ModelCardProps) {
    const { t } = useTranslation('ai-admin');
    
    const formatDate = (timestamp: number) => {
        if (!timestamp) return '-';
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString();
    };
    
    const formatConfig = (config: ModelConfig['config']) => {
        if (!config) return [];
        const params = [];
        if (config.max_tokens) params.push(`${t('Max Tokens')}: ${config.max_tokens}`);
        if (config.temperature !== undefined) params.push(`${t('Temperature')}: ${config.temperature}`);
        if (config.top_p !== undefined) params.push(`${t('Top P')}: ${config.top_p}`);
        return params;
    };
    
    return (
        <Card className="hover:shadow-lg transition-shadow">
            <CardBody className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* 移动端：头部信息 */}
                    <div className="flex items-start gap-3 sm:hidden">
                        <div className="flex-shrink-0">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-secondary/20 to-success/20 flex items-center justify-center">
                                <Icon 
                                    icon="material-symbols:settings" 
                                    width={20} 
                                    height={20} 
                                    className="text-secondary"
                                />
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground">
                                        {model.display_name}
                                    </h3>
                                    <p className="text-sm text-default-600 mt-1">
                                        {model.model_name}
                                    </p>
                                    <p className="text-xs text-default-500 mt-1">
                                        {t('Provider')}: {model.provider?.name || '-'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                    <StatusBadge status={model.status} />
                                    <ModelTypeBadge type={model.model_type} />
                                    <Dropdown>
                                        <DropdownTrigger>
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="ghost"
                                                className="text-default-400 hover:text-foreground"
                                                isDisabled={isToggleLoading || isDeleteLoading}
                                                isLoading={isToggleLoading || isDeleteLoading}
                                            >
                                                {!(isToggleLoading || isDeleteLoading) && (
                                                    <Icon icon="material-symbols:more-vert" width={16} />
                                                )}
                                            </Button>
                                        </DropdownTrigger>
                                        <DropdownMenu>
                                            <DropdownItem key="edit" onPress={onEdit} textValue={t('Edit')}>
                                                <div className="flex items-center gap-2">
                                                    <Icon icon="material-symbols:edit" width={16} />
                                                    {t('Edit')}
                                                </div>
                                            </DropdownItem>
                                            <DropdownItem 
                                                key="toggle"
                                                onPress={onToggleStatus}
                                                textValue={model.status === 1 ? t('Disable') : t('Enable')}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Icon 
                                                        icon={model.status === 1 ? "material-symbols:pause" : "material-symbols:play-arrow"} 
                                                        width={16} 
                                                    />
                                                    {model.status === 1 ? t('Disable') : t('Enable')}
                                                </div>
                                            </DropdownItem>
                                            <DropdownItem 
                                                key="delete" 
                                                className="text-danger" 
                                                color="danger"
                                                onPress={onDelete}
                                                textValue={t('Delete')}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Icon icon="material-symbols:delete" width={16} />
                                                    {t('Delete')}
                                                </div>
                                            </DropdownItem>
                                        </DropdownMenu>
                                    </Dropdown>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 桌面端：图标 */}
                    <div className="hidden sm:block flex-shrink-0">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-secondary/20 to-success/20 flex items-center justify-center">
                            <Icon 
                                icon="material-symbols:settings" 
                                width={24} 
                                height={24} 
                                className="text-secondary"
                            />
                        </div>
                    </div>
                    
                    {/* 桌面端：主要信息 */}
                    <div className="hidden sm:block flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                            <div>
                                <h3 className="text-lg font-semibold text-foreground">
                                    {model.display_name}
                                </h3>
                                <p className="text-sm text-default-600 mt-1">
                                    {model.model_name}
                                </p>
                                <p className="text-xs text-default-500 mt-1">
                                    {t('Provider')}: {model.provider?.name || '-'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <StatusBadge status={model.status} />
                                <ModelTypeBadge type={model.model_type} />
                                <Dropdown>
                                    <DropdownTrigger>
                                        <Button
                                            isIconOnly
                                            size="sm"
                                            variant="ghost"
                                            className="text-default-400 hover:text-foreground"
                                            isDisabled={isToggleLoading || isDeleteLoading}
                                            isLoading={isToggleLoading || isDeleteLoading}
                                        >
                                            {!(isToggleLoading || isDeleteLoading) && (
                                                <Icon icon="material-symbols:more-vert" width={16} />
                                            )}
                                        </Button>
                                    </DropdownTrigger>
                                    <DropdownMenu>
                                        <DropdownItem key="edit" onPress={onEdit} textValue={t('Edit')}>
                                            <div className="flex items-center gap-2">
                                                <Icon icon="material-symbols:edit" width={16} />
                                                {t('Edit')}
                                            </div>
                                        </DropdownItem>
                                        <DropdownItem 
                                            key="toggle"
                                            onPress={onToggleStatus}
                                            textValue={model.status === 1 ? t('Disable') : t('Enable')}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Icon 
                                                    icon={model.status === 1 ? "material-symbols:pause" : "material-symbols:play-arrow"} 
                                                    width={16} 
                                                />
                                                {model.status === 1 ? t('Disable') : t('Enable')}
                                            </div>
                                        </DropdownItem>
                                        <DropdownItem 
                                            key="delete" 
                                            className="text-danger" 
                                            color="danger"
                                            onPress={onDelete}
                                            textValue={t('Delete')}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Icon icon="material-symbols:delete" width={16} />
                                                {t('Delete')}
                                            </div>
                                        </DropdownItem>
                                    </DropdownMenu>
                                </Dropdown>
                            </div>
                        </div>
                    </div>
                </div>
                        
                {/* 详细信息 - 移动端优化 */}
                <div className="space-y-3 mt-4">
                    {/* 多模态标识 */}
                    {model.is_multi_modal && (
                        <div className="flex items-center gap-2 text-sm">
                            <Icon icon="material-symbols:visibility" width={16} className="text-success flex-shrink-0" />
                            <span className="text-success font-medium">{t('Multi-modal Support')}</span>
                        </div>
                    )}
                    
                    {/* 配置参数 */}
                    {formatConfig(model.config).length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                                <Icon icon="material-symbols:tune" width={16} className="text-default-400 flex-shrink-0" />
                                <span className="text-default-600 flex-shrink-0">{t('Parameters')}:</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {formatConfig(model.config).map((param, index) => (
                                    <Chip key={index} size="sm" variant="flat" color="default">
                                        {param}
                                    </Chip>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* 时间信息 */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-default-500 pt-2 border-t border-default-200">
                        <span className="flex items-center gap-1">
                            <Icon icon="material-symbols:add" width={12} className="flex-shrink-0" />
                            {t('Created')}: {formatDate(model.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                            <Icon icon="material-symbols:update" width={12} className="flex-shrink-0" />
                            {t('Updated')}: {formatDate(model.updated_at)}
                        </span>
                    </div>
                </div>
            </CardBody>
        </Card>
    );
}