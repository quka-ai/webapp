import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from "@heroui/react";
import React, { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DeleteKnowledge, type Knowledge } from '@/apis/knowledge';

export default memo(function DeleteKnowledgePopover({
    children,
    knowledge,
    onDelete,
    backdrop = 'blur'
}: {
    children: React.ReactElement;
    knowledge?: Knowledge;
    onDelete?: (id: string) => void;
    backdrop?: 'transparent' | 'opaque' | 'blur' | undefined;
}) {
    // const backdrops = ['opaque', 'blur', 'transparent'];
    const { t } = useTranslation();
    const { isOpen, onOpenChange } = useDisclosure();
    const [isLoading, setLoading] = useState(false);

    async function deleteKnowledge() {
        if (!knowledge) {
            return;
        }
        setLoading(true);
        try {
            await DeleteKnowledge(knowledge.space_id, knowledge.id);
            onDelete && onDelete(knowledge.id);
            onOpenChange();
        } catch (e: any) {
            console.error(e);
        }
        setLoading(false);
    }

    return (
        <>
            {React.cloneElement(children, {
                onPress: onOpenChange
            })}
            {knowledge && (
                <Modal backdrop={backdrop} isOpen={isOpen} onOpenChange={onOpenChange}>
                    <ModalContent>
                        {_ => (
                            <>
                                <ModalHeader className="flex flex-col gap-1">{t('Delete Enter')}</ModalHeader>
                                <ModalBody>
                                    <p className="text-base text-wrap break-words">
                                        {knowledge.title && (
                                            <>
                                                {t('You will delete knowledge')}: &quot;<span className="font-bold text-red-500">{knowledge.title}</span>&quot;
                                            </>
                                        )}
                                        <br /> ID: {knowledge.id}
                                    </p>
                                </ModalBody>
                                <ModalFooter>
                                    <Button color="danger" isLoading={isLoading} onPress={deleteKnowledge}>
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
