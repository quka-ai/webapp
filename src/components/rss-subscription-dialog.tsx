import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, SelectSection, Textarea } from '@heroui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSnapshot } from 'valtio';

import type { CreateRSSSubscriptionRequest, RSSSubscription, UpdateRSSSubscriptionRequest } from '@/@types/rss';
import { UPDATE_FREQUENCY_OPTIONS } from '@/@types/rss';
import { createRSSSubscription, updateRSSSubscription } from '@/apis/rss';
import { useGroupedResources } from '@/hooks/use-resource';
import resourceStore from '@/stores/resource';
import { addSubscription, updateSubscriptionInStore } from '@/stores/rss';
import spaceStore from '@/stores/space';

export interface RSSSubscriptionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'create' | 'edit';
    // 创建模式
    verifiedUrl?: string;
    feedTitle?: string;
    feedDescription?: string;
    // 编辑模式
    subscription?: RSSSubscription;
    // 回调
    onSuccess?: (subscription: RSSSubscription) => void;
}

export default function RSSSubscriptionDialog({ isOpen, onClose, mode, verifiedUrl, feedTitle = '', feedDescription = '', subscription, onSuccess }: RSSSubscriptionDialogProps) {
    const { t } = useTranslation();
    const { currentSelectedResource } = useSnapshot(resourceStore);
    const { currentSelectedSpace } = useSnapshot(spaceStore);
    const { groupedResources } = useGroupedResources();

    const isEditMode = mode === 'edit';
    const url = isEditMode ? subscription?.url : verifiedUrl;

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [resourceId, setResourceId] = useState('');
    const [updateFrequency, setUpdateFrequency] = useState(3600);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 初始化表单数据
    useEffect(() => {
        if (isOpen) {
            if (isEditMode && subscription) {
                setTitle(subscription.title);
                setDescription(subscription.description);
                setCategory(subscription.category);
                setResourceId(subscription.resource_id);
                setUpdateFrequency(subscription.update_frequency);
            } else {
                setTitle(feedTitle);
                setDescription(feedDescription);
                setCategory('');
                setResourceId('');
                setUpdateFrequency(3600);
            }
        }
    }, [isOpen, isEditMode, subscription, feedTitle, feedDescription]);

    // 默认资源选择
    const defaultResource = useMemo(() => {
        if (isEditMode && subscription) {
            return subscription.resource_id;
        }
        if (currentSelectedResource?.id) {
            return currentSelectedResource.id;
        }
        return 'knowledge';
    }, [isEditMode, subscription, currentSelectedResource]);

    // 获取资源名称（编辑模式下显示）
    // const resourceName = useMemo(() => {
    //     const targetId = resourceId || defaultResource;
    //     for (const group of groupedResources) {
    //         const found = group.items.find(r => r.id === targetId);
    //         if (found) return found.title;
    //     }
    //     return targetId;
    // }, [resourceId, defaultResource, groupedResources]);

    // 处理关闭
    const handleClose = useCallback(() => {
        onClose();
    }, [onClose]);

    // 提交订阅
    const handleSubmit = useCallback(async () => {
        if (!currentSelectedSpace) {
            toast.error(t('rss:PleaseSelectWorkspace'));
            return;
        }

        setIsSubmitting(true);

        try {
            if (resourceId === 'knowledge') {
                toast.error(t('rss:CannotSaveToDefaultResource'));
                return;
            }
            if (isEditMode && subscription) {
                // 编辑模式
                const data: UpdateRSSSubscriptionRequest = {
                    title: title.trim(),
                    description: description.trim(),
                    category: category.trim(),
                    update_frequency: updateFrequency,
                    resource_id: resourceId
                };

                await updateRSSSubscription(currentSelectedSpace, subscription.id, data);
                updateSubscriptionInStore(subscription.id, data);

                toast.success(t('rss:SubscriptionUpdated'));
                onSuccess?.({ ...subscription, ...data });
            } else {
                // 创建模式
                const selectedResource = resourceId;
                if (!selectedResource) {
                    toast.error(t('rss:PleaseSelectResource'));
                    setIsSubmitting(false);
                    return;
                }

                const data: CreateRSSSubscriptionRequest = {
                    resource_id: selectedResource,
                    url: verifiedUrl!,
                    title: title.trim(),
                    description: description.trim(),
                    category: category.trim(),
                    update_frequency: updateFrequency
                };

                const newSubscription = await createRSSSubscription(currentSelectedSpace, data);
                addSubscription(newSubscription);

                toast.success(t('rss:SubscriptionCreated'));
                onSuccess?.(newSubscription);
            }

            handleClose();
        } catch (error: any) {
            console.error('Failed to save RSS subscription:', error);
            toast.error(error.message || t(isEditMode ? 'rss:UpdateSubscriptionFailed' : 'rss:CreateSubscriptionFailed'));
        } finally {
            setIsSubmitting(false);
        }
    }, [currentSelectedSpace, isEditMode, subscription, resourceId, defaultResource, title, description, category, updateFrequency, verifiedUrl, handleClose, onSuccess, t]);

    return (
        <Modal isOpen={isOpen} size="2xl" scrollBehavior="inside" onClose={handleClose}>
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">{t(isEditMode ? 'rss:EditSubscription' : 'rss:CreateRSSSubscription')}</ModalHeader>
                <ModalBody>
                    <div className="flex flex-col gap-4">
                        {/* RSS URL (只读) */}
                        <Input
                            isReadOnly
                            label={t('rss:RSSUrl')}
                            value={url || ''}
                            variant="flat"
                            classNames={{
                                input: 'text-default-500'
                            }}
                        />

                        {/* 标题 */}
                        <Input
                            label={t('rss:Title')}
                            placeholder={t('rss:SubscriptionTitle')}
                            value={title}
                            variant="bordered"
                            onValueChange={setTitle}
                            onBlur={e => setTitle(e.target.value.trim())}
                        />

                        {/* 描述 */}
                        <Textarea
                            label={t('rss:Description')}
                            placeholder={t('rss:SubscriptionDescriptionOptional')}
                            value={description}
                            variant="bordered"
                            minRows={3}
                            onValueChange={setDescription}
                            onBlur={e => setDescription(e.target.value.trim())}
                        />

                        {/* 资源选择器 */}
                        <Select
                            isRequired
                            label={t('rss:SelectResource')}
                            placeholder={t('rss:SelectKnowledgeBaseResource')}
                            defaultSelectedKeys={[defaultResource]}
                            variant="bordered"
                            onSelectionChange={keys => {
                                const selected = Array.from(keys)[0];
                                setResourceId(selected as string);
                            }}
                        >
                            {groupedResources.map(group => (
                                <SelectSection key={group.title} showDivider title={t(group.title)}>
                                    {group.items.filter(resource => resource.id !== 'knowledge').map(resource => (
                                        <SelectItem key={resource.id}>{resource.title}</SelectItem>
                                    ))}
                                </SelectSection>
                            ))}
                        </Select>

                        {/* 分类 */}
                        <Input
                            label={t('rss:Category')}
                            placeholder={t('rss:CategoryExample')}
                            value={category}
                            variant="bordered"
                            onValueChange={setCategory}
                            onBlur={e => setCategory(e.target.value.trim())}
                        />

                        {/* 更新频率 */}
                        <Select
                            label={t('rss:UpdateFrequency')}
                            placeholder={t('rss:SelectUpdateFrequency')}
                            selectedKeys={[String(updateFrequency)]}
                            variant="bordered"
                            onSelectionChange={keys => {
                                const selected = Array.from(keys)[0];
                                setUpdateFrequency(Number(selected));
                            }}
                        >
                            {UPDATE_FREQUENCY_OPTIONS.map(option => (
                                <SelectItem key={String(option.value)}>{option.label}</SelectItem>
                            ))}
                        </Select>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button color="danger" variant="light" isDisabled={isSubmitting} onPress={handleClose}>
                        {t('rss:Cancel')}
                    </Button>
                    <Button color="primary" isLoading={isSubmitting} onPress={handleSubmit}>
                        {t(isEditMode ? 'rss:Save' : 'rss:CreateSubscription')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
