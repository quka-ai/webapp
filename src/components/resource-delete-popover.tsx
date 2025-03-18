import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from "@heroui/react";
import React, { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DeleteResource, type Resource } from '@/apis/resource';
import { useToast } from '@/hooks/use-toast';

export default memo(function DeleteKnowledgePopover({
    children,
    resource,
    onDelete,
    backdrop = 'blur'
}: {
    children: React.ReactElement;
    resource?: Resource;
    onDelete: (id: string) => void;
    backdrop?: 'transparent' | 'opaque' | 'blur' | undefined;
}) {
    // const backdrops = ['opaque', 'blur', 'transparent'];
    const { t } = useTranslation();
    const { isOpen, onOpenChange } = useDisclosure();
    const [isLoading, setLoading] = useState(false);
    const { toast } = useToast();

    async function deleteResource() {
        if (!resource) {
            return;
        }
        setLoading(true);
        try {
            await DeleteResource(resource.space_id, resource.id);
            toast({
                title: t('Success')
            });
            onDelete(resource.id);
            onOpenChange();
        } catch (e: any) {
            console.error(e);
        }
        setLoading(false);
    }

    return (
        <>
            {React.cloneElement(children, {
                onClick: onOpenChange
            })}
            {resource && (
                <Modal backdrop={backdrop} isOpen={isOpen} onOpenChange={onOpenChange}>
                    <ModalContent>
                        {_ => (
                            <>
                                <ModalHeader className="flex flex-col gap-1">{t('Delete Enter')}</ModalHeader>
                                <ModalBody>
                                    <p className="text-base text-wrap break-words">
                                        {resource.title && (
                                            <>
                                                {t('You will delete resource')}: &quot;<span className="font-bold text-red-500">{resource.title}</span>&quot;
                                            </>
                                        )}
                                        <br /> ID: {resource.id}
                                    </p>
                                </ModalBody>
                                <ModalFooter>
                                    <Button color="danger" isLoading={isLoading} onPress={deleteResource}>
                                        {t('Confirm')}
                                    </Button>
                                </ModalFooter>
                            </>
                        )}
                    </ModalContent>
                </Modal>
            )}
        </>
    );
});
