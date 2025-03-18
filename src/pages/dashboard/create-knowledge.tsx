import { BreadcrumbItem, Breadcrumbs, Button, ButtonGroup, ModalHeader } from '@heroui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import KnowledgeEdit from '@/components/knowledge-edit';
import { loadSpaceResource } from '@/stores/resource';
import spaceStore from '@/stores/space';

const CreateKnowledge = () => {
    const { t } = useTranslation();
    const [knowledge, setKnowledge] = useState<Knowledge>();
    const [size, setSize] = useState<Size>('md');
    const navigate = useNavigate();
    const { spaceID } = useParams();

    useEffect(() => {
        if (!spaceID) {
            return;
        }
        loadSpaceResource(spaceID);
    }, [spaceID]);

    const { spaces } = useSnapshot(spaceStore);
    const spaceTitle = useMemo(() => {
        for (const item of spaces) {
            if (item.space_id === spaceID) {
                return item.title;
            }
        }

        return '';
    }, [spaces, spaceID]);

    const onCancelFunc = useCallback(function () {
        navigate(-1);
    }, []);

    const editor = useRef();
    const [createLoading, setCreateLoading] = useState(false);
    const submit = useCallback(async () => {
        try {
            setCreateLoading(true);
            await editor.current.submit();
        } catch (e: any) {
            console.error(e);
        }
        setCreateLoading(false);
    }, [editor]);

    return (
        <div className="w-full min-h-screen bg-content1">
            <div className="flex w-full h-10 items-center p-2">
                <Breadcrumbs>
                    <BreadcrumbItem
                        onPress={() => {
                            navigate('/');
                        }}
                    >
                        {t('Home')}
                    </BreadcrumbItem>
                    <BreadcrumbItem
                        onPress={() => {
                            navigate(-1);
                        }}
                    >
                        {spaceTitle}
                    </BreadcrumbItem>
                    <BreadcrumbItem>{t('Create')}</BreadcrumbItem>
                </Breadcrumbs>
            </div>
            <div className="w-full overflow-hidden p-4">
                <KnowledgeEdit ref={editor} knowledge={{ space_id: spaceID }} classNames={{ editor: '!mx-0 ' }} hideSubmit />
            </div>
            <div className="fixed w-full left-0 bottom-0 h-14 flex justify-center items-center bg-content1 z-50">
                <ButtonGroup variant="flat" size="base" className="mb-4">
                    <Button color="primary" onPress={submit} isLoading={createLoading}>
                        {t('Save')}
                    </Button>
                    <Button onPress={() => navigate(-1)}>{t('Close')}</Button>
                </ButtonGroup>
            </div>
        </div>
    );
};

export default CreateKnowledge;
