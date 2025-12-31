import { Button, Card, CardBody, CardHeader, Chip, Divider, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useSnapshot } from 'valtio';

import Markdown from '@/components/markdown';
import { loadDigestDetail, removeDigest } from '@/stores/rss';
import rssStore from '@/stores/rss';
import spaceStore from '@/stores/space';

export default memo(function RSSDigestDetailPage() {
    const { t } = useTranslation('digest');
    const navigate = useNavigate();
    const { id } = useParams<{ spaceid: string; id: string }>();
    const { currentSelectedSpace } = useSnapshot(spaceStore);
    const { currentDigest, loadingDigest } = useSnapshot(rssStore);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // 加载摘要详情
    useEffect(() => {
        if (!currentSelectedSpace || !id) return;

        loadDigestDetail(currentSelectedSpace, id);
    }, [currentSelectedSpace, id]);

    // 返回上一页
    const handleBack = useCallback(() => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate(`/dashboard/${currentSelectedSpace}/rss-digest`);
        }
    }, [navigate, currentSelectedSpace]);

    // 跳转到摘要列表页
    const goToList = useCallback(() => {
        navigate(`/dashboard/${currentSelectedSpace}/rss-digest`);
    }, [navigate, currentSelectedSpace]);

    // 打开删除确认对话框
    const openDeleteModal = useCallback(() => {
        setIsDeleteModalOpen(true);
    }, []);

    // 关闭删除确认对话框
    const closeDeleteModal = useCallback(() => {
        setIsDeleteModalOpen(false);
    }, []);

    // 删除摘要
    const handleDelete = useCallback(async () => {
        if (!currentSelectedSpace || !currentDigest) return;

        setIsDeleting(true);
        try {
            await removeDigest(currentSelectedSpace, currentDigest.id);
            toast.success(t('digestDeleted'));
            goToList();
        } catch (error: any) {
            console.error('Failed to delete digest:', error);
            toast.error(error.message || t('deleteDigestFailed'));
        } finally {
            setIsDeleting(false);
        }
    }, [currentSelectedSpace, currentDigest, goToList, t]);

    // 格式化日期
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString();
    };

    // 格式化时间
    const formatTime = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleString();
    };

    // 加载中
    if (loadingDigest) {
        return (
            <div className="w-full flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <Spinner size="lg" />
                    <p className="text-default-500">{t('loadingDigest')}</p>
                </div>
            </div>
        );
    }

    // 摘要不存在
    if (!currentDigest) {
        return (
            <div className="w-full flex flex-col items-center p-8">
                <Icon icon="mdi:alert-circle-outline" width={64} className="text-default-400 mb-4" />
                <h2 className="text-xl font-semibold mb-2">{t('digestNotFound')}</h2>
                <p className="text-default-500 mb-4">{t('digestNotFoundHint')}</p>
                <Button color="primary" onPress={goToList}>
                    {t('returnToList')}
                </Button>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col items-center">
            {/* 顶部操作栏 */}
            <div className="w-full p-4 box-border">
                <div className="flex items-center gap-3">
                    <Button startContent={<Icon icon="material-symbols:arrow-back-ios-rounded" />} variant="bordered" onPress={handleBack}>
                        {t('back')}
                    </Button>
                    <Button startContent={<Icon icon="mdi:view-list" />} variant="bordered" onPress={goToList}>
                        {t('digestList')}
                    </Button>
                </div>
            </div>

            {/* 主内容区域 */}
            <div className="w-full max-w-4xl flex-1 p-4">
                {/* 摘要信息头部 */}
                <Card className="mb-6 p-4">
                    <CardHeader className="flex flex-col items-start gap-3">
                        <div className="flex w-full flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <Icon icon="mdi:calendar" width={20} />
                                    <h1 className="text-2xl font-bold">{formatDate(currentDigest.date)}</h1>
                                    <Chip size="sm" variant="flat" color="primary">
                                        {t('articles', { count: currentDigest.article_count })}
                                    </Chip>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-sm text-default-500">
                                    <div className="flex items-center gap-1">
                                        <Icon icon="mdi:robot" width={16} />
                                        <span>{currentDigest.model}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Icon icon="mdi:clock-outline" width={16} />
                                        <span>
                                            {t('generatedAt')}: {formatTime(currentDigest.generated_at)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <Button color="danger" variant="flat" startContent={<Icon icon="mdi:delete" />} className="md:shrink-0" onPress={openDeleteModal}>
                                {t('delete')}
                            </Button>
                        </div>
                    </CardHeader>
                </Card>

                {/* 摘要内容 */}
                <Card className="p-4">
                    <CardBody>
                        <Markdown>{currentDigest.content}</Markdown>
                    </CardBody>
                </Card>
            </div>

            {/* 删除确认对话框 */}
            <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal}>
                <ModalContent>
                    <ModalHeader>{t('confirmDeleteDigest')}</ModalHeader>
                    <ModalBody>
                        <p className="text-default-600">{t('confirmDeleteDigestMessage', { date: formatDate(currentDigest.date) })}</p>
                        <p className="text-sm text-default-500 mt-2">{t('deleteHint')}</p>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" isDisabled={isDeleting} onPress={closeDeleteModal}>
                            {t('cancel')}
                        </Button>
                        <Button color="danger" isLoading={isDeleting} startContent={<Icon icon="mdi:delete" />} onPress={handleDelete}>
                            {t('delete')}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
});
