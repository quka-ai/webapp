import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Popover, PopoverContent, PopoverTrigger, Textarea, useDisclosure } from "@heroui/react";
import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DeleteUserSpace, UpdateUserSpace, type UserSpace } from '@/apis/space';
import { loadUserSpaces } from '@/stores/space';

export interface ManageSpaceProps {
    space: UserSpace;
    className?: string;
    label: string;
    variant?: string;
    radius?: string;
}

const ManageSpaceComponent = forwardRef(({ space, className, label, variant, radius }: ManageSpaceProps, ref) => {
    const { t } = useTranslation();
    const { isOpen, onOpenChange, onClose } = useDisclosure();

    function trigger() {
        onOpenChange();
    }

    useImperativeHandle(ref, () => ({
        trigger
    }));

    const [desc, setDesc] = useState(space.description);
    const [title, setTitle] = useState(space.title);
    const [loading, setLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [isDisabled, setIsDisabled] = useState(false);

    const deleteSpace = useCallback(
        async function () {
            setDeleteLoading(true);
            setIsDisabled(true);
            try {
                await DeleteUserSpace(space.space_id);

                await loadUserSpaces();
                onClose();
            } catch (e: any) {
                console.error(e);
            }
            setDeleteLoading(false);
            setIsDisabled(false);
        },
        [space]
    );

    const updateSpace = useCallback(
        async function () {
            setLoading(true);
            setIsDisabled(true);
            try {
                await UpdateUserSpace(space.space_id, title, desc);

                await loadUserSpaces();
                onClose();
            } catch (e: any) {
                console.error(e);
            }
            setLoading(false);
            setIsDisabled(false);
        },
        [space, title, desc]
    );

    return (
        <>
            <Button {...{ className, variant, radius }} onPress={trigger}>
                {label}
            </Button>
            <Modal backdrop="blur" className="z-[1000000]" isOpen={isOpen} onClose={onClose}>
                <ModalContent>
                    {() => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">{t('ManageSpace')}</ModalHeader>
                            <ModalBody>
                                <Input label={t('createSpaceNameLabel')} defaultValue={title} labelPlacement="outside" placeholder="Named your space" variant="bordered" onValueChange={setTitle} />
                                <Textarea
                                    label={t('createSpaceDescriptionLabel')}
                                    variant="bordered"
                                    labelPlacement="outside"
                                    placeholder="Your space description"
                                    className="w-full"
                                    defaultValue={desc}
                                    onValueChange={setDesc}
                                />
                            </ModalBody>
                            <ModalFooter className="flex justify-between">
                                <Popover placement="top">
                                    <PopoverTrigger>
                                        <Button className="shadow-lg" color="danger" isDisabled={isDisabled} onPress={deleteSpace}>
                                            {t('Delete')}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[240px]">
                                        {titleProps => (
                                            <div className="px-1 py-2 w-full">
                                                <p className="text-small font-bold text-foreground" {...titleProps}>
                                                    {t('DeleteSpaceWarning')}
                                                </p>
                                                <div className="mt-2 flex flex-col gap-2 w-full">
                                                    <Button color="danger" isDisabled={isDisabled} variant="ghost" isLoading={deleteLoading} onPress={deleteSpace}>
                                                        {t('Delete Enter')}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </PopoverContent>
                                </Popover>

                                <Button className="bg-gradient-to-tr from-red-500 to-blue-500 text-white shadow-lg" isDisabled={isDisabled} isLoading={loading} onPress={updateSpace}>
                                    {t('Update')}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </>
    );
});

ManageSpaceComponent.displayName = 'ManageSpace';

export default ManageSpaceComponent;
