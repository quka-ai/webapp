import { 
    Button, 
    Card, 
    CardBody, 
    CardHeader, 
    Select, 
    SelectItem, 
    Skeleton,
    Chip
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ModelConfig } from '@/types/ai-admin';
import { aiSystemAPI, modelConfigAPI } from '@/apis/ai-admin';

interface UsageConfig {
    chat: string;
    embedding: string;
    vision: string;
    rerank: string;
    reader: string;
    enhance: string;
}

export default function Usage() {
    const { t } = useTranslation('ai-admin');
    
    // 状态管理
    const [usageConfig, setUsageConfig] = useState<UsageConfig | null>(null);
    const [models, setModels] = useState<ModelConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    
    // 原始配置，用于检测变化
    const [originalConfig, setOriginalConfig] = useState<UsageConfig | null>(null);
    
    // 功能模块配置
    const moduleConfigs = [
        {
            key: 'chat' as keyof UsageConfig,
            label: t('Chat'),
            icon: 'material-symbols:chat',
            color: 'primary',
            description: t('AI model for chat functionality'),
            required: true
        },
        {
            key: 'embedding' as keyof UsageConfig,
            label: t('Embedding'),
            icon: 'material-symbols:data-array',
            color: 'secondary', 
            description: t('AI model for text vectorization'),
            required: true
        },
        {
            key: 'vision' as keyof UsageConfig,
            label: t('Vision'),
            icon: 'material-symbols:visibility',
            color: 'success',
            description: t('AI model for image recognition and processing'),
            required: false
        },
        {
            key: 'rerank' as keyof UsageConfig,
            label: t('Rerank'),
            icon: 'material-symbols:sort',
            color: 'warning',
            description: t('AI model for search result reranking'),
            required: false
        },
        {
            key: 'enhance' as keyof UsageConfig,
            label: t('Enhance'),
            icon: 'material-symbols:auto-fix-high',
            color: 'default',
            description: t('AI model for content enhancement'),
            required: false
        },
        {
            key: 'reader' as keyof UsageConfig,
            label: t('Reader'),
            icon: 'material-symbols:chrome-reader-mode',
            color: 'danger',
            description: t('AI model for document reading and analysis'),
            required: false
        }
    ];
    
    // 加载数据
    const loadData = async () => {
        try {
            setLoading(true);
            const [configData, modelsData] = await Promise.all([
                aiSystemAPI.getUsageConfig(),
                modelConfigAPI.getModelConfigs({
                    status:1
                })
            ]);
            
            setUsageConfig(configData);
            setOriginalConfig(configData);
            setModels(modelsData.list || []);
            setHasChanges(false);
        } catch (error) {
            console.error('Failed to load usage configuration:', error);
            toast.error(t('Failed to load usage configuration'));
        } finally {
            setLoading(false);
        }
    };
    
    // 检测配置变化
    const checkForChanges = (newConfig: UsageConfig) => {
        if (!originalConfig) return false;
        
        return Object.keys(newConfig).some(key => {
            return newConfig[key as keyof UsageConfig] !== originalConfig[key as keyof UsageConfig];
        });
    };
    
    // 处理配置变化
    const handleConfigChange = (moduleKey: keyof UsageConfig, modelId: string) => {
        if (!usageConfig) return;
        
        const newConfig = {
            ...usageConfig,
            [moduleKey]: modelId
        };
        
        setUsageConfig(newConfig);
        setHasChanges(checkForChanges(newConfig));
    };
    
    // 保存配置
    const handleSaveConfig = async () => {
        if (!usageConfig) return;
        
        try {
            setSaving(true);
            await aiSystemAPI.updateUsageConfig(usageConfig);
            setOriginalConfig(usageConfig);
            setHasChanges(false);
            toast.success(t('Usage configuration updated successfully'));
        } catch (error) {
            console.error('Failed to update usage configuration:', error);
            toast.error(t('Failed to update usage configuration'));
        } finally {
            setSaving(false);
        }
    };
    
    // 重置配置
    const handleResetConfig = () => {
        if (originalConfig) {
            setUsageConfig(originalConfig);
            setHasChanges(false);
        }
    };
    
    // 根据模型类型过滤模型
    const getModelsForType = (type: string) => {
        return models.filter(model => model.model_type === type && model.status === 1);
    };
    
    // 获取选中模型的显示信息
    const getSelectedModelInfo = (modelId: string) => {
        const model = models.find(m => m.id === modelId);
        return model ? {
            name: model.display_name || model.model_name,
            provider: model.provider?.name || 'Unknown'
        } : null;
    };
    
    // 初始加载
    useEffect(() => {
        loadData();
    }, []);
    
    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <Card>
                <CardBody>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold mb-2">{t('Usage Configuration')}</h3>
                            <p className="text-default-600">
                                {t('Configure AI models for different functional modules, including chat, vectorization, vision, etc.')}
                            </p>
                        </div>
                        
                        {hasChanges && (
                            <div className="flex gap-2">
                                <Button
                                    variant="light"
                                    onPress={handleResetConfig}
                                    isDisabled={saving}
                                >
                                    {t('Reset')}
                                </Button>
                                <Button
                                    color="primary"
                                    startContent={<Icon icon="material-symbols:save" />}
                                    onPress={handleSaveConfig}
                                    isLoading={saving}
                                >
                                    {t('Save Changes')}
                                </Button>
                            </div>
                        )}
                    </div>
                </CardBody>
            </Card>
            
            {/* 配置表单 */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Icon icon="material-symbols:settings-applications" className="text-primary" />
                        <h4 className="text-md font-medium">{t('Module Configuration')}</h4>
                    </div>
                </CardHeader>
                <CardBody>
                    {loading ? (
                        // 加载骨架屏
                        <div className="space-y-6">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                                    <Skeleton className="w-10 h-10 rounded" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-3 w-48" />
                                    </div>
                                    <Skeleton className="h-10 w-64" />
                                </div>
                            ))}
                        </div>
                    ) : usageConfig ? (
                        <div className="space-y-6">
                            {moduleConfigs.map((module) => {
                                const availableModels = getModelsForType(module.key);
                                const selectedModelId = usageConfig[module.key];
                                const selectedModel = getSelectedModelInfo(selectedModelId);
                                
                                return (
                                    <div key={module.key} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-default-50 transition-colors">
                                        {/* 模块图标和信息 */}
                                        <div className={`p-2 rounded-lg bg-${module.color}/10 flex-shrink-0`}>
                                            <Icon 
                                                icon={module.icon} 
                                                width={24} 
                                                className={`text-${module.color}`} 
                                            />
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h5 className="font-medium text-default-900">{module.label}</h5>
                                                {module.required && (
                                                    <Chip color="danger" size="sm" variant="flat">
                                                        {t('Required')}
                                                    </Chip>
                                                )}
                                            </div>
                                            <p className="text-sm text-default-500">{module.description}</p>
                                            {selectedModel && (
                                                <div className="flex items-center gap-1 mt-1 text-xs text-default-400">
                                                    <Icon icon="material-symbols:info-outline" width={12} />
                                                    <span>{selectedModel.provider} • {selectedModel.name}</span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* 模型选择器 */}
                                        <div className="w-64 flex-shrink-0">
                                            <Select
                                                placeholder={t('Select model')}
                                                selectedKeys={selectedModelId ? [selectedModelId] : []}
                                                onSelectionChange={(keys) => {
                                                    const selected = Array.from(keys)[0] as string;
                                                    handleConfigChange(module.key, selected);
                                                }}
                                                isDisabled={availableModels.length === 0}
                                                size="sm"
                                            >
                                                {availableModels.map((model) => (
                                                    <SelectItem 
                                                        key={model.id}
                                                        textValue={`${model.display_name || model.model_name} (${model.provider?.name})`}
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">
                                                                {model.display_name || model.model_name}
                                                            </span>
                                                            <span className="text-xs text-default-500">
                                                                {model.provider?.name}
                                                            </span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </Select>
                                            
                                            {availableModels.length === 0 && (
                                                <p className="text-xs text-danger mt-1">
                                                    {t('No available models for this type')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <Icon icon="material-symbols:error-outline" width={48} className="text-default-400 mb-2" />
                            <p className="text-default-500">{t('Failed to load usage configuration')}</p>
                            <Button
                                variant="light"
                                color="primary"
                                startContent={<Icon icon="material-symbols:refresh" />}
                                onPress={loadData}
                                className="mt-2"
                            >
                                {t('Retry')}
                            </Button>
                        </div>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}