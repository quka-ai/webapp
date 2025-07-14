import {
    Button,
    Input,
    Select,
    SelectItem,
    Switch,
    Textarea,
    Divider,
    Chip
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Provider, ProviderFormData } from '@/types/ai-admin';

interface ProviderFormProps {
    provider?: Provider;
    onSubmit: (data: ProviderFormData) => void;
    onCancel: () => void;
    loading?: boolean;
}

const DEFAULT_FORM_DATA: ProviderFormData = {
    name: '',
    description: '',
    api_url: '',
    api_key: '',
    status: 1,
    config: {
        timeout: 30000,
        max_retries: 3,
        is_reader: false
    }
};

export default function ProviderForm({ provider, onSubmit, onCancel, loading = false }: ProviderFormProps) {
    const { t } = useTranslation('ai-admin');
    const [formData, setFormData] = useState<ProviderFormData>(DEFAULT_FORM_DATA);
    const [errors, setErrors] = useState<Partial<Record<keyof ProviderFormData, string>>>({});

    // 编辑模式时填充表单数据
    useEffect(() => {
        if (provider) {
            setFormData({
                name: provider.name || '',
                description: provider.description || '',
                api_url: provider.api_url || '',
                api_key: provider.api_key || '',
                status: provider.status ?? 1,
                config: {
                    ...provider.config,
                    timeout: provider.config?.timeout || 30000,
                    max_retries: provider.config?.max_retries || 3,
                    is_reader: provider.config?.is_reader || false,
                }
            });
        }
    }, [provider]);

    // 表单验证
    const validateForm = (): boolean => {
        const newErrors: Partial<Record<keyof ProviderFormData, string>> = {};

        // 必填字段验证
        if (!formData.name || !formData.name.trim()) {
            newErrors.name = t('Provider name is required');
        } else if (formData.name.length < 2) {
            newErrors.name = t('Provider name must be at least 2 characters');
        }

        if (!formData.description || !formData.description.trim()) {
            newErrors.description = t('Description is required');
        }

        if (!formData.api_url || !formData.api_url.trim()) {
            newErrors.api_url = t('API URL is required');
        } else if (!isValidUrl(formData.api_url)) {
            newErrors.api_url = t('Please enter a valid URL');
        }

        if (!formData.api_key || !formData.api_key.trim()) {
            newErrors.api_key = t('API Key is required');
        } else if (formData.api_key.length < 10) {
            newErrors.api_key = t('API Key must be at least 10 characters');
        }

        // 配置验证
        if (formData.config && typeof formData.config.timeout === 'number') {
            if (formData.config.timeout < 1000 || formData.config.timeout > 300000) {
                newErrors.config = t('Timeout must be between 1,000 and 300,000 milliseconds');
            }
        }

        if (formData.config && typeof formData.config.max_retries === 'number') {
            if (formData.config.max_retries < 0 || formData.config.max_retries > 10) {
                newErrors.config = t('Max retries must be between 0 and 10');
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // URL验证
    const isValidUrl = (url: string): boolean => {
        try {
            new URL(url);
            return url.startsWith('http://') || url.startsWith('https://');
        } catch {
            return false;
        }
    };

    // 处理表单提交
    const handleSubmit = () => {
        if (validateForm()) {
            onSubmit(formData);
        }
    };

    // 处理输入变化
    const handleInputChange = (field: keyof ProviderFormData, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
        
        // 清除对应字段的错误
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: undefined
            }));
        }
    };

    // 处理配置变化
    const handleConfigChange = (field: keyof ProviderFormData['config'], value: any) => {
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

    // 预设配置模板
    const presetConfigs = [
        {
            name: 'OpenAI',
            api_url: 'https://api.openai.com/v1',
            description: 'Official OpenAI API'
        },
        {
            name: 'Azure OpenAI',
            api_url: 'https://YOUR_RESOURCE_NAME.openai.azure.com',
            description: 'Microsoft Azure OpenAI Service'
        },
        {
            name: 'Anthropic',
            api_url: 'https://api.anthropic.com',
            description: 'Anthropic Claude API'
        },
        {
            name: 'Jina',
            api_url: 'https://r.jina.ai',
            description: 'Jina Reader API (with Reader support)',
            is_reader: true
        }
    ];

    const applyPreset = (preset: typeof presetConfigs[0]) => {
        setFormData(prev => ({
            ...prev,
            name: preset.name,
            api_url: preset.api_url,
            description: preset.description,
            config: {
                ...prev.config,
                is_reader: (preset as any).is_reader || false
            }
        }));
    };

    return (
        <div className="space-y-6">
            {/* 预设配置 */}
            {!provider && (
                <div>
                    <h4 className="text-sm font-medium mb-2">{t('Quick Start Templates')}</h4>
                    <div className="flex flex-wrap gap-2">
                        {presetConfigs.map((preset) => (
                            <Chip
                                key={preset.name}
                                variant="flat"
                                color="primary"
                                className="cursor-pointer hover:bg-primary/20"
                                onClick={() => applyPreset(preset)}
                            >
                                {preset.name}
                            </Chip>
                        ))}
                    </div>
                    <Divider className="my-4" />
                </div>
            )}

            {/* 基本信息 */}
            <div className="space-y-4">
                <h4 className="text-sm font-medium">{t('Basic Information')}</h4>
                
                <Input
                    label={t('Provider Name')}
                    placeholder={t('Enter provider name')}
                    value={formData.name}
                    onValueChange={(value) => handleInputChange('name', value)}
                    isInvalid={!!errors.name}
                    errorMessage={errors.name}
                    isRequired
                />

                <Textarea
                    label={t('Description')}
                    placeholder={t('Enter provider description')}
                    value={formData.description}
                    onValueChange={(value) => handleInputChange('description', value)}
                    isInvalid={!!errors.description}
                    errorMessage={errors.description}
                    maxRows={3}
                    isRequired
                />

                <Input
                    label={t('API URL')}
                    placeholder="https://api.example.com/v1"
                    value={formData.api_url}
                    onValueChange={(value) => handleInputChange('api_url', value)}
                    isInvalid={!!errors.api_url}
                    errorMessage={errors.api_url}
                    startContent={<Icon icon="material-symbols:link" width={16} />}
                    isRequired
                />

                <Input
                    label={t('API Key')}
                    placeholder={t('Enter your API key')}
                    value={formData.api_key}
                    onValueChange={(value) => handleInputChange('api_key', value)}
                    isInvalid={!!errors.api_key}
                    errorMessage={errors.api_key}
                    startContent={<Icon icon="material-symbols:key" width={16} />}
                    type="password"
                    isRequired
                />

                <div className="flex items-center gap-2">
                    <Switch
                        isSelected={formData.status === 1}
                        onValueChange={(checked) => handleInputChange('status', checked ? 1 : 0)}
                    />
                    <span className="text-sm">{t('Enable this provider')}</span>
                </div>
            </div>

            <Divider />

            {/* 高级配置 */}
            <div className="space-y-4">
                <h4 className="text-sm font-medium">{t('Advanced Configuration')}</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label={t('Timeout (ms)')}
                        placeholder="30000"
                        type="number"
                        value={formData.config.timeout.toString()}
                        onValueChange={(value) => handleConfigChange('timeout', parseInt(value) || 30000)}
                        isInvalid={!!errors.config}
                        description={t('Request timeout in milliseconds')}
                        min={1000}
                        max={300000}
                    />

                    <Input
                        label={t('Max Retries')}
                        placeholder="3"
                        type="number"
                        value={formData.config.max_retries.toString()}
                        onValueChange={(value) => handleConfigChange('max_retries', parseInt(value) || 3)}
                        isInvalid={!!errors.config}
                        description={t('Maximum number of retry attempts')}
                        min={0}
                        max={10}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Switch
                        isSelected={formData.config.is_reader || false}
                        onValueChange={(checked) => handleConfigChange('is_reader', checked)}
                    />
                    <div className="flex items-center gap-2">
                        <Icon icon="material-symbols:chrome-reader-mode" width={16} className="text-default-400" />
                        <span className="text-sm">{t('Enable Reader Support')}</span>
                    </div>
                </div>
                <p className="text-xs text-default-500 pl-6">
                    {t('Indicates this provider supports document reading functionality')}
                </p>

                {errors.config && (
                    <p className="text-danger text-sm">{errors.config}</p>
                )}
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-end gap-2 pt-4">
                <Button
                    variant="light"
                    onPress={onCancel}
                    isDisabled={loading}
                >
                    {t('Cancel')}
                </Button>
                <Button
                    color="primary"
                    onPress={handleSubmit}
                    isLoading={loading}
                    startContent={!loading ? <Icon icon="material-symbols:save" width={16} /> : undefined}
                >
                    {provider ? t('Update Provider') : t('Create Provider')}
                </Button>
            </div>
        </div>
    );
}