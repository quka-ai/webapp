import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from '@heroui/react';
import { Icon } from '@iconify/react';
import { createContext, forwardRef, memo, useCallback, useContext, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const ShareContext = createContext(null);

export function ShareProvider({ children }) {
    const [shareURL, setShareURL] = useState('');
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    return (
        <ShareContext.Provider
            value={{
                shareURL,
                setShareURL,
                isOpen,
                onOpen,
                onOpenChange
            }}
        >
            {children}
            <ShareLinkModal isOpen={isOpen} shareURL={shareURL} onOpenChange={onOpenChange} />
        </ShareContext.Provider>
    );
}

export function useShare({ genUrlFunc }: ShareButtonProps) {
    const { t } = useTranslation();

    const { onOpen, setShareURL } = useContext(ShareContext);

    const [createShareLoading, setCreateShareLoading] = useState(false);
    const createShareURL = useCallback(async () => {
        setCreateShareLoading(true);
        try {
            const url = await genUrlFunc();
            if (url) {
                setShareURL(url);
                onOpen();
            }
            // const res = await CreateKnowledgeShareURL(knowledge?.space_id, window.location.origin + '/s/k/{token}', knowledge?.id);
        } catch (e: any) {
            console.error(e);
        }
        setCreateShareLoading(false);
    }, [genUrlFunc, onOpen, setShareURL]);

    return {
        createShareURL: createShareURL,
        shareText: t('Share'),
        shareIcon: 'fluent:share-24-regular',
        isLoading: createShareLoading
    };
}

export interface ShareButtonProps {
    genUrlFunc: () => Promise<string>;
}

export default function ShareButton({ genUrlFunc }: ShareButtonProps) {
    const { createShareURL, shareText, shareIcon, isLoading } = useShare({ genUrlFunc });

    return (
        <Button size="sm" variant="faded" endContent={<Icon icon={shareIcon} />} isLoading={isLoading} onPress={createShareURL}>
            {shareText}
        </Button>
    );
}

export interface ShareLinkModalProps {
    isOpen: boolean;
    shareURL: string;
    onOpenChange: () => void;
}

const ShareLinkModal = memo(
    forwardRef(({ isOpen, onOpenChange, shareURL }: ShareLinkModalProps, ref: any) => {
        const { t } = useTranslation();

        const [isCopied, setIsCopied] = useState(false);
        const input = useRef();
        const copyLink = useCallback(() => {
            if (input.current) {
                input.current.select();
                document.execCommand('copy');
                toast.success(t('LinkCopied'));
                setIsCopied(true);
                setTimeout(() => {
                    setIsCopied(false);
                }, 3000);
            }
        }, [shareURL, input]);

        useImperativeHandle(ref, () => {
            return {
                show
            };
        });
        return (
            <>
                <Modal isOpen={isOpen} placement="top-center" onOpenChange={onOpenChange}>
                    <ModalContent>
                        {onClose => (
                            <>
                                <ModalHeader className="flex flex-col gap-1 pb-2">{t('ShareLink')}</ModalHeader>
                                <ModalBody>
                                    {shareURL && (
                                        <Input
                                            ref={input}
                                            endContent={
                                                isCopied ? (
                                                    <button onClick={() => {}}>
                                                        <Icon icon="tabler:checks" color="green" width={24} />
                                                    </button>
                                                ) : (
                                                    <button onClick={copyLink}>
                                                        <Icon icon="tabler:copy" width={24} />
                                                    </button>
                                                )
                                            }
                                            size="lg"
                                            readOnly
                                            variant="bordered"
                                            value={shareURL}
                                        />
                                    )}
                                </ModalBody>
                                <ModalFooter></ModalFooter>
                            </>
                        )}
                    </ModalContent>
                </Modal>
            </>
        );
    })
);
