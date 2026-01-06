import { BreadcrumbItem, Breadcrumbs, Button, ButtonGroup, Card, CardBody, Chip, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Skeleton, useDisclosure } from '@heroui/react';
import { Icon } from '@iconify/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useSnapshot } from 'valtio';

import { deletePodcast, getPodcast, regeneratePodcast } from '@/apis/podcast';
import { CreatePodcastShareURL } from '@/apis/share';
import ShareButton from '@/components/share-button';
import { usePlan } from '@/hooks/use-plan';
import type { Podcast } from '@/stores/podcast';
import spaceStore from '@/stores/space';

export default memo(function PodcastDetailPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { spaceID, id } = useParams();
    const { userIsPro } = usePlan();
    const { spaces } = useSnapshot(spaceStore);

    const [podcast, setPodcast] = useState<Podcast | null>(null);
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);
    const { isOpen: isDeleteModalOpen, onOpen: onDeleteModalOpen, onClose: onDeleteModalClose } = useDisclosure();
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // 获取当前空间名称
    const currentSpaceName = useMemo(() => {
        const space = spaces.find(s => s.space_id === spaceID);
        return space?.title || '';
    }, [spaces, spaceID]);

    // 加载播客详情
    useEffect(() => {
        if (!spaceID || !id) {
            navigate('/dashboard');
            return;
        }

        setLoading(true);
        loadPodcast().finally(() => setLoading(false));
    }, [spaceID, id]);

    // 轮询逻辑 - 当播客状态为 pending 或 processing 时持续轮询
    useEffect(() => {
        // 检查是否需要轮询
        const shouldPoll = podcast && podcast.status !== 'completed' && podcast.status !== 'failed';

        if (!shouldPoll) {
            // 如果不需要轮询，清理现有的轮询
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        // 启动轮询
        if (!intervalRef.current) {
            intervalRef.current = setInterval(async () => {
                try {
                    if (!spaceID || !id) return;
                    const result = await getPodcast(spaceID, id);
                    setPodcast(result);
                    // 如果播客已完成或失败，停止轮询
                    if (result.status === 'completed' || result.status === 'failed') {
                        if (intervalRef.current) {
                            clearInterval(intervalRef.current);
                            intervalRef.current = null;
                        }
                    }
                } catch (error) {
                    console.error('Polling error:', error);
                }
            }, 5000); // 每5秒轮询一次
        }

        // 清理函数
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [podcast?.status, spaceID, id]);

    // 组件卸载时清理轮询
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, []);

    const loadPodcast = useCallback(async () => {
        if (!spaceID || !id) return;

        try {
            const result = await getPodcast(spaceID, id);
            setPodcast(result);
            return result;
        } catch (error: any) {
            console.error('Failed to load podcast:', error);
            // API 不存在或返回错误时，显示友好提示
            navigate(`/dashboard/${spaceID}/podcasts`);
        }
    }, [spaceID, id, navigate, t]);

    // 重新生成播客
    const handleRegenerate = useCallback(async () => {
        if (!spaceID || !id || !podcast) return;

        setRegenerating(true);
        try {
            await regeneratePodcast(spaceID, id);
            toast.success(t('podcast:RegenerateTriggered'));
            // 重新加载播客，触发轮询
            const result = await loadPodcast();
            // 如果重新生成成功，轮询会自动开始
        } catch (error: any) {
            console.error('Failed to regenerate podcast:', error);
            toast.error(error.message || t('podcast:RegenerateFailed'));
        } finally {
            setRegenerating(false);
        }
    }, [spaceID, id, podcast, t, loadPodcast]);

    // 删除播客
    const handleDelete = useCallback(async () => {
        if (!spaceID || !id) return;

        try {
            await deletePodcast(spaceID, id);
            toast.success(t('podcast:Deleted'));
            handleBack();
        } catch (error: any) {
            console.error('Failed to delete podcast:', error);
            toast.error(error.message || t('podcast:DeleteFailed'));
        }
    }, [spaceID, id, navigate]);

    // 返回列表页
    const handleBack = useCallback(() => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate(`/dashboard/${spaceID}/podcasts`);
        }
    }, [navigate, spaceID]);

    // 状态颜色映射
    const getStatusColor = (status: Podcast['status']): 'default' | 'warning' | 'primary' | 'success' | 'danger' => {
        const colors: Record<Podcast['status'], 'default' | 'warning' | 'primary' | 'success' | 'danger'> = {
            pending: 'warning',
            processing: 'primary',
            completed: 'success',
            failed: 'danger'
        };
        return colors[status] || 'default';
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

    // 格式化时长
    const formatDuration = (seconds?: number) => {
        if (!seconds) return '--';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // 格式化文件大小
    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '--';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    // 获取分享 URL 生成函数
    const getShareUrlFunc = useCallback(async () => {
        if (!podcast) return '';
        try {
            const res = await CreatePodcastShareURL(podcast.space_id, window.location.origin + '/s/p/{token}', podcast.id);
            return res.url;
        } catch (e: any) {
            console.error(e);
            toast.error(t('ShareFailed'));
            return '';
        }
    }, [podcast, t]);

    return (
        <div className="w-full flex flex-col items-center">
            {/* 返回按钮 */}
            <div className="w-full p-4 box-border flex justify-between">
                <Button startContent={<Icon icon="material-symbols:arrow-back-ios-rounded" />} variant="bordered" onPress={handleBack}>
                    {t('Back')}
                </Button>

                <div className="flex items-center gap-2">{userIsPro && podcast && podcast.status === 'completed' && <ShareButton genUrlFunc={getShareUrlFunc} text={t('Share')} />}</div>
            </div>

            {/* 主内容区域 - 居中显示 */}
            <div className="w-full max-w-4xl flex-1 p-4">
                {/* 标题栏 */}
                {loading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-8 w-3/4 rounded-lg" />
                        <Skeleton className="h-6 w-1/2 rounded-lg" />
                        <Skeleton className="h-40 w-full rounded-lg" />
                    </div>
                ) : podcast ? (
                    <>
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex-1">
                                <Breadcrumbs className="mb-4">
                                    <BreadcrumbItem onClick={() => navigate('/dashboard')}>{t('Dashboard')}</BreadcrumbItem>
                                    {currentSpaceName && <BreadcrumbItem onClick={() => navigate(`/dashboard/${spaceID}/knowledge`)}>{currentSpaceName}</BreadcrumbItem>}
                                    <BreadcrumbItem onClick={() => navigate(`/dashboard/${spaceID}/podcasts`)}>{t('translation:PodcastList')}</BreadcrumbItem>
                                    <BreadcrumbItem>{podcast.title}</BreadcrumbItem>
                                </Breadcrumbs>
                                <h1 className="text-3xl font-bold leading-9 text-default-foreground mb-4">{podcast.title}</h1>
                                <div className="flex items-center gap-2 mb-4">
                                    <Chip size="sm" variant="flat" color={getStatusColor(podcast.status)}>
                                        {getStatusText(podcast.status)}
                                    </Chip>
                                    <Chip size="sm" variant="flat" color="default">
                                        {getSourceTypeText(podcast.source_type)}
                                    </Chip>
                                </div>
                            </div>
                        </div>

                        {/* 播客内容 */}
                        <div className="space-y-6">
                            {/* 音频播放器 */}
                            {podcast.status === 'completed' && podcast.audio_url ? (
                                <Card>
                                    <CardBody className="p-6">
                                        <audio controls className="w-full" src={podcast.audio_url}>
                                            {t('podcast:AudioNotSupported')}
                                        </audio>
                                        <div className="flex items-center justify-between mt-4 text-sm text-default-500">
                                            <span>
                                                {t('podcast:Duration')}: {formatDuration(podcast.audio_duration)}
                                            </span>
                                            <span>
                                                {t('podcast:FileSize')}: {formatFileSize(podcast.audio_size)}
                                            </span>
                                            <span>
                                                {t('podcast:Format')}: {podcast.audio_format?.toUpperCase()}
                                            </span>
                                        </div>
                                    </CardBody>
                                </Card>
                            ) : podcast.status === 'processing' ? (
                                <Card className="border-2 border-primary">
                                    <CardBody className="flex items-center justify-center py-12">
                                        <div className="text-center">
                                            <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                                            <p className="text-lg font-medium">{t('podcast:Generating')}</p>
                                            <p className="text-sm text-default-500 mt-2">{t('podcast:GenerateTimeTip')}</p>
                                            {podcast.generation_last_updated && (
                                                <p className="text-xs text-default-400 mt-3">
                                                    {t('podcast:LastUpdated')}: {new Date(podcast.generation_last_updated * 1000).toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                    </CardBody>
                                </Card>
                            ) : podcast.status === 'failed' ? (
                                <Card className="border-2 border-danger">
                                    <CardBody className="flex items-center justify-center py-12">
                                        <div className="text-center">
                                            <Icon icon="mdi:alert-circle" width={64} className="text-danger mx-auto mb-4" />
                                            <p className="text-lg font-medium text-danger">{t('podcast:GenerationFailed')}</p>
                                            {podcast.error_message && <p className="text-sm text-default-500 mt-2">{podcast.error_message}</p>}
                                        </div>
                                    </CardBody>
                                </Card>
                            ) : (
                                <Card>
                                    <CardBody className="flex items-center justify-center py-12">
                                        <div className="text-center">
                                            <Icon icon="mdi:clock-outline" width={64} className="text-default-400 mx-auto mb-4" />
                                            <p className="text-lg font-medium">{t('podcast:Waiting')}</p>
                                        </div>
                                    </CardBody>
                                </Card>
                            )}

                            {/* 描述 */}
                            {podcast.description && (
                                <Card>
                                    <CardBody className="p-6">
                                        <h3 className="text-lg font-semibold mb-3">{t('podcast:Description')}</h3>
                                        <p className="text-default-600 whitespace-pre-wrap">{podcast.description}</p>
                                    </CardBody>
                                </Card>
                            )}

                            {/* 标签 */}
                            {podcast.tags && podcast.tags.length > 0 && (
                                <Card>
                                    <CardBody className="p-6">
                                        <h3 className="text-lg font-semibold mb-3">{t('podcast:Tags')}</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {podcast.tags.map((tag, index) => (
                                                <Chip key={index} variant="flat">
                                                    {tag}
                                                </Chip>
                                            ))}
                                        </div>
                                    </CardBody>
                                </Card>
                            )}

                            {/* 详细信息 */}
                            <Card>
                                <CardBody className="p-6">
                                    <h3 className="text-lg font-semibold mb-3">{t('podcast:Details')}</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-default-500">{t('podcast:SourceTypeLabel')}:</span>
                                            <span className="ml-2">{getSourceTypeText(podcast.source_type)}</span>
                                        </div>
                                        <div>
                                            <span className="text-default-500">{t('podcast:SourceId')}:</span>
                                            <span className="ml-2 font-mono text-xs">{podcast.source_id}</span>
                                        </div>
                                        <div>
                                            <span className="text-default-500">{t('podcast:CreatedAt')}:</span>
                                            <span className="ml-2">{new Date(podcast.created_at * 1000).toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="text-default-500">{t('podcast:UpdatedAt')}:</span>
                                            <span className="ml-2">{new Date(podcast.updated_at * 1000).toLocaleString()}</span>
                                        </div>

                                        <div>
                                            <span className="text-default-500">{t('podcast:GeneratedAt')}:</span>
                                            <span className="ml-2">{podcast.generated_at ? new Date(podcast.generated_at * 1000).toLocaleString() : '-'}</span>
                                        </div>

                                        <div>
                                            <span className="text-default-500">{t('podcast:RetryTimes')}:</span>
                                            <span className="ml-2">{podcast.retry_times}</span>
                                        </div>

                                        {podcast.generation_last_updated && (
                                            <div>
                                                <span className="text-default-500">{t('podcast:GenerationLastUpdated')}:</span>
                                                <span className="ml-2">{new Date(podcast.generation_last_updated * 1000).toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>
                                </CardBody>
                            </Card>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex justify-center mt-8">
                            <ButtonGroup variant="flat" size="md">
                                <Button onPress={handleBack}>{t('Back')}</Button>
                                {podcast.status === 'completed' && (
                                    <Button color="primary" isLoading={regenerating} onPress={handleRegenerate}>
                                        <Icon icon="mdi:refresh" className="mr-2" width={20} />
                                        {t('podcast:Regenerate')}
                                    </Button>
                                )}
                                <Button color="danger" onPress={onDeleteModalOpen}>
                                    <Icon icon="mdi:delete" className="mr-2" width={20} />
                                    {t('podcast:DeletePodcast')}
                                </Button>
                            </ButtonGroup>
                        </div>
                    </>
                ) : (
                    <Card>
                        <CardBody className="flex items-center justify-center py-20">
                            <p className="text-default-500">{t('podcast:NotFound')}</p>
                        </CardBody>
                    </Card>
                )}
            </div>

            {/* 删除确认对话框 */}
            <Modal isOpen={isDeleteModalOpen} backdrop="blur" onClose={onDeleteModalClose}>
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1">{t('podcast:DeletePodcast')}</ModalHeader>
                    <ModalBody>
                        <p>{t('podcast:ConfirmDelete')}</p>
                        <p className="text-small text-danger">{t('podcast:CannotUndo')}</p>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onDeleteModalClose}>
                            {t('Cancel')}
                        </Button>
                        <Button
                            color="danger"
                            onPress={() => {
                                onDeleteModalClose();
                                handleDelete();
                            }}
                        >
                            {t('Delete')}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
});
