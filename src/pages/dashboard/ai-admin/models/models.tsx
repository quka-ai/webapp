import { Button, Card, CardBody, Input, Modal, ModalBody, ModalContent, ModalHeader, Select, SelectItem, Skeleton, useDisclosure } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import DeleteConfirm from '../components/delete-confirm';
import ModelCard from './model-card';
import ModelForm from './model-form';

import { modelConfigAPI, providerAPI } from '@/apis/ai-admin';
import { ModelConfig, ModelFormData } from '@/types/ai-admin';

export default function Models() {
    const { t } = useTranslation('ai-admin');
    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    // 状态管理
    const [models, setModels] = useState<ModelConfig[]>([]);
    const [loading, setLoading] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [showSkeleton, setShowSkeleton] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [providerFilter, setProviderFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');

    // 移除分页状态，因为接口不需要分页

    // 表单状态
    const [editingModel, setEditingModel] = useState<ModelConfig | undefined>(undefined);
    const [formLoading, setFormLoading] = useState(false);

    // 删除确认状态
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [modelToDelete, setModelToDelete] = useState<ModelConfig | null>(null);

    // 操作状态
    const [toggleLoadingIds, setToggleLoadingIds] = useState<Set<string>>(new Set());
    const [deleteLoadingIds, setDeleteLoadingIds] = useState<Set<string>>(new Set());
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // 提供商列表（用于筛选）
    const [providers, setProviders] = useState<Array<{ id: string; name: string }>>([]);

    // Debounce 搜索词
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    // 加载提供商列表
    useEffect(() => {
        const loadProviders = async () => {
            try {
                const data = await providerAPI.getProviders({ limit: 100 });
                setProviders((data.list || []).map(p => ({ id: p.id, name: p.name })));
            } catch (error) {
                console.error('Failed to load providers:', error);
            }
        };

        loadProviders();
    }, []);

    // 移除搜索时重置页码的逻辑，因为不需要分页

    // 统一的数据加载逻辑
    useEffect(() => {
        const loadModels = async () => {
            // 设置加载状态
            if (isInitialLoad) {
                setShowSkeleton(true);
            } else {
                // 非初始加载时，任何数据变化都使用skeleton，因为需要重新渲染整个列表
                setShowSkeleton(true);
            }

            try {
                const params: any = {};

                // 添加搜索条件（搜索模型名称和显示名称）
                if (debouncedSearchTerm) {
                    params.name = debouncedSearchTerm;
                }

                // 添加提供商过滤
                if (providerFilter !== 'all') {
                    params.provider_id = providerFilter;
                }

                // 添加模型类型过滤
                if (typeFilter !== 'all') {
                    params.model_type = typeFilter;
                }

                const data = await modelConfigAPI.getModelConfigs(params);
                setModels(data.list || []);

                // 首次加载完成后，标记为非初始加载
                if (isInitialLoad) {
                    setIsInitialLoad(false);
                }
            } catch (error) {
                console.error('Failed to load models:', error);
                toast.error(t('Failed to load model configurations'));
                setModels([]);
            } finally {
                setShowSkeleton(false);
                setLoading(false);
            }
        };

        loadModels();
    }, [debouncedSearchTerm, providerFilter, typeFilter, t, refreshTrigger]);

    // 处理搜索
    const handleSearch = (value: string) => {
        setSearchTerm(value);
        // 立即设置skeleton状态以提供视觉反馈
        if (!isInitialLoad && value !== searchTerm) {
            setShowSkeleton(true);
        }
    };

    // 处理提供商过滤
    const handleProviderFilter = (value: string) => {
        setProviderFilter(value);
        // 立即设置skeleton状态以提供视觉反馈
        if (!isInitialLoad) {
            setShowSkeleton(true);
        }
    };

    // 处理模型类型过滤
    const handleTypeFilter = (value: string) => {
        setTypeFilter(value);
        // 立即设置skeleton状态以提供视觉反馈
        if (!isInitialLoad) {
            setShowSkeleton(true);
        }
    };

    // 处理创建模型配置
    const handleCreateModel = () => {
        setEditingModel(undefined);
        onOpen();
    };

    // 处理编辑模型配置
    const handleEditModel = (model: ModelConfig) => {
        setEditingModel(model);
        onOpen();
    };

    // 处理删除模型配置
    const handleDeleteModel = (model: ModelConfig) => {
        setModelToDelete(model);
        setDeleteConfirmOpen(true);
    };

    // 确认删除模型配置
    const handleConfirmDelete = async () => {
        if (!modelToDelete) return;

        setDeleteLoadingIds(prev => new Set([...prev, modelToDelete.id]));
        try {
            await modelConfigAPI.deleteModelConfig(modelToDelete.id);

            // 直接从本地状态中移除，避免触发全局loading
            setModels(prev => prev.filter(m => m.id !== modelToDelete.id));

            toast.success(t('Model configuration deleted successfully'));
        } catch (error) {
            console.error('Failed to delete model:', error);
            toast.error(t('Failed to delete model configuration'));
        } finally {
            setDeleteLoadingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(modelToDelete.id);
                return newSet;
            });
            setDeleteConfirmOpen(false);
            setModelToDelete(null);
        }
    };

    // 取消删除
    const handleCancelDelete = () => {
        setDeleteConfirmOpen(false);
        setModelToDelete(null);
    };

    // 处理状态切换
    const handleToggleStatus = async (modelId: string) => {
        setToggleLoadingIds(prev => new Set([...prev, modelId]));
        try {
            const model = models.find(m => m.id === modelId);
            if (model) {
                const newStatus = model.status === 1 ? 0 : 1;
                await modelConfigAPI.updateModelConfig(modelId, { status: newStatus });

                // 直接更新本地状态，避免触发全局loading
                setModels(prev => prev.map(m => (m.id === modelId ? { ...m, status: newStatus } : m)));

                toast.success(t('Model status updated successfully'));
            }
        } catch (error) {
            console.error('Failed to toggle model status:', error);
            toast.error(t('Failed to update model status'));
        } finally {
            setToggleLoadingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(modelId);
                return newSet;
            });
        }
    };

    // 处理表单提交
    const handleFormSubmit = async (formData: ModelFormData) => {
        setFormLoading(true);
        try {
            if (editingModel) {
                const updatedModel = await modelConfigAPI.updateModelConfig(editingModel.id, formData);

                // 直接更新本地状态，避免触发全局loading
                setModels(prev => prev.map(m => (m.id === editingModel.id ? { ...m, ...updatedModel } : m)));

                toast.success(t('Model configuration updated successfully'));
            } else {
                const newModel = await modelConfigAPI.createModelConfig(formData);

                // 直接添加到本地状态，避免触发全局loading
                setModels(prev => [newModel, ...prev]);

                toast.success(t('Model configuration created successfully'));
            }

            onOpenChange();
        } catch (error) {
            console.error('Failed to save model:', error);
            toast.error(editingModel ? t('Failed to update model configuration') : t('Failed to create model configuration'));
        } finally {
            setFormLoading(false);
        }
    };

    // 处理表单取消
    const handleFormCancel = () => {
        setEditingModel(undefined);
        onOpenChange();
    };

    // 模型类型选项
    const modelTypes = [
        { key: 'chat', label: t('Chat') },
        { key: 'embedding', label: t('Embedding') },
        { key: 'vision', label: t('Vision') },
        { key: 'rerank', label: t('Rerank') },
        { key: 'reader', label: t('Reader') },
        { key: 'enhance', label: t('Enhance') }
    ];

    return (
        <div className="space-y-6">
            {/* 页面标题和操作 */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-xl font-semibold">{t('Model Configurations')}</h2>
                    <p className="text-sm text-default-600 mt-1">{t('Manage AI model configurations, including parameters and settings for each model')}</p>
                </div>
                <Button color="primary" startContent={<Icon icon="material-symbols:add" />} onPress={handleCreateModel}>
                    {t('Add Model Configuration')}
                </Button>
            </div>

            {/* 搜索和过滤 */}
            <Card>
                <CardBody className="p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center">
                        <Input
                            placeholder={t('Search model configurations...')}
                            value={searchTerm}
                            onValueChange={handleSearch}
                            startContent={<Icon icon="material-symbols:search" />}
                            className="md:w-80"
                        />
                        <Select
                            placeholder={t('Filter by provider')}
                            aria-label={t('Filter by provider')}
                            selectedKeys={providerFilter ? [providerFilter] : []}
                            className="md:w-48"
                            onSelectionChange={keys => handleProviderFilter(Array.from(keys)[0] as string)}
                        >
                            <>
                                <SelectItem key="all">{t('All Providers')}</SelectItem>
                                {providers.map(provider => (
                                    <SelectItem key={provider.id}>{provider.name}</SelectItem>
                                ))}
                            </>
                        </Select>
                        <Select
                            placeholder={t('Filter by type')}
                            aria-label={t('Filter by type')}
                            selectedKeys={typeFilter ? [typeFilter] : []}
                            className="md:w-48"
                            onSelectionChange={keys => handleTypeFilter(Array.from(keys)[0] as string)}
                        >
                            <>
                                <SelectItem key="all">{t('All Types')}</SelectItem>
                                {modelTypes.map(type => (
                                    <SelectItem key={type.key}>{type.label}</SelectItem>
                                ))}
                            </>
                        </Select>
                    </div>
                </CardBody>
            </Card>

            {/* 模型配置列表 */}
            <div className="space-y-4">
                {showSkeleton ? (
                    // 加载骨架屏
                    Array.from({ length: 3 }).map((_, index) => (
                        <Card key={index}>
                            <CardBody className="p-6">
                                <div className="flex items-start gap-4">
                                    <Skeleton className="w-12 h-12 rounded-lg" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-48" />
                                        <Skeleton className="h-3 w-96" />
                                        <Skeleton className="h-3 w-24" />
                                    </div>
                                    <div className="flex gap-2">
                                        <Skeleton className="h-8 w-16" />
                                        <Skeleton className="h-8 w-8" />
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    ))
                ) : models.length > 0 ? (
                    // 模型配置列表
                    models.map(model => (
                        <ModelCard
                            key={model.id}
                            model={model}
                            onEdit={() => handleEditModel(model)}
                            onDelete={() => handleDeleteModel(model)}
                            onToggleStatus={() => handleToggleStatus(model.id)}
                            isToggleLoading={toggleLoadingIds.has(model.id)}
                            isDeleteLoading={deleteLoadingIds.has(model.id)}
                        />
                    ))
                ) : (
                    // 空状态
                    <Card>
                        <CardBody className="p-12">
                            <div className="text-center">
                                <Icon icon="material-symbols:settings" width={48} height={48} className="mx-auto text-default-400 mb-4" />
                                <h3 className="text-lg font-medium mb-2">
                                    {searchTerm || providerFilter !== 'all' || typeFilter !== 'all' ? t('No model configurations found') : t('No model configurations yet')}
                                </h3>
                                <p className="text-default-500 mb-4">
                                    {searchTerm || providerFilter !== 'all' || typeFilter !== 'all'
                                        ? t('Try adjusting your search or filter criteria')
                                        : t('Get started by adding your first model configuration')}
                                </p>
                                {!searchTerm && providerFilter === 'all' && typeFilter === 'all' && (
                                    <Button color="primary" startContent={<Icon icon="material-symbols:add" />} onPress={handleCreateModel}>
                                        {t('Add Model Configuration')}
                                    </Button>
                                )}
                            </div>
                        </CardBody>
                    </Card>
                )}
            </div>

            {/* 移除分页组件，因为接口不需要分页 */}

            {/* 添加/编辑模型配置模态框 */}
            <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="3xl" scrollBehavior="inside" isDismissable={!formLoading} isKeyboardDismissDisabled={formLoading}>
                <ModalContent>
                    {onClose => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                <h3 className="text-lg font-semibold">{editingModel ? t('Edit Model Configuration') : t('Add Model Configuration')}</h3>
                                <p className="text-sm text-default-500">
                                    {editingModel ? t('Update the AI model configuration and parameters') : t('Create a new AI model configuration with custom parameters')}
                                </p>
                            </ModalHeader>
                            <ModalBody className="p-0">
                                <div className="px-6 pb-6">
                                    <ModelForm model={editingModel} providers={providers} onSubmit={handleFormSubmit} onCancel={handleFormCancel} loading={formLoading} />
                                </div>
                            </ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* 删除确认弹窗 */}
            <DeleteConfirm
                isOpen={deleteConfirmOpen}
                title={t('Delete Model Configuration')}
                content={t('Are you sure you want to delete this model configuration?')}
                isLoading={modelToDelete ? deleteLoadingIds.has(modelToDelete.id) : false}
                onClose={handleCancelDelete}
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}
