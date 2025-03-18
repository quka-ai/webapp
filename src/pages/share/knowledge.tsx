import { Button, User } from '@heroui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { GetSharedKnowledge, type SharedKnowledge } from '@/apis/share';
import { Editor } from '@/components/editor/index';
import ShareHeader from '@/pages/share/components/header';

export default function () {
    const { t } = useTranslation();
    const [knowledge, setKnowledge] = useState<SharedKnowledge>({});
    const { token } = useParams();

    const [isLoading, setIsLoading] = useState(true);
    const loadKnowledge = useCallback(async () => {
        setIsLoading(true);
        try {
            let data = await GetSharedKnowledge(token);
            if (data.user_avatar === '') {
                data.user_avatar = 'https://avatar.vercel.sh/' + data.user_id;
            }

            setKnowledge(data);
        } catch (e: any) {
            console.error(e);
        }
        setIsLoading(false);
    }, [token]);

    useEffect(() => {
        loadKnowledge();
    }, [token]);

    const navigator = useNavigate();

    const controlsContent = useMemo(() => {
        return (
            <>
                {knowledge && (
                    <div className="flex flex-col gap-4">
                        {knowledge.user_name && (
                            <User
                                className="my-4 justify-start"
                                avatarProps={{
                                    src: knowledge.user_avatar
                                }}
                                description={t('CreatedOn') + ' ' + new Date(knowledge.created_at * 1000).toLocaleDateString()}
                                name={knowledge.user_name}
                            />
                        )}

                        <Button
                            variant="ghost"
                            onPress={() => {
                                navigator('/');
                            }}
                        >
                            {t('Back') + ' ' + t('Home')}
                        </Button>
                    </div>
                )}
            </>
        );
    }, [knowledge]);

    const editor = useMemo(() => {
        if (!knowledge || !knowledge.content) {
            return <></>;
        }

        return <Editor readOnly data={knowledge.content} dataType={knowledge.content_type} />;
    }, [knowledge]);
    return (
        <section className="h-screen flex flex-col w-full p-4 overflow-hidden items-center bg-content2">
            <ShareHeader controlsContent={controlsContent} type="knowledge" createdUser={knowledge ? knowledge.user_id : ''}></ShareHeader>
            <main className="flex gap-6 w-full max-w-[1400px] h-full items-stretch justify-center relative">
                {/* Controls */}
                <div className="hidden w-[260px] overflow-hidden flex-col gap-4 lg:flex sticky top-0">{controlsContent}</div>
                {/* Chat */}
                <div className="relative flex flex-col h-full gap-2 w-full md:max-w-[720px] rounded-xl bg-content1 overflow-hidden">
                    <div className="flex flex-grow w-full max-w-full flex-col box-border px-1 gap-2 relative overflow-y-auto overflow-x-hidden">
                        <div className="flex sm:h-[40px] pt-10 border-b-small border-divider flex-col sm:flex-row mx-4 sm:mx-[52px] flex-wrap items-center justify-center gap-2 pb-4 sm:pb-12 sm:justify-between">
                            <p className="text-2xl font-medium">{knowledge.title}</p>
                        </div>

                        <div className="flex-1 basis-0 min-h-0 mx-4 lg:mx-0">{editor}</div>
                    </div>
                </div>
                <div className="hidden w-[260px] gap-4 xl:flex justify-end">
                    {
                        // right side
                    }
                </div>
            </main>
        </section>
    );
}
