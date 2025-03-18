import { Icon } from '@iconify/react';
import { BreadcrumbItem, Breadcrumbs, Button, ButtonGroup, Kbd, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Skeleton, Spacer, useDisclosure } from "@heroui/react";
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import { GetKnowledge, type Knowledge } from '@/apis/knowledge';
import { type Resource } from '@/apis/resource';
import { ListResources } from '@/apis/resource';
import { CreateKnowledgeShareURL } from '@/apis/share';
import KnowledgeDeletePopover from '@/components/knowledge-delete-popover';
import KnowledgeEdit from '@/components/knowledge-edit';
import KnowledgeView from '@/components/knowledge-view';
import ShareButton from '@/components/share-button';
import { useMedia } from '@/hooks/use-media';
import { usePlan } from '@/hooks/use-plan';
import { useRole } from '@/hooks/use-role';
import resourceStore, { loadSpaceResource } from '@/stores/resource';
import spaceStore from '@/stores/space';

export interface ViewKnowledgeProps {
    onChange?: () => void;
    onDelete?: (id: string) => void;
    onClose?: () => void;
}

const ViewKnowledge = memo(
    forwardRef((props: ViewKnowledgeProps, ref: any) => {
        const { t } = useTranslation();
        const { isOpen, onOpen, onClose } = useDisclosure();
        const [knowledge, setKnowledge] = useState<Knowledge>();
        const [size, setSize] = useState<Size>('md');
        const [isEdit, setIsEdit] = useState(false);
        const { isMobile } = useMedia();
        const [canEsc, setCanEsc] = useState(true);
        const { isSpaceViewer } = useRole();

        const { onChange, onDelete } = props;

        const onChangeFunc = useCallback(() => {
            onChange && onChange();
            close();
        }, [onChange]);

        const onDeleteFunc = useCallback(() => {
            if (knowledge && onDelete) {
                onDelete(knowledge.id);
            }
            close();
        }, [knowledge]);

        useEffect(() => {
            if (isMobile) {
                setSize('full');
            } else {
                // TODO maybe
                // setSize('3xl');
                setSize('full');
            }
        }, [isMobile]);

        const [isLoading, setIsLoading] = useState(false);

        async function loadKnowledge(id: string) {
            setIsLoading(true);
            try {
                const resp = await GetKnowledge(currentSelectedSpace, id);

                setKnowledge(resp);
            } catch (e: any) {
                console.error(e);
                onClose();
            }
            setIsLoading(false);
        }

        function show(knowledge: Knowledge | string) {
            if (typeof knowledge === 'string') {
                loadKnowledge(knowledge);
            } else {
                setKnowledge(knowledge);
            }
            onOpen();
        }

        const { spaces, currentSelectedSpace } = useSnapshot(spaceStore);
        const spaceTitle = useMemo(() => {
            if (!currentSelectedSpace) {
                return '';
            }

            const target = spaces.find(v => v.space_id === currentSelectedSpace);
            return target?.title;
        }, [spaces, currentSelectedSpace]);

        const changeEditable = useCallback(() => {
            const newState = !isEdit;

            setIsEdit(newState);
            setCanEsc(!newState);
        }, [isEdit]);

        const close = useCallback(function () {
            setIsEdit(false);
            setCanEsc(true);
            if (props.onClose) {
                props.onClose();
            }
            onClose();
        }, []);

        const { currentSpaceResources } = useSnapshot(resourceStore);
        const reloadSpaceResource = useCallback(async (spaceID: string) => {
            try {
                await loadSpaceResource(spaceID);
            } catch (e: any) {
                console.error(e);
            }
        }, []);

        useEffect(() => {
            if (!currentSelectedSpace || currentSpaceResources) {
                return;
            }
            loadSpaceResource(currentSelectedSpace);
        }, [currentSelectedSpace, currentSpaceResources]);

        const knowledgeResource = useMemo(() => {
            if (!knowledge || !currentSpaceResources) {
                return '';
            }

            const resource = currentSpaceResources.find((v: Resource) => v.id === knowledge.resource);

            return resource ? resource.title : knowledge.resource;
        }, [knowledge, currentSpaceResources]);

        useImperativeHandle(ref, () => {
            return {
                show
            };
        });

        const editor = useRef();
        const [saveLoading, setSaveLoading] = useState(false);
        const submit = useCallback(async () => {
            if (editor.current) {
                setSaveLoading(true);
                try {
                    await editor.current.submit();
                } catch (e: any) {
                    console.error(e);
                }
                setSaveLoading(false);
            }
        });

        const { userIsPro } = usePlan();
        const navigate = useNavigate();

        return (
            <>
                <Modal hideCloseButton backdrop="blur" placement="top-center" size={size} isOpen={isOpen} isKeyboardDismissDisabled={!canEsc} scrollBehavior="inside" onClose={close}>
                    {knowledge && !isLoading ? (
                        <ModalContent>
                            {onClose => (
                                <>
                                    <ModalHeader className="flex items-center justify-between dark:text-gray-100 text-gray-800 gap-4">
                                        <Breadcrumbs className="break-all text-wrap max-w-[66%] overflow-hidden text-ellipsis">
                                            <BreadcrumbItem
                                                onClick={() => {
                                                    navigate('/');
                                                }}
                                            >
                                                {t('Home')}
                                            </BreadcrumbItem>
                                            <BreadcrumbItem onClick={onClose}>{spaceTitle === 'Main' ? t('MainSpace') : spaceTitle}</BreadcrumbItem>
                                            <BreadcrumbItem>{knowledgeResource}</BreadcrumbItem>
                                            <BreadcrumbItem>{knowledge.id}</BreadcrumbItem>
                                        </Breadcrumbs>
                                        {!isEdit && userIsPro && (
                                            <ShareButton
                                                genUrlFunc={async () => {
                                                    try {
                                                        const res = await CreateKnowledgeShareURL(knowledge?.space_id, window.location.origin + '/s/k/{token}', knowledge?.id);
                                                        return res.url;
                                                    } catch (e: any) {
                                                        console.error(e);
                                                    }
                                                }}
                                            />
                                        )}
                                    </ModalHeader>
                                    <ModalBody className="w-full flex flex-col items-center px-6 overflow-y-auto">
                                        {isEdit ? (
                                            <KnowledgeEdit ref={editor} hideSubmit classNames={{ editor: '!mx-0' }} knowledge={knowledge} onChange={onChangeFunc} />
                                        ) : (
                                            <KnowledgeView knowledge={knowledge} />
                                        )}
                                    </ModalBody>
                                    <ModalFooter className="flex justify-center">
                                        {isSpaceViewer ? (
                                            <Button onPress={onClose}>
                                                {t('Close')} {canEsc && <Kbd>Esc</Kbd>}
                                            </Button>
                                        ) : (
                                            <ButtonGroup variant="flat" size="base" className="mb-4">
                                                <Button isDisabled={knowledge.stage !== 3} onPress={changeEditable}>
                                                    {(() => {
                                                        if (knowledge.stage == 1) {
                                                            return t('Summarizing');
                                                        } else if (knowledge.stage == 2) {
                                                            return t('Embedding');
                                                        }

                                                        if (isEdit) {
                                                            return t('View');
                                                        } else {
                                                            return t('Edit');
                                                        }
                                                    })()}
                                                </Button>
                                                {isEdit ? (
                                                    <Button color="primary" onPress={submit}>
                                                        {t('Save')}
                                                    </Button>
                                                ) : (
                                                    <KnowledgeDeletePopover knowledge={knowledge} onDelete={onDeleteFunc}>
                                                        <Button color="danger">{t('Delete')}</Button>
                                                    </KnowledgeDeletePopover>
                                                )}

                                                <Button onPress={onClose}>
                                                    {t('Close')} {canEsc && <Kbd>Esc</Kbd>}
                                                </Button>
                                            </ButtonGroup>
                                        )}
                                    </ModalFooter>
                                </>
                            )}
                        </ModalContent>
                    ) : (
                        <ModalContent>
                            {_ => (
                                <>
                                    <ModalHeader className="flex flex-col gap-1 dark:text-gray-100 text-gray-800">
                                        <Skeleton>
                                            <Breadcrumbs>
                                                <BreadcrumbItem>Home</BreadcrumbItem>
                                                <BreadcrumbItem>Home</BreadcrumbItem>
                                                <BreadcrumbItem>Home</BreadcrumbItem>
                                                <BreadcrumbItem>Home</BreadcrumbItem>
                                            </Breadcrumbs>
                                        </Skeleton>
                                    </ModalHeader>
                                    <ModalBody className="w-full overflow-hidden flex flex-col items-center">
                                        <Skeleton className="h-3 w-3/5 rounded-lg" />
                                        <Skeleton className="h-3 w-4/5 rounded-lg" />
                                        <Spacer y={2} />
                                        <Skeleton className="h-3 w-3/5 rounded-lg" />
                                        <Skeleton className="h-3 w-4/5 rounded-lg" />
                                    </ModalBody>
                                    <ModalFooter className="flex justify-center">
                                        <Skeleton>
                                            <ButtonGroup variant="flat" size="base">
                                                <Button />
                                                <Button />
                                                <Button />
                                            </ButtonGroup>
                                        </Skeleton>
                                    </ModalFooter>
                                </>
                            )}
                        </ModalContent>
                    )}
                </Modal>
            </>
        );
    })
);

export default ViewKnowledge;
