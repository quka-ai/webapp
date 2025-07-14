import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';

interface DeleteConfirmProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    content: string;
    isLoading?: boolean;
}

export default function DeleteConfirm({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    content, 
    isLoading = false 
}: DeleteConfirmProps) {
    const { t } = useTranslation('ai-admin');
    
    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose}
            classNames={{
                body: "py-6",
                header: "border-b-[1px] border-default-200",
                footer: "border-t-[1px] border-default-200"
            }}
        >
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <Icon icon="material-symbols:warning" width={20} height={20} className="text-warning" />
                        <span>{title}</span>
                    </div>
                </ModalHeader>
                <ModalBody>
                    <p className="text-default-600">{content}</p>
                </ModalBody>
                <ModalFooter>
                    <Button 
                        color="default" 
                        variant="light" 
                        onPress={onClose}
                        disabled={isLoading}
                    >
                        {t('Cancel')}
                    </Button>
                    <Button 
                        color="danger" 
                        onPress={onConfirm}
                        isLoading={isLoading}
                    >
                        {t('Delete')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}