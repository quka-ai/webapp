import { Accordion, AccordionItem, Avatar, Button, Listbox, ListboxItem, ScrollShadow, User } from '@heroui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { GetSharedSession, type SharedSessionDetail } from '@/apis/share';
import { LogoIcon } from '@/components/logo';
import MessageCard from '@/pages/dashboard/chat/message-card';
import ShareHeader from '@/pages/share/components/header';

const ShareSessionPage = function () {
    const { t } = useTranslation();
    const [session, setSession] = useState<SharedSessionDetail>();
    const { token } = useParams();

    const [isLoading, setIsLoading] = useState(true);
    const loadSession = useCallback(async () => {
        setIsLoading(true);
        try {
            let data = await GetSharedSession(token);
            setSession(data);
        } catch (e: any) {
            console.error(e);
        }
        setIsLoading(false);
    }, [token]);

    useEffect(() => {
        loadSession();
    }, [token]);

    const navigator = useNavigate();

    const controlsContent = useMemo(() => {
        return (
            <>
                {session && (
                    <div className="flex flex-col gap-4">
                        {session.user && (
                            <User
                                className="my-4 justify-start"
                                avatarProps={{
                                    src: session.user.avatar
                                }}
                                description={t('CreatedOn') + ' ' + new Date(session.session.created_at * 1000).toLocaleDateString()}
                                name={session.user.name}
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
    }, [session]);

    return (
        <>
            <section className="h-screen flex flex-col w-full p-4 overflow-hidden items-center bg-content2">
                <ShareHeader controlsContent={controlsContent} type="session" createdUser={session ? session.user.id : ''}></ShareHeader>
                <main className="flex gap-6 w-full max-w-[1400px] h-full items-stretch justify-center relative">
                    <div className="hidden w-[260px] overflow-hidden flex-col gap-4 lg:flex sticky top-0">{controlsContent}</div>
                    <div className="relative flex flex-col h-full gap-2 w-full md:max-w-[720px] rounded-xl overflow-hidden">
                        <div className="w-full m-auto max-w-[760px] overflow-hidden relative text-lg md:mt-3">{session?.session.title}</div>
                        {session ? (
                            <div className="overflow-hidden w-full h-full flex flex-col relative">
                                <main className="h-full w-full relative gap-4 py-3 flex flex-col justify-center items-center">
                                    <ScrollShadow hideScrollBar className="w-full py-6 flex-grow items-center">
                                        <div className="w-full m-auto max-w-[760px] overflow-hidden relative flex flex-col gap-6">
                                            {session.messages.map(({ key, role, message, complete }) => (
                                                <MessageCard
                                                    key={key}
                                                    avatar={role === 2 ? <LogoIcon /> : <Avatar src={session.user.avatar} />}
                                                    message={message}
                                                    messageClassName={role === 'user' ? 'bg-content2 text-content2-foreground !py-3 w-full' : 'w-full'}
                                                    // showFeedback={role === 'assistant'}
                                                    status={complete === 1 ? 'success' : 'failed'}
                                                    role={role}
                                                />
                                            ))}
                                        </div>
                                        <div className="pb-40" />
                                    </ScrollShadow>
                                </main>
                            </div>
                        ) : (
                            <>
                                <MessageCard key="aiTyping" isLoading attempts={1} currentAttempt={1} message={''} />
                            </>
                        )}
                    </div>
                </main>
            </section>
        </>
    );
};

export default ShareSessionPage;
