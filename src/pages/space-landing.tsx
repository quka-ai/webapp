// !!! TODO !!!
import { Button, Chip, Link, Skeleton, User } from '@heroui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { GetSpaceLandingDetail, SpaceLandingDetail } from '@/apis/space';
import { LogoIcon, Name } from '@/components/logo';
import SpaceApplicationForm from '@/components/space/space-application-form';
import { SPACE_APPLICATION_STATUS } from '@/components/space/space-application-list';
import { Icon } from '@iconify/react';

export default function SpaceLnadingPage() {
    const { t } = useTranslation();
    const { token } = useParams();

    // const [isLoading, setIsLoading] = useState(true);
    // const loadKnowledge = useCallback(async () => {
    //     if (!token) {
    //         return;
    //     }
    //     setIsLoading(true);
    //     try {
    //         let data = await GetSharedKnowledge(token);
    //         if (data.user_avatar === '') {
    //             data.user_avatar = 'https://avatar.vercel.sh/' + data.user_id;
    //         }

    //         setKnowledge(data);
    //     } catch (e: any) {
    //         console.error(e);
    //     }
    //     setIsLoading(false);
    // }, [token]);

    // useEffect(() => {
    //     loadKnowledge();
    // }, [token]);

    const [detail, setDetail] = useState<SpaceLandingDetail>();
    const [isLoading, setIsLoading] = useState(false);
    const getLandingDetail = useCallback(async (token: string) => {
        if (!token) {
            return;
        }
        setIsLoading(true);
        try {
            let data = await GetSpaceLandingDetail(token);
            setDetail(data);
        } catch (e: any) {
            console.error(e);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        getLandingDetail(token);
    }, [token]);

    const navigator = useNavigate();

    const applicationBlock = useMemo(() => {
        switch (detail?.application_status) {
            case SPACE_APPLICATION_STATUS.None || '':
                return (
                    <div className="border-box w-full bg-content1 rounded-xl border-1 border-zinc-800 p-6">
                        <div className="flex flex-col gap-4 items-start">
                            <h1 className="text-xl font-semibold">{t('space.Application')}</h1>
                            <SpaceApplicationForm
                                spaceToken={token}
                                onSubmit={() => {
                                    getLandingDetail(token);
                                }}
                            />
                        </div>
                    </div>
                );
                break;
            case SPACE_APPLICATION_STATUS.Refused:
                return (
                    <div className="border-box w-full bg-content1 rounded-xl border-1 border-zinc-800 p-6">
                        <div className="flex flex-col gap-4 items-start">
                            <h1 className="text-xl font-semibold">{t('space.Application')}</h1>
                            <Chip color="warning" variant="dot">
                                {t('space.ApplicationRefused')}
                            </Chip>
                            <SpaceApplicationForm
                                spaceToken={token}
                                onSubmit={() => {
                                    getLandingDetail(token);
                                }}
                            />
                        </div>
                    </div>
                );
                break;
            case SPACE_APPLICATION_STATUS.Waiting:
                return (
                    <div className="border-box w-full bg-content1 rounded-xl border-1 border-zinc-800 p-6">
                        <div className="flex flex-col gap-4 items-start">
                            <h1 className="text-xl font-semibold">{t('space.ApplicationStatus')}</h1>
                            <Chip color="warning" variant="dot">
                                {t('space.WaitingReview')}
                            </Chip>
                        </div>
                    </div>
                );
                break;
            case SPACE_APPLICATION_STATUS.Approved:
                return (
                    <div className="border-box w-full bg-content1 rounded-xl border-1 border-zinc-800 p-6">
                        <Button
                            color="primary"
                            onPress={() => {
                                navigator(`/dashboard/${detail.space_id}/chat`);
                            }}
                        >
                            {t('space.EnterSpace')}
                        </Button>
                    </div>
                );
                break;
            default:
                return (
                    <div className="border-box w-full flex flex-col gap-4 bg-content1 rounded-xl border-1 border-zinc-800 p-6">
                        <Skeleton className="w-3/5 rounded-lg">
                            <div className="h-6 w-3/5 rounded-lg bg-default-200" />
                        </Skeleton>
                        <Skeleton className="rounded-lg">
                            <div className="h-24 rounded-lg bg-default-300" />
                        </Skeleton>
                        <div className="flex flex-col gap-4">
                            <Skeleton className="w-4/5 rounded-lg">
                                <div className="h-6 w-4/5 rounded-lg bg-default-200" />
                            </Skeleton>
                            <Skeleton className="w-2/5 rounded-lg">
                                <div className="h-6 w-2/5 rounded-lg bg-default-300" />
                            </Skeleton>
                        </div>
                    </div>
                );
        }
    }, [detail, token]);

    return (
        <section className="h-screen flex flex-col w-full p-4 overflow-hidden items-center">
            <header className="flex w-full items-center gap-2 sm:gap-4 pb-4 flex-row justify-between">
                <div className="flex items-center gap-6">
                    <Link target="_parent" href="/">
                        <LogoIcon size={32} />
                        <h1 className="ml-2 font-medium text-lg dark:text-white text-black">{Name}</h1>
                    </Link>
                    <Button
                        size="sm"
                        variant="ghost"
                        startContent={<Icon icon="material-symbols:arrow-back-ios-rounded" />}
                        onPress={() => {
                            navigator('/');
                        }}
                    >
                        {t('Back')}
                    </Button>
                </div>
            </header>
            <main className="flex flex-col gap-4 w-full max-w-2xl justify-center relative">
                <div className="flex flex-col gap-4 items-start p-2">
                    {detail ? (
                        <h1 className="text-2xl font-semibold">{detail?.title}</h1>
                    ) : (
                        <Skeleton className="w-3/5 rounded-lg">
                            <div className="h-6 w-3/5 rounded-lg bg-default-300" />
                        </Skeleton>
                    )}
                </div>
                <div className="border-box w-full bg-content1 rounded-xl border-1 border-zinc-800 p-6 flex flex-col gap-6">
                    {/* <div className="flex flex-col gap-4 items-start">
                        <h1 className="text-2xl font-semibold">{t('SpaceName')}</h1>
                    </div> */}
                    <div className="flex flex-col gap-4 items-start">
                        <h1 className="text-xl font-semibold">{t('space.AboutTheCreator')}</h1>
                        {detail ? (
                            <User
                                avatarProps={{ radius: 'full', size: 'md', src: detail?.user.avatar }}
                                classNames={{
                                    description: 'text-default-500'
                                }}
                                description=""
                                name={detail?.user.name}
                            />
                        ) : (
                            <div className="max-w-[300px] w-full flex items-center gap-3">
                                <div>
                                    <Skeleton className="flex rounded-full w-12 h-12" />
                                </div>
                                <div className="w-full flex flex-col gap-2">
                                    <Skeleton className="h-3 w-3/5 rounded-lg" />
                                    <Skeleton className="h-3 w-4/5 rounded-lg" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="border-box w-full bg-content1 rounded-xl border-1 border-zinc-800 p-6">
                    <div className="flex flex-col gap-4 items-start">
                        <h1 className="text-xl font-semibold">{t('space.AboutTheSpace')}</h1>
                        {detail ? (
                            <p dangerouslySetInnerHTML={{__html: detail?.desc.replaceAll('\n', '<br/>')}}></p>
                        ) : (
                            <div className="w-full flex flex-col gap-2">
                                <Skeleton className="h-3 w-3/5 rounded-lg" />
                                <Skeleton className="h-3 w-1/3 rounded-lg" />
                                <Skeleton className="h-3 w-4/5 rounded-lg" />
                                <Skeleton className="h-3 w-3/5 rounded-lg" />
                            </div>
                        )}
                    </div>
                </div>

                {applicationBlock}

                <div className="text-sm text-zinc-500 px-2">
                    <p>{t('space.LandingFooter')}</p>
                </div>
            </main>
        </section>
    );
}
