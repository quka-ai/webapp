import { Breadcrumbs, BreadcrumbItem, Button, Card, CardBody, CardHeader, Chip, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Skeleton, useDisclosure } from '@heroui/react';
import { Icon } from '@iconify/react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSnapshot } from 'valtio';

import { deletePodcast, getPodcasts, regeneratePodcast } from '@/apis/podcast';
import type { Podcast } from '@/stores/podcast';
import { removePodcastFromStore, setLoading, setPodcasts } from '@/stores/podcast';
import podcastStore from '@/stores/podcast';
import spaceStore from '@/stores/space';

export default memo(function PodcastListPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentSelectedSpace, spaces } = useSnapshot(spaceStore);
    const { podcasts, loading } = useSnapshot(podcastStore);

    const [searchKeyword, setSearchKeyword] = useState('');
    const [selectedSourceType, setSelectedSourceType] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [deleteTarget, setDeleteTarget] = useState<Podcast | null>(null);

    // 获取当前空间名称
    const currentSpaceName = useMemo(() => {
        const space = spaces.find(s => s.space_id === currentSelectedSpace);
        return space?.title || '';
    }, [spaces, currentSelectedSpace]);

    // 返回上一页
    const handleBack = useCallback(() => {
        navigate('/dashboard');
    }, [navigate]);

    // 加载播客列表
    useEffect(() => {
        if (!currentSelectedSpace) return;

        loadPodcastsData();
    }, [currentSelectedSpace, selectedSourceType, selectedStatus]);

    const loadPodcastsData = useCallback(async () => {
        if (!currentSelectedSpace) return;

        setLoading(true);
        try {
            const params: any = {
                page: 1,
                pagesize: 20
            };
            if (selectedSourceType !== 'all') params.source_type = selectedSourceType;
            if (selectedStatus !== 'all') params.status = selectedStatus;

            const result = await getPodcasts(currentSelectedSpace, params);
            setPodcasts(result.podcasts);
        } catch (error: any) {
            console.error('Failed to load podcasts:', error);
            // API 不存在或返回错误时，显示友好提示
            toast.error(error.message || t('podcast:LoadFailed'));
        } finally {
            setLoading(false);
        }
    }, [currentSelectedSpace, selectedSourceType, selectedStatus, t]);

    // 过滤播客列表
    const filteredPodcasts = podcasts?.filter(podcast => {
        const matchKeyword = !searchKeyword || podcast.title.toLowerCase().includes(searchKeyword.toLowerCase()) || podcast.description.toLowerCase().includes(searchKeyword.toLowerCase());

        return matchKeyword;
    });

    // 重新生成播客
    const handleRegenerate = useCallback(
        async (podcast: Podcast) => {
            if (!currentSelectedSpace) return;

            try {
                await regeneratePodcast(currentSelectedSpace, podcast.id);
                toast.success(t('podcast:RegenerateTriggered'));
                // 刷新列表
                loadPodcastsData();
            } catch (error: any) {
                console.error('Failed to regenerate podcast:', error);
                toast.error(error.message || t('podcast:RegenerateFailed'));
            }
        },
        [currentSelectedSpace, t, loadPodcastsData]
    );

    // 打开删除确认对话框
    const handleDeleteClick = useCallback(
        (podcast: Podcast) => {
            setDeleteTarget(podcast);
            onOpen();
        },
        [onOpen]
    );

    // 确认删除
    const handleDeleteConfirm = useCallback(async () => {
        if (!currentSelectedSpace || !deleteTarget) return;

        try {
            await deletePodcast(currentSelectedSpace, deleteTarget.id);
            removePodcastFromStore(deleteTarget.id);
            toast.success(t('podcast:Deleted'));
        } catch (error: any) {
            console.error('Failed to delete podcast:', error);
            toast.error(error.message || t('podcast:DeleteFailed'));
        } finally {
            setDeleteTarget(null);
            onClose();
        }
    }, [currentSelectedSpace, t, deleteTarget, onClose]);

    // 取消删除
    const handleDeleteCancel = useCallback(() => {
        setDeleteTarget(null);
        onClose();
    }, [onClose]);

    // 状态颜色映射
    const getStatusColor = (status: Podcast['status']): 'default' | 'warning' | 'primary' | 'success' | 'danger' | 'secondary' | undefined => {
        const colors: Record<Podcast['status'], 'default' | 'warning' | 'primary' | 'success' | 'danger'> = {
            pending: 'warning',
            processing: 'primary',
            completed: 'success',
            failed: 'danger'
        };
        return colors[status];
    };

    // 状态文本映射
    const getStatusText = (status: Podcast['status']) => {
        const texts = {
            pending: t('podcast:Pending'),
            processing: t('podcast:Processing'),
            completed: t('podcast:Completed'),
            failed: t('podcast:Failed')
        };
        return texts[status] || status;
    };

    // 源类型文本映射
    const getSourceTypeText = (sourceType: Podcast['source_type']) => {
        const texts = {
            knowledge: t('podcast:Knowledge'),
            journal: t('podcast:Journal'),
            rss_digest: 'RSS摘要'
        };
        return texts[sourceType] || sourceType;
    };

    return (
        <div className="w-full flex flex-col items-center">
            {/* 返回按钮和面包屑导航 */}
            <div className="w-full p-4 box-border flex items-center gap-4">
                <Button startContent={<Icon icon="material-symbols:arrow-back-ios-rounded" />} variant="bordered" onPress={handleBack}>
                    {t('Back')}
                </Button>
                <Breadcrumbs>
                    <BreadcrumbItem onPress={() => navigate('/dashboard')}>{t('Dashboard')}</BreadcrumbItem>
                    {currentSpaceName && <BreadcrumbItem onPress={() => navigate(`/dashboard/${currentSelectedSpace}/knowledge`)}>{currentSpaceName}</BreadcrumbItem>}
                    <BreadcrumbItem>{t('translation:PodcastList')}</BreadcrumbItem>
                </Breadcrumbs>
            </div>

            {/* 主内容区域 - 居中显示 */}
            <div className="w-full max-w-6xl flex-1 p-4">
                {/* 标题栏 */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Icon icon="mdi:podcast" width={32} />
                        <div>
                            <h1 className="text-3xl font-bold leading-9 text-default-foreground">{t('translation:PodcastList')}</h1>
                            <p className="mt-1 text-sm text-default-500">{t('translation:ManageYourPodcasts')}</p>
                        </div>
                    </div>
                    {podcasts && (
                        <Chip size="lg" variant="flat" color="primary">
                            {t('translation:PodcastCount', { count: podcasts.length })}
                        </Chip>
                    )}
                </div>

                {/* 筛选栏 */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <Input
                        isClearable
                        className="flex-1"
                        placeholder={t('podcast:SearchPlaceholder')}
                        value={searchKeyword}
                        startContent={<Icon icon="mdi:magnify" width={20} />}
                        onValueChange={setSearchKeyword}
                    />
                    <Select
                        className="md:w-48"
                        aria-label={t('podcast:SourceType')}
                        placeholder={t('podcast:AllSources')}
                        selectedKeys={[selectedSourceType]}
                        onChange={e => setSelectedSourceType(e.target.value)}
                    >
                        <SelectItem key="all">{t('podcast:AllSources')}</SelectItem>
                        <SelectItem key="knowledge">{t('podcast:Knowledge')}</SelectItem>
                        <SelectItem key="journal">{t('podcast:Journal')}</SelectItem>
                        <SelectItem key="rss_digest">RSS摘要</SelectItem>
                    </Select>
                    <Select className="md:w-48" aria-label={t('podcast:Status')} placeholder={t('podcast:AllStatus')} selectedKeys={[selectedStatus]} onChange={e => setSelectedStatus(e.target.value)}>
                        <SelectItem key="all">{t('podcast:AllStatus')}</SelectItem>
                        <SelectItem key="pending">{t('podcast:Pending')}</SelectItem>
                        <SelectItem key="processing">{t('podcast:Processing')}</SelectItem>
                        <SelectItem key="completed">{t('podcast:Completed')}</SelectItem>
                        <SelectItem key="failed">{t('podcast:Failed')}</SelectItem>
                    </Select>
                </div>

                {/* 播客列表 */}
                {loading ? (
                    <div className="w-full">
                        <div className="space-y-4">
                            <Skeleton className="h-32 w-full rounded-lg" />
                            <Skeleton className="h-32 w-full rounded-lg" />
                            <Skeleton className="h-32 w-full rounded-lg" />
                        </div>
                    </div>
                ) : !filteredPodcasts || filteredPodcasts.length === 0 ? (
                    <Card className="border-dashed border-2">
                        <CardBody className="flex items-center justify-center py-20">
                            <Icon icon="mdi:podcast-outline" width={48} className="text-default-400 mb-4" />
                            <p className="text-default-500">{searchKeyword ? t('podcast:NoMatchingPodcasts') : t('podcast:NoPodcasts')}</p>
                        </CardBody>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {filteredPodcasts.map(podcast => (
                            <PodcastCard
                                key={podcast.id}
                                podcast={podcast}
                                getStatusColor={getStatusColor}
                                getStatusText={getStatusText}
                                getSourceTypeText={getSourceTypeText}
                                onRegenerate={() => handleRegenerate(podcast)}
                                onDelete={() => handleDeleteClick(podcast)}
                                onClick={() => {
                                    console.log('PodcastCard clicked:', `/dashboard/${podcast.space_id}/podcasts/${podcast.id}`);
                                    navigate(`/dashboard/${podcast.space_id}/podcasts/${podcast.id}`);
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* 删除确认对话框 */}
            <Modal isOpen={isOpen} onClose={handleDeleteCancel}>
                <ModalContent>
                    {() => (
                        <>
                            <ModalHeader>{t('podcast:DeletePodcast')}</ModalHeader>
                            <ModalBody>
                                <div className="flex flex-col gap-2">
                                    <p className="text-default-600">{t('podcast:ConfirmDelete')}</p>
                                    {deleteTarget && (
                                        <div className="mt-2 p-3 bg-default-100 rounded-lg">
                                            <p className="font-medium">{deleteTarget.title}</p>
                                            {deleteTarget.description && <p className="text-sm text-default-500 mt-1 line-clamp-2">{deleteTarget.description}</p>}
                                        </div>
                                    )}
                                    <p className="text-danger text-sm">{t('podcast:CannotUndo')}</p>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="flat" onPress={handleDeleteCancel}>
                                    {t('Cancel')}
                                </Button>
                                <Button color="danger" onPress={handleDeleteConfirm}>
                                    {t('Delete')}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
});

// 播客卡片组件
interface PodcastCardProps {
    podcast: Podcast;
    onRegenerate: () => void;
    onDelete: () => void;
    onClick: () => void;
    getStatusColor: (status: Podcast['status']) => 'default' | 'warning' | 'primary' | 'success' | 'danger' | 'secondary' | undefined;
    getStatusText: (status: Podcast['status']) => string;
    getSourceTypeText: (sourceType: Podcast['source_type']) => string;
}

const PodcastCard = memo(function PodcastCard({ podcast, onRegenerate, onDelete, onClick, getStatusColor, getStatusText, getSourceTypeText }: PodcastCardProps) {
    const { t } = useTranslation();

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '--';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div
            tabIndex={0}
            role="button"
            aria-label={`View podcast details: ${podcast.title}`}
            className="cursor-pointer"
            onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            }}
            onClick={onClick}
        >
            <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-col items-start gap-2">
                    <div className="flex w-full items-start justify-between">
                        <div className="flex-1">
                            <h3 className="text-xl font-semibold line-clamp-1">{podcast.title}</h3>
                            <div className="flex items-center gap-2 mt-2">
                                <Chip size="sm" variant="flat" color={getStatusColor(podcast.status)}>
                                    {getStatusText(podcast.status)}
                                </Chip>
                                <Chip size="sm" variant="flat" color="default">
                                    {getSourceTypeText(podcast.source_type)}
                                </Chip>
                                {podcast.audio_duration && (
                                    <Chip size="sm" variant="flat" color="default">
                                        {formatDuration(podcast.audio_duration)}
                                    </Chip>
                                )}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <Divider />
                <CardBody className="gap-3">
                    {podcast.description && <p className="text-sm text-default-600 line-clamp-2">{podcast.description}</p>}

                    {podcast.tags && podcast.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {podcast.tags.slice(0, 5).map((tag, index) => (
                                <Chip key={index} size="sm" variant="flat" className="text-xs">
                                    {tag}
                                </Chip>
                            ))}
                            {podcast.tags.length > 5 && (
                                <Chip size="sm" variant="flat" className="text-xs">
                                    +{podcast.tags.length - 5}
                                </Chip>
                            )}
                        </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-default-500">
                        <span>
                            {t('podcast:CreatedAt')}: {new Date(podcast.created_at * 1000).toLocaleString()}
                        </span>
                        {podcast.generated_at && (
                            <span>
                                {t('podcast:GeneratedAt')}: {new Date(podcast.generated_at * 1000).toLocaleString()}
                            </span>
                        )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                        {podcast.status === 'completed' && (
                            <Button size="sm" variant="flat" startContent={<Icon icon="mdi:refresh" />} onPress={onRegenerate}>
                                {t('podcast:Regenerate')}
                            </Button>
                        )}
                        <Button size="sm" variant="flat" color="danger" startContent={<Icon icon="mdi:delete" />} onPress={onDelete}>
                            {t('Delete')}
                        </Button>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
});
