import { Button, Card, CardBody, Input, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSnapshot } from 'valtio';

import RSSSubscriptionDialog from './rss-subscription-dialog';

import { loadTodayDigest } from '@/stores/rss';
import rssStore from '@/stores/rss';
import spaceStore from '@/stores/space';

const RSSSubscriptionBox = memo(function RSSSubscriptionBox() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentSelectedSpace } = useSnapshot(spaceStore);
    const { todayDigest } = useSnapshot(rssStore);

    const [rssUrl, setRssUrl] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [verifiedUrl, setVerifiedUrl] = useState('');
    const [feedTitle, setFeedTitle] = useState('');
    const [feedDescription, setFeedDescription] = useState('');
    const [digestLoading, setDigestLoading] = useState(false);

    // 加载今日摘要
    useEffect(() => {
        if (!currentSelectedSpace) return;

        const loadDigest = async () => {
            setDigestLoading(true);
            try {
                await loadTodayDigest(currentSelectedSpace);
            } catch (error) {
                console.error('Failed to load today digest:', error);
            } finally {
                setDigestLoading(false);
            }
        };

        loadDigest();
    }, [currentSelectedSpace]);

    // 验证 RSS URL
    const verifyRssUrl = useCallback(async () => {
        const trimmedUrl = rssUrl.trim();
        if (!trimmedUrl) {
            toast.error(t('rss:InputRSSUrl'));
            return;
        }

        // 简单的 URL 格式验证
        try {
            new URL(trimmedUrl);
        } catch {
            toast.error(t('rss:PleaseInputValidUrl'));
            return;
        }

        setIsVerifying(true);

        try {
            // TODO: 调用后端 API 验证 RSS URL 并获取 Feed 信息
            // 这里需要一个验证接口，暂时模拟验证成功
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 模拟从 RSS Feed 获取的信息
            // 实际应该从后端返回
            setVerifiedUrl(trimmedUrl);
            setFeedTitle(''); // 从 Feed 获取
            setFeedDescription(''); // 从 Feed 获取
            setIsDialogOpen(true);
        } catch (error: any) {
            console.error('Failed to verify RSS URL:', error);
            toast.error(error.message || t('rss:InvalidRSSUrlOrUnreachable'));
        } finally {
            setIsVerifying(false);
        }
    }, [rssUrl, t]);

    // 订阅成功回调
    const handleSubscriptionSuccess = useCallback(() => {
        setRssUrl('');
        toast.success(t('rss:SubscriptionCreatedSuccess'));
    }, [t]);

    // 打开订阅管理页面
    const openManagePage = useCallback(() => {
        if (currentSelectedSpace) {
            navigate(`/dashboard/${currentSelectedSpace}/rss-subscriptions`);
        }
    }, [currentSelectedSpace, navigate]);

    // 跳转到摘要详情页
    const openDigestDetail = useCallback(() => {
        if (currentSelectedSpace && todayDigest) {
            navigate(`/dashboard/${currentSelectedSpace}/rss-digest/${todayDigest.id}`);
        }
    }, [currentSelectedSpace, todayDigest, navigate]);

    return (
        <>
            {/* RSS 订阅盒子 - 整合输入框和摘要 */}
            <Card className="border-small rounded-xl border-default-200 bg-linear-to-br from-default-400/30 to-default-400 dark:from-default-100/50 dark:to-default-50/50 relative min-h-[200px]">
                <CardBody className="relative">
                    {/* 顶部输入区域 - 仅无摘要时显示 */}
                    <form
                        className="absolute bottom-2 left-2 flex gap-2 w-[calc(100%-16px)] z-10"
                        onSubmit={e => {
                            e.preventDefault();
                            verifyRssUrl();
                        }}
                    >
                        <Input
                            placeholder={t('rss:InputRSSUrl')}
                            value={rssUrl}
                            variant="faded"
                            size="sm"
                            className="flex-1"
                            startContent={<Icon icon="mdi:rss" width={16} />}
                            onValueChange={setRssUrl}
                            onBlur={e => setRssUrl(e.target.value.trim())}
                        />
                        <Button type="submit" variant="faded" size="sm" isLoading={isVerifying} isDisabled={!rssUrl.trim()}>
                            {t('rss:Subscribe')}
                        </Button>
                    </form>

                    {/* 右上角管理按钮 */}
                    <div className="absolute top-2 right-2 z-10">
                        <Button size="sm" variant="faded" startContent={<Icon icon="mdi:cog" width={16} />} onPress={openManagePage}>
                            {t('rss:Manage')}
                        </Button>
                    </div>

                    {/* 内容区域 */}
                    {digestLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <Spinner size="sm" />
                            <p className="text-sm text-default-500 ml-2">{t('rss:LoadingSummary')}</p>
                        </div>
                    ) : todayDigest ? (
                        <>
                            {/* 有摘要时显示摘要内容 - 可点击 */}
                            <div
                                aria-label={t('rss:ViewTodayRSSSummary')}
                                className="flex flex-col h-full cursor-pointer hover:bg-default-100/50 dark:hover:bg-default-800/50 transition-colors p-2 rounded-lg -m-2"
                                role="button"
                                tabIndex={0}
                                onClick={openDigestDetail}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        openDigestDetail();
                                    }
                                }}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon icon="mdi:newspaper-variant-outline" width={18} />
                                    <span className="text-sm font-semibold">{t('rss:TodayRSSSummary')}</span>
                                    <span className="text-xs text-default-500">{todayDigest.date}</span>
                                    <Icon icon="mdi:chevron-right" width={16} className="text-default-400 ml-auto" />
                                </div>
                                <div className="flex-1">
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <div className="text-sm text-default-700 whitespace-pre-wrap line-clamp-5">{todayDigest.content}</div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* 无摘要时显示占位内容 */}
                            <div className="flex flex-col items-center justify-center h-40 pb-12">
                                <Icon icon="mdi:newspaper-variant-outline" width={32} className="text-default-400 mb-2" />
                                <p className="text-sm text-default-500">{t('rss:NoSummaryToday')}</p>
                                <p className="text-xs text-default-400 mt-1">{t('rss:SubscribeRSSFeedTip')}</p>
                            </div>
                        </>
                    )}
                </CardBody>
            </Card>

            {/* 订阅表单对话框 */}
            <RSSSubscriptionDialog
                mode="create"
                isOpen={isDialogOpen}
                verifiedUrl={verifiedUrl}
                feedTitle={feedTitle}
                feedDescription={feedDescription}
                onSuccess={handleSubscriptionSuccess}
                onClose={() => setIsDialogOpen(false)}
            />
        </>
    );
});

export default RSSSubscriptionBox;
