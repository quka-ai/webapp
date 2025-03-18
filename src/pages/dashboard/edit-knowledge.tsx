import { Icon } from '@iconify/react';
import { BreadcrumbItem, Breadcrumbs, Button, ButtonGroup, Kbd, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Skeleton, Spacer, useDisclosure } from "@heroui/react";
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
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
import spaceStore, { loadUserSpaces, setCurrentSelectedSpace } from '@/stores/space';

export interface EditKnowledgeProps {
    onChange?: () => void;
    onDelete?: (id: string) => void;
    onClose?: () => void;
}

const EditKnowledge = function (props: EditKnowledgeProps) {
    const { t } = useTranslation();
    const [knowledge, setKnowledge] = useState<Knowledge>();
    const [isEdit, setIsEdit] = useState(false);
    const { isMobile } = useMedia();
    const [canEsc, setCanEsc] = useState(true);
    const { isSpaceViewer } = useRole();
    const { spaceID, knowledgeID } = useParams();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    async function loadKnowledge(id: string) {
        setIsLoading(true);
        try {
            const resp = await GetKnowledge(spaceID, id);

            setKnowledge(resp);
        } catch (e: any) {
            console.error(e);
        }
        setIsLoading(false);
    }

    useEffect(() => {
        loadKnowledge(knowledgeID);
    }, [knowledgeID]);

    const { spaces, currentSelectedSpace } = useSnapshot(spaceStore);
    const spaceTitle = useMemo(() => {
        if (!spaceID) {
            return '';
        }

        const target = spaces.find(v => v.space_id === spaceID);
        return target?.title;
    }, [spaces, spaceID]);

    const changeEditable = useCallback(() => {
        const newState = !isEdit;

        setIsEdit(newState);
        setCanEsc(!newState);
    }, [isEdit]);

    const { currentSpaceResources } = useSnapshot(resourceStore);
    const reloadSpaceResource = useCallback(async (spaceID: string) => {
        try {
            await loadSpaceResource(spaceID);
        } catch (e: any) {
            console.error(e);
        }
    }, []);

    useEffect(() => {
        if (spaces.length > 0 && currentSelectedSpace !== spaceID) {
            setCurrentSelectedSpace(spaceID);
        }
        if (!currentSpaceResources) {
            loadSpaceResource(spaceID);
        }
    }, [spaceID, spaces, currentSpaceResources, currentSelectedSpace]);

    const knowledgeResource = useMemo(() => {
        if (!knowledge || !currentSpaceResources) {
            return '';
        }

        const resource = currentSpaceResources.find((v: Resource) => v.id === knowledge.resource);

        return resource ? resource.title : knowledge.resource;
    }, [knowledge, currentSpaceResources]);

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
    }, [editor]);

    const { userIsPro } = usePlan();

    const onClose = useCallback(() => {
        navigate(-1);
    }, []);

    const breadcrumbs = useMemo(() => {
        if (!knowledge || !knowledgeResource) {
            return '';
        }
        return (
            <Breadcrumbs size="lg" className="break-all text-wrap max-w-[66%] overflow-hidden text-ellipsis">
                <BreadcrumbItem
                    onPress={() => {
                        navigate('/');
                    }}
                >
                    {t('Home')}
                </BreadcrumbItem>
                <BreadcrumbItem
                    onPress={() => {
                        navigate(`/dashboard/${spaceID}/knowledge`);
                    }}
                >
                    {spaceTitle}
                </BreadcrumbItem>
                <BreadcrumbItem>{knowledgeResource}</BreadcrumbItem>
                <BreadcrumbItem>{knowledge.id}</BreadcrumbItem>
            </Breadcrumbs>
        );
    }, [knowledge, knowledgeResource]);

    return (
        <div className="bg-content1 w-full min-h-screen">
            {knowledge && knowledge.id ? (
                <>
                    <div className="flex justify-between items-center w-full min-h-10 p-2 overflow-hidden gap-4">
                        {breadcrumbs}
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
                    </div>
                    <div className="w-full overflow-hidden p-4">
                        {isEdit ? <KnowledgeEdit ref={editor} hideSubmit classNames={{ editor: '!mx-0' }} knowledge={knowledge} /> : <KnowledgeView knowledge={knowledge} />}
                    </div>
                    <div className="fixed w-full left-0 bottom-0 min-h-14 flex justify-center items-center bg-content1 z-50 box-border">
                        {isSpaceViewer ? (
                            <ButtonGroup>
                                <Button onPress={onClose}>{t('Close')}</Button>
                            </ButtonGroup>
                        ) : (
                            <ButtonGroup variant="flat" size="base" className=" mt-2 mb-4">
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
                                    <KnowledgeDeletePopover backdrop="transparent" knowledge={knowledge} onDelete={onClose}>
                                        <Button color="danger">{t('Delete')}</Button>
                                    </KnowledgeDeletePopover>
                                )}

                                <Button onPress={onClose}>{t('Close')}</Button>
                            </ButtonGroup>
                        )}
                    </div>
                </>
            ) : (
                <>
                    <div className="flex justify-between items-center w-full min-h-10 p-2 overflow-hidden gap-4">
                        <Skeleton className="rounded-lg">
                            <Breadcrumbs>
                                <BreadcrumbItem>Home</BreadcrumbItem>
                                <BreadcrumbItem>Home</BreadcrumbItem>
                                <BreadcrumbItem>Home</BreadcrumbItem>
                                <BreadcrumbItem>Home</BreadcrumbItem>
                            </Breadcrumbs>
                        </Skeleton>
                    </div>
                    <div className="flex flex-col gap-4 w-full overflow-hidden p-4">
                        <Skeleton className="h-5 w-3/5 rounded-lg" />
                        <Skeleton className="h-5 w-4/5 rounded-lg" />
                        <Spacer y={2} />
                        <Skeleton className="h-5 w-3/5 rounded-lg" />
                        <Skeleton className="h-5 w-4/5 rounded-lg" />
                    </div>
                    <div className="fixed w-full left-0 bottom-0 h-14 flex justify-center items-center bg-content1">
                        <Skeleton className="rounded-lg">
                            <ButtonGroup variant="flat" size="base">
                                <Button />
                                <Button />
                                <Button />
                            </ButtonGroup>
                        </Skeleton>
                    </div>
                </>
            )}
        </div>
    );
};

export default EditKnowledge;
