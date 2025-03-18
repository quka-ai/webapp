import { Button, ButtonGroup, Input, Kbd, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Textarea, useDisclosure } from '@heroui/react';
import { TargetIcon } from '@radix-ui/react-icons';
import { forwardRef, memo, useCallback, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnapshot } from 'valtio';

import ResourceDeletePopover from './resource-delete-popover';

import { CreateResource, type Resource, UpdateResource } from '@/apis/resource';
import { useMedia } from '@/hooks/use-media';
import { useToast } from '@/hooks/use-toast';
import resourceStore from '@/stores/resource';
import spaceStore from '@/stores/space';

interface ResourceManageProps {
    onModify: () => void;
}

const ResourceManage = memo(
    forwardRef((props: ResourceManageProps, ref: any) => {
        const { t } = useTranslation();
        const { currentSelectedSpace } = useSnapshot(spaceStore);
        const { resourceTags } = useSnapshot(resourceStore);
        const { isOpen, onOpen, onClose } = useDisclosure();
        const [id, setID] = useState('');
        const [title, setTitle] = useState('');
        const [cycle, setCycle] = useState<number | null>();
        const [tag, setTag] = useState('resources');
        const [description, setDescription] = useState('');
        const [resource, setResource] = useState<Resource | null>({
            title: '',
            description: '',
            id: ''
        });
        const [isCreate, setIsCreate] = useState(false);
        const [isLoading, setIsLoading] = useState(false);
        const { toast } = useToast();

        const { isMobile } = useMedia();
        const { onModify } = props;

        function show(resource: Resource | string | undefined) {
            if (!resource) {
                setIsCreate(true);
            } else if (typeof resource === 'string') {
                // TODO load resource
            } else {
                setResource(resource);
                setID(resource.id);
                setTitle(resource.title);
                setCycle(resource.cycle);
                setDescription(resource.description);
                setTag(resource.tag);
            }
            onOpen();
        }

        const create = useCallback(async () => {
            if (!id) {
                return;
            }
            setIsLoading(true);
            try {
                await CreateResource(currentSelectedSpace, id, title, cycle, tag, description);
                onModify && onModify();
                onClose();
                toast({
                    title: t('Success')
                });
            } catch (e: any) {
                console.error(e);
            }
            setIsLoading(false);
        }, [currentSelectedSpace, id, title, cycle, tag, description]);

        const update = useCallback(async () => {
            if (!id) {
                return;
            }
            setIsLoading(true);
            try {
                await UpdateResource(currentSelectedSpace, id, title, cycle, tag, description);
                onModify && onModify();
                onClose();
                toast({
                    title: t('Success')
                });
            } catch (e: any) {
                console.error(e);
            }
            setIsLoading(false);
        }, [currentSelectedSpace, id, title, cycle, tag, description]);

        const onDelete = useCallback(async () => {
            onModify && onModify();
            onClose();
            toast({
                title: t('Success')
            });
        }, [currentSelectedSpace, id, title, cycle, tag, description]);

        useImperativeHandle(ref, () => {
            return {
                show
            };
        });

        return (
            <Modal backdrop="blur" placement="auto" scrollBehavior="inside" size={isMobile ? 'full' : 'lg'} isOpen={isOpen} isKeyboardDismissDisabled={false} onClose={onClose}>
                <ModalContent>
                    {onClose => (
                        <>
                            <ModalHeader className="flex flex-col gap-1 dark:text-gray-100 text-gray-800">
                                {/* <Breadcrumbs>
                                    <BreadcrumbItem>Home</BreadcrumbItem>
                                    <BreadcrumbItem onClick={onClose}>{spaceTitle === 'Main' ? t('MainSpace') : spaceTitle}</BreadcrumbItem>
                                    <BreadcrumbItem>{t('CreateResource')}</BreadcrumbItem>
                                </Breadcrumbs> */}
                            </ModalHeader>
                            <ModalBody className="w-full overflow-hidden flex flex-col items-center">
                                <div className="w-full h-full md:max-w-[650px]">
                                    <div className="flex flex-wrap gap-1">
                                        <Input
                                            isRequired
                                            isDisabled={!isCreate}
                                            label={t('ID')}
                                            variant="bordered"
                                            placeholder="Resource key"
                                            className="text-xl text-gray-800 dark:text-gray-100"
                                            labelPlacement="outside"
                                            defaultValue={resource?.id}
                                            description={t('ResourceIDInputDescription')}
                                            onValueChange={setID}
                                        />
                                    </div>
                                    <div className="w-full my-5 dark:text-gray-100 text-gray-800 text-lg overflow-hidden">
                                        <Input
                                            label={t('Title')}
                                            variant="bordered"
                                            placeholder="Resource title"
                                            className="text-xl text-gray-800 dark:text-gray-100"
                                            labelPlacement="outside"
                                            defaultValue={resource?.title}
                                            onValueChange={setTitle}
                                        />
                                    </div>
                                    <div className="w-full my-5 dark:text-gray-100 text-gray-800 text-lg overflow-hidden">
                                        <Select
                                            isRequired
                                            label={t('knowledgeCreateResourceLable')}
                                            defaultSelectedKeys={tag ? [tag] : ['resources']}
                                            labelPlacement="outside"
                                            placeholder="Select an resource"
                                            className="text-xl text-gray-800 dark:text-gray-100"
                                            classNames={{ label: 'text-white font-bold' }}
                                            variant="bordered"
                                            onSelectionChange={item => {
                                                if (item) {
                                                    setTag(item.currentKey || '');
                                                }
                                            }}
                                        >
                                            {resourceTags.map(item => {
                                                return <SelectItem key={item}>{t(item)}</SelectItem>;
                                            })}
                                        </Select>
                                    </div>

                                    <div className="flex flex-wrap gap-1 mb-5">
                                        <Input
                                            label={t('ClearCycle') + '(' + t('Day') + ')' + ' empty or 0 means unlimit'}
                                            variant="bordered"
                                            placeholder="Resource life cycle (days)"
                                            className="text-xl text-gray-800 dark:text-gray-100"
                                            labelPlacement="outside"
                                            type="number"
                                            defaultValue={resource?.cycle}
                                            description={t('ResourceClearCycleInputDescription')}
                                            onValueChange={setCycle}
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-1 mb-5">
                                        <Textarea
                                            label={t('Description')}
                                            variant="bordered"
                                            labelPlacement="outside"
                                            placeholder="Your resource description"
                                            className="w-full"
                                            defaultValue={resource?.description}
                                            onValueChange={setDescription}
                                        />
                                    </div>
                                </div>
                            </ModalBody>

                            <ModalFooter className="flex justify-center">
                                <ButtonGroup variant="flat" size="base">
                                    <Button
                                        className=" text-white bg-gradient-to-br from-pink-300 to-indigo-300 dark:from-indigo-500 dark:to-pink-500"
                                        isLoading={isLoading}
                                        size="base"
                                        onPress={isCreate ? create : update}
                                    >
                                        {isCreate ? t('Submit') : t('Update')}
                                    </Button>
                                    {isCreate || (
                                        <ResourceDeletePopover resource={resource} onDelete={onDelete}>
                                            <Button color="danger">{t('Delete')}</Button>
                                        </ResourceDeletePopover>
                                    )}

                                    <Button onPress={onClose}>{t('Close')}</Button>
                                </ButtonGroup>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        );
    })
);

export default ResourceManage;
