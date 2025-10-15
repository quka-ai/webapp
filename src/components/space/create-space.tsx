import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea, Tooltip, useDisclosure } from '@heroui/react';
import { Icon } from '@iconify/react';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { CreateUserSpace } from '@/apis/space';
import { loadUserSpaces } from '@/stores/space';

const LabelWithTooltip = ({ label, tooltip }: { label: string; tooltip: string }) => {
    return (
        <div className="flex items-center gap-1">
            <span className="text-sm text-foreground">{label}</span>
            <Tooltip content={tooltip} placement="right" showArrow delay={200} className="max-w-xs">
                <div className="cursor-help">
                    <Icon icon="solar:question-circle-linear" className="text-default-400 text-lg" />
                </div>
            </Tooltip>
        </div>
    );
};

const CreateSpaceComponent = forwardRef((_, ref) => {
    const { t } = useTranslation();
    const { isOpen, onOpenChange, onClose } = useDisclosure();

    function trigger() {
        onOpenChange();
    }

    useImperativeHandle(ref, () => ({
        trigger
    }));

    const [desc, setDesc] = useState('');
    const [title, setTitle] = useState('');
    const [basePrompt, setBasePrompt] = useState('');
    const [chatPrompt, setChatPrompt] = useState('');
    const [loading, setLoading] = useState(false);

    async function createSpace() {
        setLoading(true);
        try {
            await CreateUserSpace(title, desc, basePrompt, chatPrompt);

            await loadUserSpaces();
            onClose();
            toast.success(t('Success'));
        } catch (e: any) {
            console.error(e);
        }
        setLoading(false);
    }

    return (
        <>
            <Modal backdrop="blur" className="z-[1000000]" isOpen={isOpen} onClose={onClose}>
                <ModalContent>
                    {() => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">{t('Create new space')}</ModalHeader>
                            <ModalBody>
                                <Input isRequired label={t('createSpaceNameLabel')} size="lg" labelPlacement="outside" placeholder="Named your space" variant="bordered" onValueChange={setTitle} />
                                <Textarea
                                    size="lg"
                                    label={t('createSpaceDescriptionLabel')}
                                    variant="bordered"
                                    labelPlacement="outside"
                                    placeholder="Your space description"
                                    className="w-full"
                                    onValueChange={setDesc}
                                />
                                <Textarea
                                    size="lg"
                                    label={<LabelWithTooltip label={t('createSpaceBasePromptLabel')} tooltip={t('createSpaceBasePromptTooltip')} />}
                                    variant="bordered"
                                    labelPlacement="outside"
                                    placeholder="Your space base prompt"
                                    className="w-full"
                                    onValueChange={setBasePrompt}
                                />
                                <Textarea
                                    size="lg"
                                    label={<LabelWithTooltip label={t('createSpaceChatPromptLabel')} tooltip={t('createSpaceChatPromptTooltip')} />}
                                    variant="bordered"
                                    labelPlacement="outside"
                                    placeholder="Your space chat prompt"
                                    className="w-full"
                                    onValueChange={setChatPrompt}
                                />
                            </ModalBody>
                            <ModalFooter>
                                <Button className="bg-gradient-to-tr from-red-500 to-blue-500 text-white shadow-lg" isLoading={loading} onPress={createSpace}>
                                    {t('Create')}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </>
    );
});

CreateSpaceComponent.displayName = 'CreateSpace';

export default CreateSpaceComponent;
