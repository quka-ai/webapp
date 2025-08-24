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
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import UserCard from './components/user-card';
import UserForm from './components/user-form';
import { User, GlobalRole, CreateUserResponse } from '@/types/user-admin';
import { userAdminAPI } from '@/apis/user-admin';

export default function Users() {
    const { t } = useTranslation('user-admin');
    const { t: tGlobal } = useTranslation();
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    
    // 状态管理
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [showSkeleton, setShowSkeleton] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    
    // 分页状态
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(20);
    const [total, setTotal] = useState(0);
    
    // 表单状态
    const [formLoading, setFormLoading] = useState(false);
    const [createdUser, setCreatedUser] = useState<CreateUserResponse | null>(null);
    
    // 操作状态
    const [regeneratingTokenIds, setRegeneratingTokenIds] = useState<Set<string>>(new Set());
    const [deletingUserIds, setDeletingUserIds] = useState<Set<string>>(new Set());
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    
    // Debounce 搜索词
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        
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
        const loadUsers = async () => {
            const isSearching = !isInitialLoad && debouncedSearchTerm !== '';
            
            // 设置加载状态
            if (isInitialLoad) {
                setShowSkeleton(true);
            } else if (isSearching) {
                setShowSkeleton(true);
            } else {
                setLoading(true);
            }
            
            try {
                const params: any = {
                    page: currentPage,
                    pagesize: pageSize,
                };
                
                // 添加搜索条件
                if (debouncedSearchTerm) {
                    // 搜索用户名或邮箱
                    if (debouncedSearchTerm.includes('@')) {
                        params.email = debouncedSearchTerm;
                    } else {
                        params.name = debouncedSearchTerm;
                    }
                }
                
                // 添加角色过滤
                if (roleFilter !== 'all') {
                    params.global_role = roleFilter as GlobalRole;
                }
                
                const response = await userAdminAPI.getUserList(params);
                setUsers(response.list || []);
                setTotal(response.total || 0);
                
                if (isInitialLoad) {
                    setIsInitialLoad(false);
                }
            } catch (error) {
                console.error('Failed to load users:', error);
                toast.error(t('Failed to load users'));
            } finally {
                setShowSkeleton(false);
                setLoading(false);
            }
        };
        
        loadUsers();
    }, [currentPage, debouncedSearchTerm, roleFilter, refreshTrigger, isInitialLoad, pageSize, t]);
    
    // 处理创建用户
    const handleCreateUser = useCallback(async (data: { name: string; email: string }) => {
        setFormLoading(true);
        try {
            const response = await userAdminAPI.createUser(data);
            setCreatedUser(response);
            toast.success(t('User created successfully'));
            setRefreshTrigger(prev => prev + 1);
            return true;
        } catch (error) {
            console.error('Failed to create user:', error);
            toast.error(t('Failed to create user'));
            return false;
        } finally {
            setFormLoading(false);
        }
    }, [t]);
    
    // 处理删除用户
    const handleDeleteUser = useCallback(async (userId: string) => {
        setDeletingUserIds(prev => new Set(prev).add(userId));
        try {
            await userAdminAPI.deleteUser({ user_id: userId });
            toast.success(t('User deleted successfully'));
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error('Failed to delete user:', error);
            toast.error(t('Failed to delete user'));
        } finally {
            setDeletingUserIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(userId);
                return newSet;
            });
        }
    }, [t]);
    
    // 处理重新生成Token
    const handleRegenerateToken = useCallback(async (userId: string) => {
        setRegeneratingTokenIds(prev => new Set(prev).add(userId));
        try {
            const response = await userAdminAPI.regenerateToken({ user_id: userId });
            toast.success(t('Access token regenerated successfully'));
            
            // 显示新Token给用户
            navigator.clipboard.writeText(response.access_token);
            toast.success(t('New access token copied to clipboard'));
            
            return response.access_token;
        } catch (error) {
            console.error('Failed to regenerate token:', error);
            toast.error(t('Failed to regenerate access token'));
            return null;
        } finally {
            setRegeneratingTokenIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(userId);
                return newSet;
            });
        }
    }, [t]);
    
    // 处理模态框关闭
    const handleModalClose = useCallback(() => {
        setCreatedUser(null);
    }, []);
    
    // 计算总页数
    const totalPages = Math.ceil(total / pageSize);
    
    // 渲染用户列表或骨架屏
    const renderContent = () => {
        if (showSkeleton) {
            return (
                <Card>
                    <CardBody className="p-0">
                        {/* 表头 */}
                        <div className="flex items-center py-3 px-4 border-b border-default-200 bg-default-100">
                            <div className="flex-1 min-w-0 pr-4">
                                <span className="text-sm font-medium text-default-700">{t('Name / Email')}</span>
                            </div>
                            <div className="hidden md:flex items-center min-w-0 w-40 pr-4">
                                <span className="text-sm font-medium text-default-700">{t('User ID')}</span>
                            </div>
                            <div className="flex items-center min-w-0 w-32 pr-4">
                                <span className="text-sm font-medium text-default-700">{t('Role')}</span>
                            </div>
                            <div className="hidden lg:flex items-center min-w-0 w-28 pr-4">
                                <span className="text-sm font-medium text-default-700">{t('Created')}</span>
                            </div>
                            <div className="flex items-center w-10">
                                <span className="text-sm font-medium text-default-700">{t('Actions')}</span>
                            </div>
                        </div>
                        
                        {/* 骨架屏行 */}
                        {Array.from({ length: Math.min(pageSize, 10) }).map((_, i) => (
                            <div key={i} className="flex items-center py-3 px-4 border-b border-default-200">
                                <div className="flex-1 min-w-0 pr-4">
                                    <Skeleton className="h-4 w-32 mb-1" />
                                    <Skeleton className="h-3 w-48" />
                                </div>
                                <div className="hidden md:flex items-center min-w-0 w-40 pr-4">
                                    <Skeleton className="h-3 w-32" />
                                </div>
                                <div className="flex items-center min-w-0 w-32 pr-4">
                                    <Skeleton className="h-6 w-20" />
                                </div>
                                <div className="hidden lg:flex items-center min-w-0 w-28 pr-4">
                                    <Skeleton className="h-3 w-20" />
                                </div>
                                <div className="flex items-center">
                                    <Skeleton className="h-6 w-6 rounded" />
                                </div>
                            </div>
                        ))}
                    </CardBody>
                </Card>
            );
        }
        
        if (users.length === 0) {
            const isEmpty = total === 0 && !debouncedSearchTerm && roleFilter === 'all';
            
            return (
                <Card>
                    <CardBody className="flex flex-col items-center justify-center py-12">
                        <Icon 
                            icon={isEmpty ? "solar:user-linears" : "solar:magnifying-glass"} 
                            className="h-16 w-16 text-default-300 mb-4" 
                        />
                        <h3 className="text-lg font-semibold text-default-600 mb-2">
                            {isEmpty ? t('No users yet') : t('No matching users')}
                        </h3>
                        <p className="text-default-400 text-center mb-4">
                            {isEmpty 
                                ? t('Create your first user to get started')
                                : t('Try adjusting your search criteria')
                            }
                        </p>
                        {isEmpty && (
                            <Button color="primary" onPress={onOpen}>
                                <Icon icon="solar:plus" className="h-4 w-4" />
                                {t('Create First User')}
                            </Button>
                        )}
                    </CardBody>
                </Card>
            );
        }
        
        return (
            <Card>
                <CardBody className="p-0">
                    {/* 表头 */}
                    <div className="flex items-center py-3 px-4 border-b border-default-200 bg-default-100">
                        <div className="flex-1 min-w-0 pr-4">
                            <span className="text-sm font-medium text-default-700">{t('Name / Email')}</span>
                        </div>
                        <div className="hidden md:flex items-center min-w-0 w-40 pr-4">
                            <span className="text-sm font-medium text-default-700">{t('User ID')}</span>
                        </div>
                        <div className="flex items-center min-w-0 w-32 pr-4">
                            <span className="text-sm font-medium text-default-700">{t('Role')}</span>
                        </div>
                        <div className="hidden lg:flex items-center min-w-0 w-28 pr-4">
                            <span className="text-sm font-medium text-default-700">{t('Created')}</span>
                        </div>
                        <div className="flex items-center w-10">
                            <span className="text-sm font-medium text-default-700">{t('Actions')}</span>
                        </div>
                    </div>
                    
                    {/* 用户行 */}
                    {users.map((user) => (
                        <UserCard
                            key={user.id}
                            user={user}
                            onRegenerateToken={handleRegenerateToken}
                            onDeleteUser={handleDeleteUser}
                            isRegeneratingToken={regeneratingTokenIds.has(user.id)}
                            isDeletingUser={deletingUserIds.has(user.id)}
                        />
                    ))}
                </CardBody>
            </Card>
        );
    };
    
    return (
        <div className="space-y-6">
            {/* 头部操作区 */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="flex-1 w-full sm:max-w-md">
                    <Input
                        placeholder={t('Search by name or email')}
                        startContent={<Icon icon="solar:magnifying-glass" className="h-4 w-4 text-default-400" />}
                        value={searchTerm}
                        onValueChange={setSearchTerm}
                        isClearable
                        onClear={() => setSearchTerm('')}
                    />
                </div>
                
                <div className="flex gap-2 w-full sm:w-auto">
                    <Select
                        placeholder={t('Filter by role')}
                        selectedKeys={roleFilter === 'all' ? [] : [roleFilter]}
                        onSelectionChange={(keys) => {
                            const selected = Array.from(keys)[0] as string;
                            setRoleFilter(selected || 'all');
                        }}
                        className="min-w-44"
                        aria-label={t('Filter by role')}
                    >
                        <>
                            <SelectItem key="all">{t('All Roles')}</SelectItem>
                            <SelectItem key={GlobalRole.CHIEF}>{t('Super Admin')}</SelectItem>
                            <SelectItem key={GlobalRole.ADMIN}>{t('Admin')}</SelectItem>
                            <SelectItem key={GlobalRole.MEMBER}>{t('Member')}</SelectItem>
                        </>
                    </Select>
                </div>
                <Button color="primary" onPress={onOpen}>
                    <Icon icon="heroicons:plus" className="h-4 w-4" />
                    {t('Create User')}
                </Button>
            </div>
            
            {/* 用户列表 */}
            {renderContent()}
            
            {/* 分页 */}
            {totalPages > 1 && (
                <div className="flex justify-center">
                    <Pagination
                        total={totalPages}
                        page={currentPage}
                        onChange={setCurrentPage}
                        showControls
                        showShadow
                        isDisabled={loading}
                    />
                </div>
            )}
            
            {/* 创建用户模态框 */}
            <Modal 
                isOpen={isOpen} 
                onOpenChange={onOpenChange} 
                placement="top-center"
                size="md"
                onClose={handleModalClose}
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                {t('Create New User')}
                            </ModalHeader>
                            <UserForm
                                isLoading={formLoading}
                                createdUser={createdUser}
                                onSubmit={handleCreateUser}
                                onClose={onClose}
                            />
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}