import {
    Button,
    Card,
    CardBody,
    CardFooter,
    CardHeader,
    Chip,
    Divider,
    Input,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    Select,
    SelectItem,
    Spinner,
    Switch,
    useDisclosure
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSnapshot } from 'valtio';

import type { RSSSubscription } from '@/@types/rss';
import { UPDATE_FREQUENCY_OPTIONS } from '@/@types/rss';
import { deleteRSSSubscription, triggerRSSFetch, updateRSSSubscription } from '@/apis/rss';
import RSSSubscriptionDialog from '@/components/rss-subscription-dialog';
import { loadSubscriptions, removeSubscription, updateSubscriptionInStore } from '@/stores/rss';
import rssStore from '@/stores/rss';
import spaceStore from '@/stores/space';

export default memo(function RSSSubscriptionsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentSelectedSpace } = useSnapshot(spaceStore);
    const { subscriptions, loading } = useSnapshot(rssStore);

    const [searchKeyword, setSearchKeyword] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [editingSubscription, setEditingSubscription] = useState<RSSSubscription | null>(null);
    const { isOpen, onOpen, onClose } = useDisclosure();
    const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
    const [deleteTarget, setDeleteTarget] = useState<RSSSubscription | null>(null);

    // 返回上一页
    const handleBack = useCallback(() => {
        navigate('/dashboard');
    }, [navigate]);

    // 跳转到摘要列表
    const goToDigestList = useCallback(() => {
        navigate(`/dashboard/${currentSelectedSpace}/rss-digest`);
    }, [navigate, currentSelectedSpace]);

    // 加载订阅列表
    useEffect(() => {
        if (!currentSelectedSpace) return;

        loadSubscriptions(currentSelectedSpace);
    }, [currentSelectedSpace]);

    // 获取所有分类
    const categories = Array.from(new Set(subscriptions?.filter(sub => sub.category).map(sub => sub.category)));

    // 过滤订阅列表
    const filteredSubscriptions = subscriptions?.filter(sub => {
        const matchKeyword = !searchKeyword || sub.title.toLowerCase().includes(searchKeyword.toLowerCase()) || sub.url.toLowerCase().includes(searchKeyword.toLowerCase());

        const matchCategory = selectedCategory === 'all' || sub.category === selectedCategory;

        return matchKeyword && matchCategory;
    });

    // 打开编辑对话框
    const handleEdit = useCallback(
        (subscription: RSSSubscription) => {
            setEditingSubscription(subscription);
            onOpen();
        },
        [onOpen]
    );

    // 关闭编辑对话框
    const handleCloseEdit = useCallback(() => {
        setEditingSubscription(null);
        onClose();
    }, [onClose]);

    // 打开删除确认对话框
    const handleDeleteClick = useCallback(
        (subscription: RSSSubscription) => {
            setDeleteTarget(subscription);
            onDeleteOpen();
        },
        [onDeleteOpen]
    );

    // 确认删除
    const handleDeleteConfirm = useCallback(async () => {
        if (!currentSelectedSpace || !deleteTarget) return;

        try {
            await deleteRSSSubscription(currentSelectedSpace, deleteTarget.id);
            removeSubscription(deleteTarget.id);
            toast.success(t('rss:SubscriptionDeleted'));
        } catch (error: any) {
            console.error('Failed to delete subscription:', error);
            toast.error(error.message || t('rss:DeleteSubscriptionFailed'));
        } finally {
            setDeleteTarget(null);
            onDeleteClose();
        }
    }, [currentSelectedSpace, t, deleteTarget, onDeleteClose]);

    // 取消删除
    const handleDeleteCancel = useCallback(() => {
        setDeleteTarget(null);
        onDeleteClose();
    }, [onDeleteClose]);

    // 切换启用状态
    const handleToggleEnabled = useCallback(
        async (subscription: RSSSubscription) => {
            if (!currentSelectedSpace) return;

            try {
                const newEnabled = !subscription.enabled;
                await updateRSSSubscription(currentSelectedSpace, subscription.id, {
                    enabled: newEnabled
                });
                updateSubscriptionInStore(subscription.id, { enabled: newEnabled });
                toast.success(t(newEnabled ? 'rss:SubscriptionEnabled' : 'rss:SubscriptionDisabled'));
            } catch (error: any) {
                console.error('Failed to toggle subscription:', error);
                toast.error(error.message || t('rss:UpdateFailed'));
            }
        },
        [currentSelectedSpace, t]
    );

    // 手动抓取
    const handleFetch = useCallback(
        async (subscription: RSSSubscription) => {
            if (!currentSelectedSpace) return;

            try {
                await triggerRSSFetch(currentSelectedSpace, subscription.id);
                toast.success(t('rss:FetchTriggered'));
            } catch (error: any) {
                console.error('Failed to trigger fetch:', error);
                toast.error(error.message || t('rss:TriggerFetchFailed'));
            }
        },
        [currentSelectedSpace, t]
    );

    return (
        <div className="w-full flex flex-col items-center">
            {/* 返回按钮 */}
            <div className="w-full p-4 box-border">
                <div className="flex items-center gap-3">
                    <Button startContent={<Icon icon="material-symbols:arrow-back-ios-rounded" />} variant="bordered" onPress={handleBack}>
                        {t('rss:Back')}
                    </Button>
                    <Button startContent={<Icon icon="mdi:view-list" />} variant="bordered" onPress={goToDigestList}>
                        {t('digest:digestList')}
                    </Button>
                </div>
            </div>

            {/* 主内容区域 - 居中显示 */}
            <div className="w-full max-w-6xl flex-1 p-4">
                {/* 标题栏 */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Icon icon="mdi:rss" width={32} />
                        <div>
                            <h1 className="text-3xl font-bold leading-9 text-default-foreground">{t('rss:RSSSubscriptions')}</h1>
                            <p className="mt-1 text-sm text-default-500">{t('rss:ManageRSSSubscriptions')}</p>
                        </div>
                    </div>
                    {subscriptions && (
                        <Chip size="lg" variant="flat" color="primary">
                            {t('rss:SubscriptionsCount', { count: subscriptions.length })}
                        </Chip>
                    )}
                </div>

                {/* 筛选栏 */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <Input
                        isClearable
                        className="flex-1"
                        placeholder={t('rss:SearchSubscriptionsPlaceholder')}
                        value={searchKeyword}
                        startContent={<Icon icon="mdi:magnify" width={20} />}
                        onValueChange={setSearchKeyword}
                    />
                    <Select
                        className="md:w-48"
                        aria-label={t('rss:SelectCategory')}
                        placeholder={t('rss:AllCategories')}
                        selectedKeys={[selectedCategory]}
                        onChange={e => setSelectedCategory(e.target.value)}
                    >
                        {['all', ...categories].map(cat => (
                            <SelectItem key={cat}>{cat === 'all' ? t('rss:AllCategories') : cat}</SelectItem>
                        ))}
                    </Select>
                </div>

                {/* 订阅列表 */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Spinner size="lg" />
                    </div>
                ) : !filteredSubscriptions || filteredSubscriptions.length === 0 ? (
                    <Card className="border-dashed border-2">
                        <CardBody className="flex items-center justify-center py-20">
                            <Icon icon="mdi:rss-off" width={48} className="text-default-400 mb-4" />
                            <p className="text-default-500">{searchKeyword ? t('rss:NoMatchingSubscriptions') : t('rss:NoSubscriptions')}</p>
                        </CardBody>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredSubscriptions.map(subscription => (
                            <SubscriptionCard
                                key={subscription.id}
                                subscription={subscription}
                                onEdit={() => handleEdit(subscription)}
                                onDelete={() => handleDeleteClick(subscription)}
                                onToggleEnabled={() => handleToggleEnabled(subscription)}
                                onFetch={() => handleFetch(subscription)}
                            />
                        ))}
                    </div>
                )}

                {/* 编辑对话框 */}
                <RSSSubscriptionDialog mode="edit" subscription={editingSubscription ?? undefined} isOpen={isOpen} onClose={handleCloseEdit} />

                {/* 删除确认对话框 */}
                <Modal isOpen={isDeleteOpen} onClose={handleDeleteCancel}>
                    <ModalContent>
                        {() => (
                            <>
                                <ModalHeader>{t('rss:Delete')}</ModalHeader>
                                <ModalBody>
                                    <div className="flex flex-col gap-2">
                                        <p className="text-default-600">{t('rss:ConfirmDeleteSubscription')}</p>
                                        {deleteTarget && (
                                            <div className="mt-2 p-3 bg-default-100 rounded-lg">
                                                <p className="font-medium">{deleteTarget.title}</p>
                                                {deleteTarget.description && <p className="text-sm text-default-500 mt-1 line-clamp-2">{deleteTarget.description}</p>}
                                                <div className="flex items-center gap-2 text-xs text-default-500 mt-2">
                                                    <Icon icon="mdi:link" width={14} />
                                                    <span className="line-clamp-1">{deleteTarget.url}</span>
                                                </div>
                                            </div>
                                        )}
                                        <p className="text-danger text-sm">{t('rss:CannotUndo')}</p>
                                    </div>
                                </ModalBody>
                                <ModalFooter>
                                    <Button variant="flat" onPress={handleDeleteCancel}>
                                        {t('rss:Cancel')}
                                    </Button>
                                    <Button color="danger" onPress={handleDeleteConfirm}>
                                        {t('rss:Delete')}
                                    </Button>
                                </ModalFooter>
                            </>
                        )}
                    </ModalContent>
                </Modal>
            </div>
        </div>
    );
});

// 订阅卡片组件
interface SubscriptionCardProps {
    subscription: RSSSubscription;
    onEdit: () => void;
    onDelete: () => void;
    onToggleEnabled: () => void;
    onFetch: () => void;
}

const SubscriptionCard = memo(function SubscriptionCard({ subscription, onEdit, onDelete, onToggleEnabled, onFetch }: SubscriptionCardProps) {
    const { t } = useTranslation();

    const formatDate = (timestamp: number) => {
        if (!timestamp) return t('rss:Never');
        return new Date(timestamp * 1000).toLocaleString();
    };

    const getUpdateFrequencyLabel = (seconds: number) => {
        const option = UPDATE_FREQUENCY_OPTIONS.find(opt => opt.value === seconds);
        return option?.label || `${seconds}${t('rss:seconds', { count: seconds })}`;
    };

    return (
        <Card className={subscription.enabled ? '' : 'opacity-60'}>
            <CardHeader className="flex flex-col items-start gap-2">
                <div className="flex w-full items-start justify-between">
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold line-clamp-1">{subscription.title}</h3>
                        {subscription.category && (
                            <Chip size="sm" variant="flat" color="primary" className="mt-1">
                                {subscription.category}
                            </Chip>
                        )}
                    </div>
                    <Switch size="sm" isSelected={subscription.enabled} onValueChange={onToggleEnabled} />
                </div>
            </CardHeader>
            <Divider />
            <CardBody className="gap-2">
                {subscription.description && <p className="text-sm text-default-600 line-clamp-2">{subscription.description}</p>}
                <div className="flex items-center gap-2 text-xs text-default-500">
                    <Icon icon="mdi:link" width={14} />
                    <a href={subscription.url} target="_blank" rel="noopener noreferrer" className="hover:underline line-clamp-1">
                        {subscription.url}
                    </a>
                </div>
                <div className="flex items-center gap-2 text-xs text-default-500">
                    <Icon icon="mdi:clock-outline" width={14} />
                    <span>{getUpdateFrequencyLabel(subscription.update_frequency)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-default-500">
                    <Icon icon="mdi:update" width={14} />
                    <span>
                        {t('rss:LastFetch')}: {formatDate(subscription.last_fetched_at)}
                    </span>
                </div>
            </CardBody>
            <Divider />
            <CardFooter className="gap-2 flex-wrap">
                <Button size="sm" variant="flat" startContent={<Icon icon="mdi:refresh" />} className="flex-1 min-w-20" onPress={onFetch}>
                    {t('rss:Fetch')}
                </Button>
                <Button size="sm" variant="flat" startContent={<Icon icon="mdi:pencil" />} className="flex-1 min-w-20" onPress={onEdit}>
                    {t('rss:Edit')}
                </Button>
                <Button size="sm" variant="flat" color="danger" startContent={<Icon icon="mdi:delete" />} className="flex-1 min-w-20" onPress={onDelete}>
                    {t('rss:Delete')}
                </Button>
            </CardFooter>
        </Card>
    );
});
