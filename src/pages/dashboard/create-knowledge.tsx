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
        <section className="h-screen flex flex-col w-full p-4 overflow-hidden items-center bg-content2">
            <header className="flex w-full min-h-10 items-center overflow-hidden pb-4">
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
            </header>
            <main className="flex gap-6 w-full max-w-[1400px] h-full items-stretch justify-center relative">
                <div className="relative flex flex-col h-full gap-2 pt-4 sm:pt-10 w-full md:max-w-[720px] rounded-xl bg-content1 overflow-hidden">
                    <div className="flex grow w-full max-w-full flex-col box-border px-1 gap-2 relative overflow-hidden">
                        <div className="flex-1 basis-0 min-h-0 overflow-y-auto overflow-x-hidden mx-4 pb-20">
                            <KnowledgeEdit
                                ref={editor}
                                hideSubmit
                                knowledge={{
                                    space_id: spaceID || ''
                                }}
                            />
                        </div>
                    </div>
                </div>
            </main>
            <div className="fixed w-full left-0 bottom-0 min-h-14 flex justify-center items-center z-50 box-border">
                <ButtonGroup variant="flat" size="md" className="mb-4">
                    <Button color="primary" isLoading={createLoading} className="bg-default" onPress={submit}>
                        {t('Save')}
                    </Button>
                    <Button className="bg-default" onPress={() => navigate(-1)}>
                        {t('Close')}
                    </Button>
                </ButtonGroup>
            </div>
        </section>
    );
};

export default CreateKnowledge;
