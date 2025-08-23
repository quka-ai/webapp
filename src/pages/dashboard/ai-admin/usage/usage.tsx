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
    chat_thinking?: string; // v3新增：思考聊天模型
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
            key: 'chat_thinking' as keyof UsageConfig,
            label: t('Chat Thinking'),
            icon: 'material-symbols:psychology',
            color: 'primary',
            description: t('AI model for chat functionality with thinking capability'),
            required: false
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
        // 对于 chat_thinking，需要筛选 chat 类型且支持思考的模型
        if (type === 'chat_thinking') {
            return models.filter(model => 
                model.model_type === 'chat' && 
                model.status === 1 &&
                (model.thinking_support === 1 || model.thinking_support === 2) // 可选或强制思考
            );
        }
        
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
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-xl font-semibold">{t('Usage Configuration')}</h2>
                    <p className="text-sm text-default-600 mt-1">
                        {t('Configure AI models for different functional modules, including chat, vectorization, vision, etc.')}
                    </p>
                </div>
                <div className="flex gap-2 h-10">
                    <Button
                        variant="light"
                        onPress={handleResetConfig}
                        isDisabled={saving || !hasChanges}
                        className={`transition-opacity duration-200 ${hasChanges ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    >
                        {t('Reset')}
                    </Button>
                    <Button
                        color="primary"
                        startContent={saving ? null : <Icon icon="material-symbols:save" />}
                        onPress={handleSaveConfig}
                        isLoading={saving}
                        isDisabled={!hasChanges}
                        spinnerPlacement="start"
                        className={`transition-opacity duration-200 ${hasChanges ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    >
                        {t('Save Changes')}
                    </Button>
                </div>
            </div>
            
            {/* 配置表单 */}
            <div className="space-y-4">
                {loading ? (
                    // 加载骨架屏
                    Array.from({ length: 6 }).map((_, index) => (
                        <Card key={index}>
                            <CardBody className="p-6">
                                <div className="flex items-center gap-4">
                                    <Skeleton className="w-10 h-10 rounded-lg" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-3 w-48" />
                                    </div>
                                    <Skeleton className="h-10 w-64" />
                                </div>
                            </CardBody>
                        </Card>
                    ))
                ) : usageConfig ? (
                    moduleConfigs.map((module) => {
                        const availableModels = getModelsForType(module.key);
                        const selectedModelId = usageConfig[module.key];
                        const selectedModel = getSelectedModelInfo(selectedModelId);
                        
                        return (
                            <Card key={module.key} className="hover:shadow-lg transition-shadow">
                                <CardBody className="p-4 sm:p-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                        {/* 模块图标和信息 */}
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className={`p-2 rounded-lg bg-${module.color}/10 flex-shrink-0`}>
                                                <Icon 
                                                    icon={module.icon} 
                                                    width={24} 
                                                    className={`text-${module.color}`} 
                                                />
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-lg font-semibold text-foreground">
                                                        {module.label}
                                                    </h3>
                                                    {module.required && (
                                                        <Chip color="danger" size="sm" variant="flat">
                                                            {t('Required')}
                                                        </Chip>
                                                    )}
                                                </div>
                                                <p className="text-sm text-default-600">
                                                    {module.description}
                                                </p>
                                                {selectedModel && (
                                                    <div className="flex items-center gap-1 mt-2 text-xs text-default-500">
                                                        <Icon icon="material-symbols:info-outline" width={12} />
                                                        <span>{selectedModel.provider} • {selectedModel.name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* 模型选择器 */}
                                        <div className="w-full sm:w-64 flex-shrink-0">
                                            <div className="flex flex-col">
                                                <Select
                                                    placeholder={t('Select model')}
                                                    selectedKeys={selectedModelId ? [selectedModelId] : []}
                                                    onSelectionChange={(keys) => {
                                                        const selected = Array.from(keys)[0] as string;
                                                        handleConfigChange(module.key, selected);
                                                    }}
                                                    isDisabled={availableModels.length === 0}
                                                    size="sm"
                                                    aria-label={`${module.label} model selection`}
                                                    className="w-full"
                                                >
                                                    <>
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
                                                    </>
                                                </Select>
                                                
                                                {availableModels.length === 0 && (
                                                    <p className="text-xs text-danger mt-1">
                                                        {t('No available models for this type')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        );
                    })
                ) : (
                    <Card>
                        <CardBody className="p-12">
                            <div className="text-center">
                                <Icon icon="material-symbols:error-outline" width={48} className="mx-auto text-default-400 mb-4" />
                                <h3 className="text-lg font-medium mb-2">
                                    {t('Failed to load usage configuration')}
                                </h3>
                                <p className="text-default-500 mb-4">
                                    {t('Unable to load the usage configuration. Please try again.')}
                                </p>
                                <Button
                                    variant="light"
                                    color="primary"
                                    startContent={<Icon icon="material-symbols:refresh" />}
                                    onPress={loadData}
                                >
                                    {t('Retry')}
                                </Button>
                            </div>
                        </CardBody>
                    </Card>
                )}
            </div>
        </div>
    );
}