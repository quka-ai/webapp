import { BreadcrumbItem, Breadcrumbs, Button, ButtonGroup } from '@heroui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import KnowledgeEdit, { KnwoledgeEditorRefObject } from '@/components/knowledge-edit';
import { loadSpaceResource } from '@/stores/resource';
import spaceStore from '@/stores/space';

const CreateKnowledge = () => {
    const { t } = useTranslation();
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
        const target = spaces.find(v => v.space_id === spaceID);

        return target?.title;
    }, [spaces, spaceID]);

    const editor = useRef<KnwoledgeEditorRefObject>();
    const [createLoading, setCreateLoading] = useState(false);
    const submit = useCallback(async () => {
        try {
            setCreateLoading(true);
            editor.current && (await editor.current.submit());
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
                            navigate(`/dashboard/${spaceID}/knowledge`);
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
                <KnowledgeEdit ref={editor} hideSubmit spaceID={spaceID || ''} classNames={{ base: '', editor: '!mx-0 ' }} />
            </div>
            <div className="fixed w-full left-0 bottom-0 h-14 flex justify-center items-center bg-content1 z-50">
                <ButtonGroup variant="flat" size="md" className="mb-4">
                    <Button color="primary" isLoading={createLoading} onPress={submit}>
                        {t('Save')}
                    </Button>
                    <Button onPress={() => navigate(-1)}>222{t('Close')}</Button>
                </ButtonGroup>
            </div>
        </div>
    );
};

export default CreateKnowledge;
