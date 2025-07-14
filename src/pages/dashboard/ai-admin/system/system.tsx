import { 
    Button, 
    Card, 
    CardBody, 
    CardHeader, 
    Chip, 
    Skeleton
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { SystemStatus } from '@/types/ai-admin';
import { aiSystemAPI } from '@/apis/ai-admin';

export default function System() {
    const { t } = useTranslation('ai-admin');
    
    // 状态管理
    const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    
    // 加载系统状态
    const loadSystemStatus = async () => {
        try {
            setLoading(true);
            const data = await aiSystemAPI.getSystemStatus();
            setSystemStatus(data);
        } catch (error) {
            console.error('Failed to load system status:', error);
            toast.error(t('Failed to load system status'));
        } finally {
            setLoading(false);
        }
    };
    
    // 重新加载配置
    const handleReloadConfig = async () => {
        try {
            setReloading(true);
            await aiSystemAPI.reloadConfig();
            toast.success(t('AI configuration reloaded successfully'));
            // 重新加载系统状态
            await loadSystemStatus();
        } catch (error) {
            console.error('Failed to reload config:', error);
            toast.error(t('Failed to reload AI configuration'));
        } finally {
            setReloading(false);
        }
    };
    
    // 格式化时间
    const formatDate = (timestamp: number) => {
        if (!timestamp) return '-';
        const date = new Date(timestamp * 1000);
        return date.toLocaleString();
    };
    
    // 初始加载
    useEffect(() => {
        loadSystemStatus();
    }, []);
    
    // 驱动类型配置
    const driverTypes = [
        { key: 'chat_drivers_count', label: t('Chat'), icon: 'material-symbols:chat', color: 'primary' },
        { key: 'embed_drivers_count', label: t('Embedding'), icon: 'material-symbols:data-array', color: 'secondary' },
        { key: 'vision_drivers_count', label: t('Vision'), icon: 'material-symbols:visibility', color: 'success' },
        { key: 'rerank_drivers_count', label: t('Rerank'), icon: 'material-symbols:sort', color: 'warning' },
        { key: 'reader_drivers_count', label: t('Reader'), icon: 'material-symbols:chrome-reader-mode', color: 'danger' },
        { key: 'enhance_drivers_count', label: t('Enhance'), icon: 'material-symbols:auto-fix-high', color: 'default' }
    ];
    
    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <Card>
                <CardBody>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold mb-2">{t('System Status')}</h3>
                            <p className="text-default-600">
                                {t('View AI system status, including model loading and system resource usage')}
                            </p>
                        </div>
                        <Button
                            color="primary"
                            variant="flat"
                            startContent={<Icon icon="material-symbols:refresh" />}
                            onPress={handleReloadConfig}
                            isLoading={reloading}
                        >
                            {t('Reload Configuration')}
                        </Button>
                    </div>
                </CardBody>
            </Card>
            
            {/* 系统状态详情 */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Icon icon="material-symbols:monitoring" className="text-primary" />
                        <h4 className="text-md font-medium">{t('AI Drivers Status')}</h4>
                    </div>
                </CardHeader>
                <CardBody>
                    {loading ? (
                        // 加载骨架屏
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <div key={index} className="flex items-center gap-3 p-4 border rounded-lg">
                                    <Skeleton className="w-8 h-8 rounded" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-3 w-16" />
                                    </div>
                                    <Skeleton className="h-6 w-8 rounded-full" />
                                </div>
                            ))}
                        </div>
                    ) : systemStatus ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {driverTypes.map((driver) => {
                                const count = systemStatus[driver.key as keyof SystemStatus] as number;
                                return (
                                    <div key={driver.key} className="flex items-center gap-3 p-4 border rounded-lg hover:bg-default-50 transition-colors">
                                        <div className={`p-2 rounded-lg bg-${driver.color}/10`}>
                                            <Icon 
                                                icon={driver.icon} 
                                                width={20} 
                                                className={`text-${driver.color}`} 
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-default-900">{driver.label}</p>
                                            <p className="text-sm text-default-500">{t('Drivers Loaded')}</p>
                                        </div>
                                        <Chip
                                            color={count > 0 ? 'success' : 'default'}
                                            variant="flat"
                                            size="sm"
                                        >
                                            {count}
                                        </Chip>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <Icon icon="material-symbols:error-outline" width={48} className="text-default-400 mb-2" />
                            <p className="text-default-500">{t('Failed to load system status')}</p>
                            <Button
                                variant="light"
                                color="primary"
                                startContent={<Icon icon="material-symbols:refresh" />}
                                onPress={loadSystemStatus}
                                className="mt-2"
                            >
                                {t('Retry')}
                            </Button>
                        </div>
                    )}
                </CardBody>
            </Card>
            
            {/* 最后重载时间 */}
            {systemStatus && (
                <Card>
                    <CardBody>
                        <div className="flex items-center gap-2 text-sm text-default-600">
                            <Icon icon="material-symbols:schedule" width={16} />
                            <span>{t('Last reload time')}: {formatDate(systemStatus.last_reload_time)}</span>
                        </div>
                    </CardBody>
                </Card>
            )}
        </div>
    );
}