import { BreadcrumbItem, Breadcrumbs, Button, ButtonGroup, Skeleton, Spacer } from '@heroui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import { GetKnowledge, type Knowledge } from '@/apis/knowledge';
import { CreateKnowledgeShareURL } from '@/apis/share';
import KnowledgeDeletePopover from '@/components/knowledge-delete-popover';
import KnowledgeEdit, { KnwoledgeEditorRefObject } from '@/components/knowledge-edit';
import KnowledgeView from '@/components/knowledge-view';
import ShareButton from '@/components/share-button';
import { usePlan } from '@/hooks/use-plan';
import { useRole } from '@/hooks/use-role';
import resourceStore, { loadSpaceResource } from '@/stores/resource';
import spaceStore, { setCurrentSelectedSpace } from '@/stores/space';

export interface EditKnowledgeProps {
    onChange?: () => void;
    onDelete?: (id: string) => void;
    onClose?: () => void;
}

const EditKnowledge = function (props: EditKnowledgeProps) {
    const { t } = useTranslation();
    const [knowledge, setKnowledge] = useState<Knowledge>();
    const [isEdit, setIsEdit] = useState(false);
    const { isSpaceViewer } = useRole();
    const { spaceID, knowledgeID } = useParams<{ spaceID: string; knowledgeID: string }>();
    const navigate = useNavigate();

    async function loadKnowledge(id: string) {
        try {
            const resp = await GetKnowledge(spaceID!, id, false);

            setKnowledge(resp);
        } catch (e: any) {
            console.error(e);
        }
    }

    useEffect(() => {
        if (knowledgeID) {
            loadKnowledge(knowledgeID);
        }
    }, [knowledgeID]);

    const { spaces, currentSelectedSpace } = useSnapshot(spaceStore);
    const spaceTitle = useMemo(() => {
        const target = spaces.find(v => v.space_id === spaceID);
        return target?.title;
    }, [spaces, spaceID]);

    const changeEditable = useCallback(() => {
        const newState = !isEdit;

        setIsEdit(newState);
    }, [isEdit]);

    const { currentSpaceResources } = useSnapshot(resourceStore);

    useEffect(() => {
        if (spaces.length > 0 && currentSelectedSpace !== spaceID) {
            setCurrentSelectedSpace(spaceID!);
        }
        if (!currentSpaceResources) {
            loadSpaceResource(spaceID!);
        }
    }, [spaceID, spaces, currentSpaceResources, currentSelectedSpace]);

    const knowledgeResource = useMemo(() => {
        if (!knowledge || !currentSpaceResources) {
            return '';
        }

        const resource = currentSpaceResources.find((v: any) => v.id === knowledge.resource);

        return resource ? resource.title : knowledge.resource;
    }, [knowledge, currentSpaceResources]);

    const editor = useRef<KnwoledgeEditorRefObject>();
    const submit = useCallback(async () => {
        if (editor.current) {
            try {
                await editor.current.submit();
            } catch (e: any) {
                console.error(e);
            }
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
                        navigate(`/dashboard/${spaceID}/knowledge`);
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
    }, [knowledge, knowledgeResource, spaceTitle]);

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
                                        return '';
                                    }
                                }}
                            />
                        )}
                    </div>
                    <div className="w-full overflow-hidden p-4 z-1">
                        {isEdit ? <KnowledgeEdit ref={editor} hideSubmit classNames={{ base: '', editor: '!mx-0' }} spaceID={knowledge.space_id} knowledge={knowledge} /> : <KnowledgeView knowledge={knowledge} />}
                    </div>
                    <div className="fixed w-full left-0 bottom-0 min-h-14 flex justify-center items-center z-50 box-border">
                        {isSpaceViewer ? (
                            <ButtonGroup size="md">
                                <Button onPress={onClose}>{t('Close')}</Button>
                            </ButtonGroup>
                        ) : (
                            <ButtonGroup variant="flat" size="md" className="mt-2 mb-4">
                                <Button isDisabled={knowledge.stage !== 3} onPress={changeEditable} className="bg-default">
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
                                    <Button color="primary" onPress={submit} className="bg-default">
                                        {t('Save')}
                                    </Button>
                                ) : (
                                    <KnowledgeDeletePopover backdrop="transparent" knowledge={knowledge} onDelete={onClose}>
                                        <Button color="danger" className="bg-default">{t('Delete')}</Button>
                                    </KnowledgeDeletePopover>
                                )}

                                <Button onPress={onClose} className="bg-default">{t('Close')}</Button>
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
                            <ButtonGroup variant="flat" size="md">
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
