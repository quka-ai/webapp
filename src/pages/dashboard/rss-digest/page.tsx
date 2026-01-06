import {
    Button,
    Card,
    CardBody,
    CardHeader,
    Chip,
    DatePicker,
    Divider,
    Input,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Spinner
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { parseDate } from '@internationalized/date';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useSnapshot } from 'valtio';

import type { RSSDigestItem } from '@/@types/rss';
import { generateDigest, loadDigestHistory, setDigestHistory } from '@/stores/rss';
import rssStore from '@/stores/rss';
import spaceStore from '@/stores/space';

export default memo(function RSSDigestPage() {
    const { t } = useTranslation('digest');
    const navigate = useNavigate();

    const { currentSelectedSpace } = useSnapshot(spaceStore);
    const { digestHistory, loadingHistory } = useSnapshot(rssStore);

    const [searchKeyword, setSearchKeyword] = useState('');
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // 返回上一页
    const handleBack = useCallback(() => {
        navigate('/dashboard');
    }, [navigate]);

    // 加载历史摘要列表
    useEffect(() => {
        if (!currentSelectedSpace) return;

        loadDigestHistory(currentSelectedSpace);
    }, [currentSelectedSpace]);

    // 跳转到摘要详情页
    const openDigestDetail = useCallback(
        (digestId: string) => {
            navigate(`/dashboard/${currentSelectedSpace}/rss-digest/${digestId}`);
        },
        [currentSelectedSpace, navigate]
    );

    // 打开生成摘要对话框
    const openGenerateModal = useCallback(() => {
        setIsGenerateModalOpen(true);
    }, []);

    // 关闭生成摘要对话框
    const closeGenerateModal = useCallback(() => {
        setIsGenerateModalOpen(false);
        setSelectedDate(null);
    }, []);

    // 生成摘要
    const handleGenerate = useCallback(async () => {
        if (!currentSelectedSpace) return;

        setIsGenerating(true);
        try {
            const dateStr = selectedDate ? selectedDate.toISOString().split('T')[0] : undefined;
            await generateDigest(currentSelectedSpace, dateStr);
            toast.success(t('digestGenerated'));

            // 重新加载历史列表
            await loadDigestHistory(currentSelectedSpace);
            closeGenerateModal();
        } catch (error: any) {
            console.error('Failed to generate digest:', error);
            toast.error(error.message || t('generateDigestFailed'));
        } finally {
            setIsGenerating(false);
        }
    }, [currentSelectedSpace, selectedDate, closeGenerateModal, t]);

    // 过滤摘要列表
    const filteredDigests = digestHistory?.filter(digest => {
        if (!searchKeyword) return true;
        const keyword = searchKeyword.toLowerCase();
        return digest.date.includes(keyword) || digest.model.toLowerCase().includes(keyword) || String(digest.article_count).includes(keyword);
    });

    const goToSubscriptionList = useCallback(() => {
        navigate(`/dashboard/${currentSelectedSpace}/rss-subscriptions`);
    }, [navigate, currentSelectedSpace]);

    return (
        <div className="w-full flex flex-col items-center">
            {/* 返回按钮 */}
            <div className="w-full p-4 box-border">
                <div className="flex items-center gap-3">
                    <Button startContent={<Icon icon="material-symbols:arrow-back-ios-rounded" />} variant="bordered" onPress={handleBack}>
                        {t('back')}
                    </Button>
                    <Button startContent={<Icon icon="mdi:view-list" />} variant="bordered" onPress={goToSubscriptionList}>
                        {t('subscriptionList')}
                    </Button>
                </div>
            </div>

            {/* 主内容区域 */}
            <div className="w-full max-w-6xl flex-1 p-4">
                {/* 标题栏 */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Icon icon="mdi:newspaper-variant-outline" width={32} />
                        <div>
                            <h1 className="text-3xl font-bold leading-9 text-default-foreground">{t('title')}</h1>
                            <p className="mt-1 text-sm text-default-500">{t('description')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {digestHistory && (
                            <Chip size="lg" variant="flat" color="primary">
                                {digestHistory.length} {t('summaryCount', { count: digestHistory.length })}
                            </Chip>
                        )}
                        <Button color="primary" startContent={<Icon icon="mdi:plus" width={20} />} onPress={openGenerateModal}>
                            {t('generateDigest')}
                        </Button>
                    </div>
                </div>

                {/* 搜索栏 */}
                <div className="mb-6">
                    <Input
                        isClearable
                        className="max-w-md"
                        placeholder={t('searchPlaceholder')}
                        value={searchKeyword}
                        startContent={<Icon icon="mdi:magnify" width={20} />}
                        onValueChange={setSearchKeyword}
                    />
                </div>

                {/* 摘要列表 */}
                {loadingHistory ? (
                    <div className="flex items-center justify-center py-20">
                        <Spinner size="lg" />
                    </div>
                ) : !filteredDigests || filteredDigests.length === 0 ? (
                    <Card className="border-dashed border-2">
                        <CardBody className="flex flex-col items-center justify-center py-20">
                            <Icon icon="mdi:newspaper-off" width={48} className="text-default-400 mb-4" />
                            <p className="text-default-500 mb-2">{searchKeyword ? t('noMatchingDigests') : t('noDigests')}</p>
                            {!searchKeyword && <p className="text-xs text-default-400">{t('noDigestsHint')}</p>}
                        </CardBody>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredDigests.map(digest => (
                            <DigestCard key={digest.id} digest={digest} onClick={() => openDigestDetail(digest.id)} />
                        ))}
                    </div>
                )}
            </div>

            {/* 生成摘要对话框 */}
            <Modal isOpen={isGenerateModalOpen} onClose={closeGenerateModal}>
                <ModalContent>
                    <ModalHeader>{t('generateRssDigest')}</ModalHeader>
                    <ModalBody>
                        <div className="flex flex-col gap-4">
                            <p className="text-sm text-default-600">{t('selectDate')}</p>
                            <Popover placement="bottom">
                                <PopoverTrigger>
                                    <Button variant="bordered" className="w-full justify-start text-left font-normal">
                                        <Icon icon="mdi:calendar" width={20} className="mr-2" />
                                        {selectedDate ? selectedDate.toLocaleDateString() : t('selectDatePlaceholder')}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0">
                                    <Calendar
                                        value={selectedDate ? parseDate(selectedDate.toISOString().split('T')[0]) : null}
                                        onChange={date => {
                                            if (date) {
                                                setSelectedDate(new Date(date.year, date.month - 1, date.day));
                                            } else {
                                                setSelectedDate(null);
                                            }
                                        }}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" isDisabled={isGenerating} onPress={closeGenerateModal}>
                            {t('cancel')}
                        </Button>
                        <Button color="primary" isLoading={isGenerating} onPress={handleGenerate}>
                            {t('generate')}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
});

// 摘要卡片组件
interface DigestCardProps {
    digest: RSSDigestItem;
    onClick: () => void;
}

const DigestCard = memo(function DigestCard({ digest, onClick }: DigestCardProps) {
    const { t } = useTranslation('digest');

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString();
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleString();
    };

    return (
        <Card isPressable onPress={onClick} className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-col items-start gap-2">
                <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Icon icon="mdi:calendar" width={18} />
                        <h3 className="text-lg font-semibold">{formatDate(digest.date)}</h3>
                    </div>
                    <Icon icon="mdi:chevron-right" width={18} className="text-default-400" />
                </div>
            </CardHeader>
            <Divider />
            <CardBody className="gap-2">
                <div className="flex items-center gap-2 text-sm text-default-600">
                    <Icon icon="mdi:file-document-outline" width={16} />
                    <span>
                        {digest.article_count} {t('articles', { count: digest.article_count })}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-default-600">
                    <Icon icon="mdi:robot" width={16} />
                    <span>{digest.model}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-default-500">
                    <Icon icon="mdi:clock-outline" width={14} />
                    <span>
                        {t('generatedAt')}: {formatTime(digest.generated_at)}
                    </span>
                </div>
            </CardBody>
        </Card>
    );
});

// 日期选择器组件（简化版，使用原生 input[type="date"]）
const Calendar = memo(function Calendar({ value, onChange }: { value: any; onChange: (date: any) => void }) {
    return (
        <div className="p-3">
            <input
                type="date"
                className="w-full p-2 border border-default-200 rounded-lg"
                value={value ? value.toString() : ''}
                onChange={e => {
                    if (e.target.value) {
                        const [year, month, day] = e.target.value.split('-').map(Number);
                        onChange({ year, month, day });
                    }
                }}
            />
        </div>
    );
});
