import { 
    Button, 
    Card, 
    CardBody, 
    Input, 
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    Pagination, 
    Select, 
    SelectItem, 
    Skeleton,
    useDisclosure
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import ProviderCard from './provider-card';
import ProviderForm from './provider-form';
import { Provider, ProviderFormData } from '@/types/ai-admin';
import { providerAPI } from '@/apis/ai-admin';

export default function Providers() {
    const { t } = useTranslation('ai-admin');
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    
    // 状态管理
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true); // 首次加载标记（不变的）
    const [showSkeleton, setShowSkeleton] = useState(false); // 控制skeleton显示
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    
    // 分页状态
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    
    // 表单状态
    const [editingProvider, setEditingProvider] = useState<Provider | undefined>(undefined);
    const [formLoading, setFormLoading] = useState(false);
    
    // 操作状态
    const [toggleLoadingIds, setToggleLoadingIds] = useState<Set<string>>(new Set());
    const [deleteLoadingIds, setDeleteLoadingIds] = useState<Set<string>>(new Set());
    const [refreshTrigger, setRefreshTrigger] = useState(0); // 用于触发数据刷新
    
    // Debounce 搜索词
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500); // 500ms 延迟
        
        return () => clearTimeout(timer);
    }, [searchTerm]);
    
    // 搜索时重置页码
    useEffect(() => {
        if (!isInitialLoad && debouncedSearchTerm !== '') {
            setCurrentPage(1);
        }
    }, [debouncedSearchTerm, isInitialLoad]);
    
    // 统一的数据加载逻辑
    useEffect(() => {
        const loadProviders = async () => {
            const isSearching = !isInitialLoad && debouncedSearchTerm !== '';
            
            // 设置加载状态
            if (isInitialLoad) {
                setShowSkeleton(true);
            } else if (isSearching) {
                // 搜索时显示 skeleton（因为是全新的列表数据）
                setShowSkeleton(true);
            } else {
                setLoading(true);
            }
            
            try {
                const params: any = {
                    page: currentPage,
                    limit: pageSize,
                };
                
                // 添加搜索条件
                if (debouncedSearchTerm) {
                    params.name = debouncedSearchTerm;
                }
                
                // 添加状态过滤
                if (statusFilter !== 'all') {
                    params.status = parseInt(statusFilter);
                }
                
                const data = await providerAPI.getProviders(params);
                setProviders(data.list || []);
                setTotal(data.total || 0);
                
                // 首次加载完成后，标记为非初始加载
                if (isInitialLoad) {
                    setIsInitialLoad(false);
                }
            } catch (error) {
                console.error('Failed to load providers:', error);
                toast.error(t('Failed to load providers'));
                // 设置为空数组以显示空状态
                setProviders([]);
                setTotal(0);
            } finally {
                setShowSkeleton(false);
                setLoading(false);
            }
        };
        
        loadProviders();
    }, [currentPage, debouncedSearchTerm, statusFilter, pageSize, t, refreshTrigger]);
    
    // 处理搜索（只更新输入值，不立即发起请求）
    const handleSearch = (value: string) => {
        setSearchTerm(value);
    };
    
    // 处理状态过滤
    const handleStatusFilter = (value: string) => {
        setStatusFilter(value);
        setCurrentPage(1);
    };
    
    // 处理分页
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };
    
    // 处理创建提供商
    const handleCreateProvider = () => {
        setEditingProvider(undefined);
        onOpen();
    };
    
    // 处理编辑提供商
    const handleEditProvider = (provider: Provider) => {
        setEditingProvider(provider);
        onOpen();
    };
    
    // 处理删除提供商
    const handleDeleteProvider = async (providerId: string) => {
        if (window.confirm(t('Are you sure you want to delete this provider?'))) {
            // 设置删除加载状态
            setDeleteLoadingIds(prev => new Set([...prev, providerId]));
            try {
                await providerAPI.deleteProvider(providerId);
                // 触发数据刷新
                setRefreshTrigger(prev => prev + 1);
            } catch (error) {
                console.error('Failed to delete provider:', error);
                toast.error(t('Failed to delete provider'));
            } finally {
                // 清除删除加载状态
                setDeleteLoadingIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(providerId);
                    return newSet;
                });
            }
        }
    };
    
    // 处理状态切换
    const handleToggleStatus = async (providerId: string) => {
        // 设置切换加载状态
        setToggleLoadingIds(prev => new Set([...prev, providerId]));
        try {
            await providerAPI.toggleProviderStatus(providerId);
            // 触发数据刷新
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error('Failed to toggle provider status:', error);
            toast.error(t('Failed to update provider status'));
        } finally {
            // 清除切换加载状态
            setToggleLoadingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(providerId);
                return newSet;
            });
        }
    };
    
    // 处理表单提交
    const handleFormSubmit = async (formData: ProviderFormData) => {
        setFormLoading(true);
        try {
            if (editingProvider) {
                // 更新提供商
                await providerAPI.updateProvider(editingProvider.id, formData);
            } else {
                // 创建新提供商
                await providerAPI.createProvider(formData);
            }
            
            // 触发数据刷新
            setRefreshTrigger(prev => prev + 1);
            toast.success(editingProvider ? t('Provider updated successfully') : t('Provider created successfully'));
            onOpenChange();
        } catch (error) {
            console.error('Failed to save provider:', error);
            toast.error(editingProvider ? t('Failed to update provider') : t('Failed to create provider'));
        } finally {
            setFormLoading(false);
        }
    };
    
    // 处理表单取消
    const handleFormCancel = () => {
        setEditingProvider(undefined);
        onOpenChange();
    };
    
    return (
        <div className="space-y-6">
            {/* 页面标题和操作 */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-xl font-semibold">{t('Model Providers')}</h2>
                    <p className="text-sm text-default-600 mt-1">
                        {t('Manage AI model providers, including OpenAI, Azure OpenAI and other services')}
                    </p>
                </div>
                <Button
                    color="primary"
                    startContent={<Icon icon="material-symbols:add" />}
                    onPress={handleCreateProvider}
                >
                    {t('Add Provider')}
                </Button>
            </div>
            
            {/* 搜索和过滤 */}
            <Card>
                <CardBody className="p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center">
                        <Input
                            placeholder={t('Search providers...')}
                            value={searchTerm}
                            onValueChange={handleSearch}
                            startContent={<Icon icon="material-symbols:search" />}
                            className="md:w-80"
                        />
                        <Select
                            placeholder={t('Filter by status')}
                            aria-label={t('Filter by status')}
                            selectedKeys={statusFilter ? [statusFilter] : []}
                            onSelectionChange={(keys) => handleStatusFilter(Array.from(keys)[0] as string)}
                            className="md:w-48"
                        >
                            <SelectItem key="all">{t('All Status')}</SelectItem>
                            <SelectItem key="1">{t('Enabled')}</SelectItem>
                            <SelectItem key="0">{t('Disabled')}</SelectItem>
                        </Select>
                    </div>
                </CardBody>
            </Card>
            
            {/* 提供商列表 */}
            <div className="space-y-4">
                {showSkeleton ? (
                    // 首次加载骨架屏
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
                ) : providers.length > 0 ? (
                    // 提供商列表
                    providers.map((provider) => (
                        <ProviderCard
                            key={provider.id}
                            provider={provider}
                            onEdit={() => handleEditProvider(provider)}
                            onDelete={() => handleDeleteProvider(provider.id)}
                            onToggleStatus={() => handleToggleStatus(provider.id)}
                            isToggleLoading={toggleLoadingIds.has(provider.id)}
                            isDeleteLoading={deleteLoadingIds.has(provider.id)}
                        />
                    ))
                ) : (
                    // 空状态
                    <Card>
                        <CardBody className="p-12">
                            <div className="text-center">
                                <Icon 
                                    icon="material-symbols:cloud-off" 
                                    width={48} 
                                    height={48} 
                                    className="mx-auto text-default-400 mb-4"
                                />
                                <h3 className="text-lg font-medium mb-2">
                                    {searchTerm || statusFilter !== 'all' ? t('No providers found') : t('No providers yet')}
                                </h3>
                                <p className="text-default-500 mb-4">
                                    {searchTerm || statusFilter !== 'all' 
                                        ? t('Try adjusting your search or filter criteria')
                                        : t('Get started by adding your first AI model provider')
                                    }
                                </p>
                                {!searchTerm && statusFilter === 'all' && (
                                    <Button 
                                        color="primary" 
                                        startContent={<Icon icon="material-symbols:add" />}
                                        onPress={handleCreateProvider}
                                    >
                                        {t('Add Provider')}
                                    </Button>
                                )}
                            </div>
                        </CardBody>
                    </Card>
                )}
            </div>
            
            {/* 分页 */}
            {total > pageSize && (
                <div className="flex justify-center">
                    <Pagination
                        total={Math.ceil(total / pageSize)}
                        page={currentPage}
                        onChange={handlePageChange}
                        showControls
                        showShadow
                        color="primary"
                    />
                </div>
            )}
            
            {/* 添加/编辑提供商模态框 */}
            <Modal 
                isOpen={isOpen} 
                onOpenChange={onOpenChange}
                size="3xl"
                scrollBehavior="inside"
                isDismissable={!formLoading}
                isKeyboardDismissDisabled={formLoading}
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                <h3 className="text-lg font-semibold">
                                    {editingProvider ? t('Edit Provider') : t('Add Provider')}
                                </h3>
                                <p className="text-sm text-default-500">
                                    {editingProvider 
                                        ? t('Update the AI model provider configuration')
                                        : t('Create a new AI model provider configuration')
                                    }
                                </p>
                            </ModalHeader>
                            <ModalBody className="p-0">
                                <div className="px-6 pb-6">
                                    <ProviderForm
                                        provider={editingProvider}
                                        onSubmit={handleFormSubmit}
                                        onCancel={handleFormCancel}
                                        loading={formLoading}
                                    />
                                </div>
                            </ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}