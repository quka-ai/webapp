import { 
    Button, 
    Card, 
    CardBody, 
    CardHeader, 
    Divider, 
    Input, 
    Select, 
    SelectItem, 
    Switch, 
    Textarea 
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { ModelConfig, ModelFormData } from '@/types/ai-admin';

interface ModelFormProps {
    model?: ModelConfig;
    providers: Array<{id: string, name: string}>;
    onSubmit: (data: ModelFormData) => void;
    onCancel: () => void;
    loading?: boolean;
}

export default function ModelForm({ 
    model, 
    providers, 
    onSubmit, 
    onCancel, 
    loading = false 
}: ModelFormProps) {
    const { t } = useTranslation('ai-admin');
    
    // 表单数据
    const [formData, setFormData] = useState<ModelFormData>({
        provider_id: '',
        model_name: '',
        display_name: '',
        model_type: 'chat',
        is_multi_modal: false,
        thinking_support: 0,
        status: 1,
        config: {
            max_tokens: 4096,
            temperature: 0.7,
            top_p: 0.9
        }
    });
    
    // 表单验证错误
    const [errors, setErrors] = useState<Partial<Record<keyof ModelFormData, string>>>({});
    
    // 模型类型选项
    const modelTypes = [
        { key: 'chat', label: t('Chat'), icon: 'material-symbols:chat' },
        { key: 'embedding', label: t('Embedding'), icon: 'material-symbols:data-array' },
        { key: 'vision', label: t('Vision'), icon: 'material-symbols:visibility' },
        { key: 'rerank', label: t('Rerank'), icon: 'material-symbols:sort' },
        { key: 'reader', label: t('Reader'), icon: 'material-symbols:chrome-reader-mode' },
        { key: 'enhance', label: t('Enhance'), icon: 'material-symbols:auto-fix-high' }
    ];
    
    // 初始化表单数据
    useEffect(() => {
        if (model) {
            setFormData({
                provider_id: model.provider_id || '',
                model_name: model.model_name || '',
                display_name: model.display_name || '',
                model_type: model.model_type || 'chat',
                is_multi_modal: model.is_multi_modal || false,
                thinking_support: model.thinking_support ?? 0,
                status: model.status || 1,
                config: {
                    max_tokens: model.config?.max_tokens || 4096,
                    temperature: model.config?.temperature || 0.7,
                    top_p: model.config?.top_p || 0.9,
                    ...model.config
                }
            });
        } else {
            // 重置表单为默认值
            setFormData({
                provider_id: '',
                model_name: '',
                display_name: '',
                model_type: 'chat',
                is_multi_modal: false,
                thinking_support: 0,
                status: 1,
                config: {
                    max_tokens: 4096,
                    temperature: 0.7,
                    top_p: 0.9
                }
            });
        }
        setErrors({});
    }, [model]);
    
    // 表单验证
    const validateForm = (): boolean => {
        const newErrors: Partial<Record<keyof ModelFormData, string>> = {};
        
        // 提供商验证
        if (!formData.provider_id || !formData.provider_id.trim()) {
            newErrors.provider_id = t('Provider is required');
        }
        
        // 模型名称验证
        if (!formData.model_name || !formData.model_name.trim()) {
            newErrors.model_name = t('Model name is required');
        } else if (formData.model_name.trim().length < 2) {
            newErrors.model_name = t('Model name must be at least 2 characters');
        }
        
        // 显示名称验证
        if (!formData.display_name || !formData.display_name.trim()) {
            newErrors.display_name = t('Display name is required');
        } else if (formData.display_name.trim().length < 2) {
            newErrors.display_name = t('Display name must be at least 2 characters');
        }
        
        // 参数验证
        if (formData.config.max_tokens && (formData.config.max_tokens < 1 || formData.config.max_tokens > 32768)) {
            newErrors.config = t('Max tokens must be between 1 and 32768');
        }
        
        if (formData.config.temperature !== undefined && (formData.config.temperature < 0 || formData.config.temperature > 2)) {
            newErrors.config = t('Temperature must be between 0 and 2');
        }
        
        if (formData.config.top_p !== undefined && (formData.config.top_p < 0 || formData.config.top_p > 1)) {
            newErrors.config = t('Top P must be between 0 and 1');
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    
    // 处理表单提交
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validateForm()) {
            onSubmit(formData);
        }
    };
    
    // 处理输入变化
    const handleInputChange = (field: keyof ModelFormData, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
        
        // 清除相关错误
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: undefined
            }));
        }
    };
    
    // 处理配置参数变化
    const handleConfigChange = (field: keyof ModelFormData['config'], value: any) => {
        setFormData(prev => ({
            ...prev,
            config: {
                ...prev.config,
                [field]: value
            }
        }));
        
        // 清除配置错误
        if (errors.config) {
            setErrors(prev => ({
                ...prev,
                config: undefined
            }));
        }
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* 基本信息 */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <Icon icon="material-symbols:info" className="text-primary" />
                        <h4 className="text-lg font-medium">{t('Basic Information')}</h4>
                    </div>
                </CardHeader>
                <CardBody className="space-y-4">
                    {/* 提供商选择 */}
                    <Select
                        label={t('Provider')}
                        placeholder={t('Select a provider')}
                        selectedKeys={formData.provider_id ? [formData.provider_id] : []}
                        onSelectionChange={(keys) => handleInputChange('provider_id', Array.from(keys)[0] as string)}
                        isInvalid={!!errors.provider_id}
                        errorMessage={errors.provider_id}
                        isRequired
                    >
                        {providers.map((provider) => (
                            <SelectItem key={provider.id}>
                                {provider.name}
                            </SelectItem>
                        ))}
                    </Select>
                    
                    {/* 模型类型选择 */}
                    <Select
                        label={t('Model Type')}
                        placeholder={t('Select model type')}
                        selectedKeys={[formData.model_type]}
                        onSelectionChange={(keys) => handleInputChange('model_type', Array.from(keys)[0] as string)}
                        isRequired
                    >
                        {modelTypes.map((type) => (
                            <SelectItem key={type.key} startContent={<Icon icon={type.icon} />}>
                                {type.label}
                            </SelectItem>
                        ))}
                    </Select>
                    
                    {/* 模型名称 */}
                    <Input
                        label={t('Model Name')}
                        placeholder={t('Enter model name')}
                        value={formData.model_name}
                        onValueChange={(value) => handleInputChange('model_name', value)}
                        isInvalid={!!errors.model_name}
                        errorMessage={errors.model_name}
                        isRequired
                    />
                    
                    {/* 显示名称 */}
                    <Input
                        label={t('Display Name')}
                        placeholder={t('Enter display name')}
                        value={formData.display_name}
                        onValueChange={(value) => handleInputChange('display_name', value)}
                        isInvalid={!!errors.display_name}
                        errorMessage={errors.display_name}
                        isRequired
                    />
                    
                    {/* 多模态支持 */}
                    <Switch
                        isSelected={formData.is_multi_modal}
                        onValueChange={(value) => handleInputChange('is_multi_modal', value)}
                    >
                        <div className="flex items-center gap-2">
                            <Icon icon="material-symbols:visibility" />
                            <span>{t('Multi-modal Support')}</span>
                        </div>
                    </Switch>
                    
                    {/* 思考功能支持 - 仅chat类型显示 */}
                    {formData.model_type === 'chat' && (
                        <Select
                            label={t('Thinking Support')}
                            placeholder={t('Select thinking support level')}
                            selectedKeys={[formData.thinking_support?.toString() || '0']}
                            onSelectionChange={(keys) => handleInputChange('thinking_support', parseInt(Array.from(keys)[0] as string))}
                            description={t('Configure whether this model supports thinking functionality')}
                        >
                            <SelectItem key="0" startContent={<Icon icon="material-symbols:block" />}>
                                {t('Not Supported')}
                            </SelectItem>
                            <SelectItem key="1" startContent={<Icon icon="material-symbols:toggle-off-outline" />}>
                                {t('Optional')}
                            </SelectItem>
                            <SelectItem key="2" startContent={<Icon icon="material-symbols:toggle-on-outline" />}>
                                {t('Required')}
                            </SelectItem>
                        </Select>
                    )}
                    
                    {/* 启用状态 */}
                    <Switch
                        isSelected={formData.status === 1}
                        onValueChange={(value) => handleInputChange('status', value ? 1 : 0)}
                    >
                        <div className="flex items-center gap-2">
                            <Icon icon="material-symbols:toggle-on" />
                            <span>{t('Enable this model')}</span>
                        </div>
                    </Switch>
                </CardBody>
            </Card>
            
            {/* 模型参数配置 */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <Icon icon="material-symbols:tune" className="text-secondary" />
                        <h4 className="text-lg font-medium">{t('Parameters')}</h4>
                    </div>
                </CardHeader>
                <CardBody className="space-y-4">
                    {/* 最大令牌数 */}
                    <Input
                        type="number"
                        label={t('Max Tokens')}
                        placeholder="4096"
                        value={formData.config.max_tokens?.toString() || ''}
                        onValueChange={(value) => handleConfigChange('max_tokens', value ? parseInt(value) : undefined)}
                        min={1}
                        max={32768}
                        isInvalid={!!errors.config}
                        errorMessage={errors.config}
                        description={t('Maximum number of tokens to generate')}
                    />
                    
                    {/* 温度 */}
                    <Input
                        type="number"
                        label={t('Temperature')}
                        placeholder="0.7"
                        value={formData.config.temperature?.toString() || ''}
                        onValueChange={(value) => handleConfigChange('temperature', value ? parseFloat(value) : undefined)}
                        min={0}
                        max={2}
                        step={0.1}
                        description={t('Controls randomness in generation')}
                    />
                    
                    {/* Top P */}
                    <Input
                        type="number"
                        label={t('Top P')}
                        placeholder="0.9"
                        value={formData.config.top_p?.toString() || ''}
                        onValueChange={(value) => handleConfigChange('top_p', value ? parseFloat(value) : undefined)}
                        min={0}
                        max={1}
                        step={0.1}
                        description={t('Controls diversity of generation')}
                    />
                </CardBody>
            </Card>
            
            {/* 操作按钮 */}
            <div className="flex justify-end gap-3">
                <Button 
                    variant="light" 
                    onPress={onCancel}
                    isDisabled={loading}
                >
                    {t('Cancel')}
                </Button>
                <Button 
                    type="submit"
                    color="primary" 
                    isLoading={loading}
                    startContent={!loading && <Icon icon="material-symbols:save" />}
                >
                    {model ? t('Update Model Configuration') : t('Create Model Configuration')}
                </Button>
            </div>
        </form>
    );
}