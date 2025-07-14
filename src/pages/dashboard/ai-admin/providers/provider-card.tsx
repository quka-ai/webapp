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
import { Provider } from '@/types/ai-admin';

interface ProviderCardProps {
    provider: Provider;
    onEdit: () => void;
    onDelete: () => void;
    onToggleStatus: () => void;
    isToggleLoading?: boolean;
    isDeleteLoading?: boolean;
}

export default function ProviderCard({ provider, onEdit, onDelete, onToggleStatus, isToggleLoading = false, isDeleteLoading = false }: ProviderCardProps) {
    const { t } = useTranslation('ai-admin');
    
    const formatDate = (timestamp: number) => {
        if (!timestamp) return '-';
        // 处理秒级时间戳，转换为毫秒级
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString();
    };
    
    const maskApiKey = (apiKey: string) => {
        if (!apiKey || apiKey.length <= 8) return apiKey || '';
        return apiKey.slice(0, 4) + '...' + apiKey.slice(-4);
    };
    
    return (
        <Card className="hover:shadow-lg transition-shadow">
            <CardBody className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* 移动端：头部信息 */}
                    <div className="flex items-start gap-3 sm:hidden">
                        <div className="flex-shrink-0">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                                <Icon 
                                    icon="material-symbols:cloud" 
                                    width={20} 
                                    height={20} 
                                    className="text-primary"
                                />
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground">
                                        {provider.name}
                                    </h3>
                                    <p className="text-sm text-default-600 mt-1 line-clamp-2">
                                        {provider.description}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                    <StatusBadge status={provider.status} />
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
                                                textValue={provider.status === 1 ? t('Disable') : t('Enable')}
                                                isDisabled={isToggleLoading}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {isToggleLoading ? (
                                                        <Spinner size="sm" />
                                                    ) : (
                                                        <Icon 
                                                            icon={provider.status === 1 ? "material-symbols:pause" : "material-symbols:play-arrow"} 
                                                            width={16} 
                                                        />
                                                    )}
                                                    {provider.status === 1 ? t('Disable') : t('Enable')}
                                                </div>
                                            </DropdownItem>
                                            <DropdownItem 
                                                key="delete" 
                                                className="text-danger" 
                                                color="danger"
                                                onPress={onDelete}
                                                textValue={t('Delete')}
                                                isDisabled={isDeleteLoading}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {isDeleteLoading ? (
                                                        <Spinner size="sm" />
                                                    ) : (
                                                        <Icon icon="material-symbols:delete" width={16} />
                                                    )}
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
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                            <Icon 
                                icon="material-symbols:cloud" 
                                width={24} 
                                height={24} 
                                className="text-primary"
                            />
                        </div>
                    </div>
                    
                    {/* 桌面端：主要信息 */}
                    <div className="hidden sm:block flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                            <div>
                                <h3 className="text-lg font-semibold text-foreground">
                                    {provider.name}
                                </h3>
                                <p className="text-sm text-default-600 mt-1">
                                    {provider.description}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <StatusBadge status={provider.status} />
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
                                            textValue={provider.status === 1 ? t('Disable') : t('Enable')}
                                            isDisabled={isToggleLoading}
                                        >
                                            <div className="flex items-center gap-2">
                                                {isToggleLoading ? (
                                                    <Spinner size="sm" />
                                                ) : (
                                                    <Icon 
                                                        icon={provider.status === 1 ? "material-symbols:pause" : "material-symbols:play-arrow"} 
                                                        width={16} 
                                                    />
                                                )}
                                                {provider.status === 1 ? t('Disable') : t('Enable')}
                                            </div>
                                        </DropdownItem>
                                        <DropdownItem 
                                            key="delete" 
                                            className="text-danger" 
                                            color="danger"
                                            onPress={onDelete}
                                            textValue={t('Delete')}
                                            isDisabled={isDeleteLoading}
                                        >
                                            <div className="flex items-center gap-2">
                                                {isDeleteLoading ? (
                                                    <Spinner size="sm" />
                                                ) : (
                                                    <Icon icon="material-symbols:delete" width={16} />
                                                )}
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
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                            <Icon icon="material-symbols:link" width={16} className="text-default-400 flex-shrink-0" />
                            <span className="text-default-600 flex-shrink-0">{t('API URL')}:</span>
                        </div>
                        <span className="font-mono text-xs bg-default-100 px-2 py-1 rounded break-all sm:max-w-md">
                            {provider.api_url}
                        </span>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                            <Icon icon="material-symbols:key" width={16} className="text-default-400 flex-shrink-0" />
                            <span className="text-default-600 flex-shrink-0">{t('API Key')}:</span>
                        </div>
                        <span className="font-mono text-xs bg-default-100 px-2 py-1 rounded">
                            {maskApiKey(provider.api_key)}
                        </span>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                            <Icon icon="material-symbols:settings" width={16} className="text-default-400 flex-shrink-0" />
                            <span className="text-default-600 flex-shrink-0">{t('Config')}:</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            <Chip size="sm" variant="flat" color="default">
                                {t('Timeout')}: {provider.config.timeout}ms
                            </Chip>
                            <Chip size="sm" variant="flat" color="default">
                                {t('Max Retries')}: {provider.config.max_retries}
                            </Chip>
                            {provider.config.is_reader && (
                                <Chip size="sm" variant="flat" color="primary">
                                    <Icon icon="material-symbols:chrome-reader-mode" width={12} className="mr-1" />
                                    {t('Reader Support')}
                                </Chip>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-default-500 pt-2 border-t border-default-200">
                        <span className="flex items-center gap-1">
                            <Icon icon="material-symbols:add" width={12} className="flex-shrink-0" />
                            {t('Created')}: {formatDate(provider.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                            <Icon icon="material-symbols:update" width={12} className="flex-shrink-0" />
                            {t('Updated')}: {formatDate(provider.updated_at)}
                        </span>
                    </div>
                </div>
            </CardBody>
        </Card>
    );
}