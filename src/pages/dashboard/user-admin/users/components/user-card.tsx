import { 
    Chip, 
    Button,
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure,
    Spinner
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { User, GlobalRole } from '@/types/user-admin';

interface UserCardProps {
    user: User;
    onRegenerateToken: (userId: string) => Promise<string | null>;
    onDeleteUser: (userId: string) => Promise<void>;
    isRegeneratingToken: boolean;
    isDeletingUser: boolean;
}

export default function UserCard({ user, onRegenerateToken, onDeleteUser, isRegeneratingToken, isDeletingUser }: UserCardProps) {
    const { t } = useTranslation('user-admin');
    const { isOpen: isConfirmOpen, onOpen: onConfirmOpen, onOpenChange: onConfirmOpenChange } = useDisclosure();
    const { isOpen: isDeleteConfirmOpen, onOpen: onDeleteConfirmOpen, onOpenChange: onDeleteConfirmOpenChange } = useDisclosure();
    const [newToken, setNewToken] = useState<string>('');
    const [showToken, setShowToken] = useState(false);
    
    // 格式化时间戳
    const formatDate = (timestamp: number) => {
        if (!timestamp) return '-';
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString();
    };
    
    // 获取用户角色的标签和颜色
    const getRoleBadge = (role: GlobalRole) => {
        switch (role) {
            case GlobalRole.CHIEF:
                return { label: t('Super Admin'), color: 'danger' as const };
            case GlobalRole.ADMIN:
                return { label: t('Admin'), color: 'warning' as const };
            case GlobalRole.MEMBER:
                return { label: t('Member'), color: 'default' as const };
            default:
                return { label: t('Unknown'), color: 'default' as const };
        }
    };
    
    const roleBadge = getRoleBadge(user.global_role);
    
    // 处理重新生成Token
    const handleRegenerateToken = async () => {
        const token = await onRegenerateToken(user.id);
        if (token) {
            setNewToken(token);
            setShowToken(true);
        }
        onConfirmOpenChange();
    };
    
    // 处理删除用户
    const handleDeleteUser = async () => {
        await onDeleteUser(user.id);
        onDeleteConfirmOpenChange();
    };
    
    // 复制到剪贴板
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success(t('Copied to clipboard'));
    };
    
    // 关闭Token显示模态框
    const handleTokenModalClose = () => {
        setShowToken(false);
        setNewToken('');
    };
    
    return (
        <>
            <div className="flex items-center py-3 px-4 border-b border-default-200 hover:bg-default-50 transition-colors">
                {/* 用户名 */}
                <div className="flex-1 min-w-0 pr-4">
                    <div className="font-medium text-default-900 truncate">{user.name}</div>
                    <div className="text-sm text-default-600 truncate">{user.email}</div>
                </div>
                
                {/* 用户ID - 隐藏在小屏幕上 */}
                <div className="hidden md:flex items-center min-w-0 w-40 pr-4">
                    <div className="flex items-center gap-1 min-w-0">
                        <code className="text-xs font-mono text-default-500 truncate">{user.id}</code>
                        <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            className="h-5 w-5 min-w-5"
                            onPress={() => copyToClipboard(user.id)}
                        >
                            <Icon icon="material-symbols:content-copy" width={12} />
                        </Button>
                    </div>
                </div>
                
                {/* 角色标签 */}
                <div className="flex items-center min-w-0 w-32 pr-4">
                    <Chip size="sm" color={roleBadge.color} variant="flat">
                        {roleBadge.label}
                    </Chip>
                </div>
                
                {/* 创建时间 - 隐藏在小屏幕上 */}
                <div className="hidden lg:flex items-center min-w-0 w-28 pr-4">
                    <span className="text-sm text-default-500">{formatDate(user.created_at)}</span>
                </div>
                
                {/* 操作按钮 */}
                <div className="flex items-center">
                    <Dropdown>
                        <DropdownTrigger>
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                className="text-default-400"
                                isDisabled={isRegeneratingToken || isDeletingUser}
                                isLoading={isRegeneratingToken || isDeletingUser}
                            >
                                {!(isRegeneratingToken || isDeletingUser) && (
                                    <Icon icon="material-symbols:more-vert" width={16} />
                                )}
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu>
                            <DropdownItem 
                                key="copy-id" 
                                onPress={() => copyToClipboard(user.id)}
                                textValue={t('Copy User ID')}
                                className="md:hidden"
                            >
                                <div className="flex items-center gap-2">
                                    <Icon icon="material-symbols:content-copy" width={16} />
                                    {t('Copy User ID')}
                                </div>
                            </DropdownItem>
                            <DropdownItem 
                                key="regenerate-token" 
                                onPress={onConfirmOpen}
                                textValue={t('Regenerate Access Token')}
                                isDisabled={isRegeneratingToken || isDeletingUser}
                            >
                                <div className="flex items-center gap-2">
                                    {isRegeneratingToken ? (
                                        <Spinner size="sm" />
                                    ) : (
                                        <Icon icon="material-symbols:refresh" width={16} />
                                    )}
                                    {t('Regenerate Access Token')}
                                </div>
                            </DropdownItem>
                            <DropdownItem 
                                key="delete-user"
                                color="danger"
                                className="text-danger"
                                onPress={onDeleteConfirmOpen}
                                textValue={t('Delete User')}
                                isDisabled={isRegeneratingToken || isDeletingUser}
                            >
                                <div className="flex items-center gap-2">
                                    {isDeletingUser ? (
                                        <Spinner size="sm" />
                                    ) : (
                                        <Icon icon="material-symbols:delete" width={16} />
                                    )}
                                    {t('Delete User')}
                                </div>
                            </DropdownItem>
                        </DropdownMenu>
                    </Dropdown>
                </div>
            </div>
            
            {/* 确认重新生成Token模态框 */}
            <Modal isOpen={isConfirmOpen} onOpenChange={onConfirmOpenChange} size="md">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>
                                <div className="flex items-center gap-2">
                                    <Icon icon="solar:exclamation-triangle" className="h-5 w-5 text-warning" />
                                    {t('Confirm Token Regeneration')}
                                </div>
                            </ModalHeader>
                            <ModalBody>
                                <p className="text-default-600">
                                    {t('Are you sure you want to regenerate the access token for user')} <strong>{user.name}</strong>?
                                </p>
                                <p className="text-sm text-warning">
                                    {t('This will invalidate the current token and may cause service interruption for this user.')}
                                </p>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>
                                    {t('Cancel')}
                                </Button>
                                <Button 
                                    color="warning" 
                                    onPress={handleRegenerateToken}
                                    isLoading={isRegeneratingToken}
                                    startContent={!isRegeneratingToken && <Icon icon="solar:arrow-path" className="h-4 w-4" />}
                                >
                                    {t('Regenerate Token')}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
            
            {/* 显示新Token模态框 */}
            <Modal isOpen={showToken} onOpenChange={setShowToken} size="md" onClose={handleTokenModalClose}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>
                                {t('Access Token Created')}
                            </ModalHeader>
                            <ModalBody>
                                <div className="space-y-4">
                                    <div className="text-center">
                                        <p className="text-sm text-default-600">{t('Please save this token securely. It will not be shown again.')}</p>
                                    </div>
                                    
                                    <div className="bg-default-50 border border-default-200 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-default-700">{t('Access Token')}</span>
                                            <Button
                                                size="sm"
                                                variant="light"
                                                onPress={() => copyToClipboard(newToken)}
                                                startContent={<Icon icon="tabler:copy" className="h-4 w-4" />}
                                            >
                                                {t('Copy')}
                                            </Button>
                                        </div>
                                        <code className="text-xs font-mono text-default-700 break-all block bg-default-100 px-3 py-2 rounded">
                                            {newToken}
                                        </code>
                                    </div>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button color="primary" onPress={onClose} className="w-full">
                                    {t('Close')}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
            
            {/* 删除用户确认模态框 */}
            <Modal isOpen={isDeleteConfirmOpen} onOpenChange={onDeleteConfirmOpenChange} size="md">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>
                                <div className="flex items-center gap-2">
                                    <Icon icon="solar:exclamation-triangle" className="h-5 w-5 text-danger" />
                                    {t('Confirm User Deletion')}
                                </div>
                            </ModalHeader>
                            <ModalBody>
                                <p className="text-default-600">
                                    {t('Are you sure you want to delete user')} <strong>{user.name}</strong>?
                                </p>
                                <p className="text-sm text-danger">
                                    {t('This action cannot be undone. All user data, including their spaces, knowledge bases, chat sessions, and files will be permanently deleted.')}
                                </p>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>
                                    {t('Cancel')}
                                </Button>
                                <Button 
                                    color="danger" 
                                    onPress={handleDeleteUser}
                                    isLoading={isDeletingUser}
                                    startContent={!isDeletingUser && <Icon icon="solar:trash" className="h-4 w-4" />}
                                >
                                    {t('Delete User')}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </>
    );
}