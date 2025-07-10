import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
import { AlertTriangle } from 'lucide-react';

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
                        <AlertTriangle className="w-5 h-5 text-warning" />
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
                        取消
                    </Button>
                    <Button 
                        color="danger" 
                        onPress={onConfirm}
                        isLoading={isLoading}
                    >
                        确认删除
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}