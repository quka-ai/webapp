import { Card, CardBody, Chip, Link, Skeleton, User } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { GetSharedPodcast, SharedPodcast } from '@/apis/share';
import { LogoIcon, Name } from '@/components/logo';

export default function PodcastSharePage() {
    const { t } = useTranslation();
    const { t: tPodcast } = useTranslation('podcast');
    const { token } = useParams();
    const navigate = useNavigate();

    const [podcast, setPodcast] = useState<SharedPodcast | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadSharedPodcast = useCallback(async () => {
        if (!token) {
            setError('Invalid share link');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const data = await GetSharedPodcast(token);
            // Set default avatar if not provided
            if (data && (!data.user_avatar || data.user_avatar === '')) {
                data.user_avatar = 'https://avatar.vercel.sh/' + data.user_id;
            }
            setPodcast(data);
        } catch (e: any) {
            console.error('Failed to load shared podcast:', e);
            setError(e.message || 'Failed to load podcast');
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadSharedPodcast();
    }, [loadSharedPodcast]);

    // Format duration (seconds to MM:SS)
    const formatDuration = (seconds?: number) => {
        if (!seconds) return '--';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Format file size
    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '--';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    // Get status color
    const getStatusColor = (status: string): 'default' | 'warning' | 'primary' | 'success' | 'danger' => {
        const colors: Record<string, 'default' | 'warning' | 'primary' | 'success' | 'danger'> = {
            pending: 'warning',
            processing: 'primary',
            completed: 'success',
            failed: 'danger'
        };
        return colors[status] || 'default';
    };

    // Get status text
    const getStatusText = (status: string) => {
        const texts: Record<string, string> = {
            pending: tPodcast('Pending'),
            processing: tPodcast('Processing'),
            completed: tPodcast('Completed'),
            failed: tPodcast('Failed')
        };
        return texts[status] || status;
    };

    // Get source type text
    const getSourceTypeText = (sourceType: string) => {
        const texts: Record<string, string> = {
            knowledge: tPodcast('Knowledge'),
            journal: tPodcast('Journal'),
            rss_digest: 'RSS摘要'
        };
        return texts[sourceType] || sourceType;
    };

    if (!token) {
        return (
            <section className="h-screen flex flex-col w-full p-4 overflow-hidden items-center justify-center">
                <div className="text-center">
                    <Icon icon="mdi:alert-circle" width={64} className="text-danger mx-auto mb-4" />
                    <p className="text-lg text-danger">Invalid share link</p>
                </div>
            </section>
        );
    }

    return (
        <section className="min-h-screen flex flex-col w-full items-center">
            <header className="flex w-full items-center gap-2 sm:gap-4 px-4 py-4 flex-row justify-between sticky top-0 z-10 bg-background border-b border-divider">
                <div className="flex items-center gap-6">
                    <Link target="_parent" href="/">
                        <LogoIcon size={32} />
                        <h1 className="ml-2 font-medium text-lg dark:text-white text-black">{Name}</h1>
                    </Link>
                </div>
            </header>

            <main className="flex flex-col gap-4 w-full max-w-3xl justify-center pb-8 pt-4 px-4">
                {error ? (
                    <Card className="border-2 border-danger">
                        <CardBody className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <Icon icon="mdi:alert-circle" width={64} className="text-danger mx-auto mb-4" />
                                <p className="text-lg font-medium text-danger">{error}</p>
                            </div>
                        </CardBody>
                    </Card>
                ) : isLoading ? (
                    <>
                        <Skeleton className="w-3/5 rounded-lg">
                            <div className="h-8 w-3/5 rounded-lg bg-default-300" />
                        </Skeleton>
                        <Card>
                            <CardBody className="p-6">
                                <Skeleton className="w-full h-12 rounded-lg mb-4" />
                                <div className="flex gap-4">
                                    <Skeleton className="w-24 h-6 rounded-lg" />
                                    <Skeleton className="w-24 h-6 rounded-lg" />
                                    <Skeleton className="w-24 h-6 rounded-lg" />
                                </div>
                            </CardBody>
                        </Card>
                        <Card>
                            <CardBody className="p-6">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="flex rounded-full w-12 h-12" />
                                    <div className="flex flex-col gap-2 flex-1">
                                        <Skeleton className="h-3 w-2/5 rounded-lg" />
                                        <Skeleton className="h-3 w-3/5 rounded-lg" />
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                        <Card>
                            <CardBody className="p-6">
                                <Skeleton className="h-3 w-full rounded-lg mb-2" />
                                <Skeleton className="h-3 w-4/5 rounded-lg mb-2" />
                                <Skeleton className="h-3 w-3/5 rounded-lg" />
                            </CardBody>
                        </Card>
                    </>
                ) : podcast ? (
                    <>
                        {/* Title */}
                        <div className="flex flex-col gap-2 p-2">
                            <h1 className="text-3xl font-bold leading-9">{podcast.podcast.title}</h1>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Chip size="sm" variant="flat" color={getStatusColor(podcast.podcast.status)}>
                                    {getStatusText(podcast.podcast.status)}
                                </Chip>
                                <Chip size="sm" variant="flat" color="default">
                                    {getSourceTypeText(podcast.podcast.source_type)}
                                </Chip>
                            </div>
                        </div>

                        {/* Audio Player */}
                        {podcast.podcast.status === 'completed' && podcast.podcast.audio_url ? (
                            <Card className="overflow-visible">
                                <CardBody className="p-6 overflow-visible">
                                    <audio controls className="w-full" src={podcast.podcast.audio_url}>
                                        {tPodcast('AudioNotSupported')}
                                    </audio>
                                    <div className="flex items-center justify-between mt-4 text-sm text-default-500 flex-wrap gap-2">
                                        <span>
                                            {tPodcast('Duration')}: {formatDuration(podcast.podcast.audio_duration)}
                                        </span>
                                        <span>
                                            {tPodcast('FileSize')}: {formatFileSize(podcast.podcast.audio_size)}
                                        </span>
                                        <span>
                                            {tPodcast('Format')}: {podcast.podcast.audio_format?.toUpperCase()}
                                        </span>
                                    </div>
                                </CardBody>
                            </Card>
                        ) : podcast.podcast.status === 'processing' ? (
                            <Card className="border-2 border-primary">
                                <CardBody className="flex items-center justify-center py-12">
                                    <div className="text-center">
                                        <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                                        <p className="text-lg font-medium">{tPodcast('Generating')}</p>
                                        <p className="text-sm text-default-500 mt-2">{tPodcast('GenerateTimeTip')}</p>
                                    </div>
                                </CardBody>
                            </Card>
                        ) : podcast.podcast.status === 'failed' ? (
                            <Card className="border-2 border-danger">
                                <CardBody className="flex items-center justify-center py-12">
                                    <div className="text-center">
                                        <Icon icon="mdi:alert-circle" width={64} className="text-danger mx-auto mb-4" />
                                        <p className="text-lg font-medium text-danger">{tPodcast('GenerationFailed')}</p>
                                        {podcast.podcast.error_message && <p className="text-sm text-default-500 mt-2">{podcast.podcast.error_message}</p>}
                                    </div>
                                </CardBody>
                            </Card>
                        ) : (
                            <Card>
                                <CardBody className="flex items-center justify-center py-12">
                                    <div className="text-center">
                                        <Icon icon="mdi:clock-outline" width={64} className="text-default-400 mx-auto mb-4" />
                                        <p className="text-lg font-medium">{tPodcast('Waiting')}</p>
                                    </div>
                                </CardBody>
                            </Card>
                        )}

                        {/* Shared by User */}
                        <Card className="overflow-visible">
                            <CardBody className="p-6 overflow-visible">
                                <h2 className="text-lg font-semibold mb-3">{t('SharedBy')}</h2>
                                <User
                                    avatarProps={{ radius: 'full', size: 'md', src: podcast.user_avatar }}
                                    classNames={{
                                        base: 'justify-start',
                                        description: 'text-default-500'
                                    }}
                                    name={podcast.user_name}
                                />
                            </CardBody>
                        </Card>

                        {/* Description */}
                        {podcast.podcast.description && (
                            <Card className="overflow-visible">
                                <CardBody className="p-6 overflow-visible">
                                    <h2 className="text-lg font-semibold mb-3">{tPodcast('Description')}</h2>
                                    <p className="text-default-600 whitespace-pre-wrap">{podcast.podcast.description}</p>
                                </CardBody>
                            </Card>
                        )}

                        {/* Tags */}
                        {podcast.podcast.tags && podcast.podcast.tags.length > 0 && (
                            <Card className="overflow-visible">
                                <CardBody className="p-6 overflow-visible">
                                    <h2 className="text-lg font-semibold mb-3">{tPodcast('Tags')}</h2>
                                    <div className="flex flex-wrap gap-2">
                                        {podcast.podcast.tags.map((tag, index) => (
                                            <Chip key={index} variant="flat">
                                                {tag}
                                            </Chip>
                                        ))}
                                    </div>
                                </CardBody>
                            </Card>
                        )}

                        {/* Metadata */}
                        <Card className="overflow-visible">
                            <CardBody className="p-6 overflow-visible">
                                <h2 className="text-lg font-semibold mb-3">{tPodcast('Details')}</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-default-500">{tPodcast('CreatedAt')}:</span>
                                        <span className="ml-2">{new Date(podcast.podcast.created_at * 1000).toLocaleString()}</span>
                                    </div>
                                    {podcast.podcast.generated_at && (
                                        <div>
                                            <span className="text-default-500">{tPodcast('GeneratedAt')}:</span>
                                            <span className="ml-2">{new Date(podcast.podcast.generated_at * 1000).toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            </CardBody>
                        </Card>

                        {/* Footer */}
                        <div className="text-sm text-default-500 px-2 text-center">
                            <p>{t('PodcastSharedFooter')}</p>
                        </div>
                    </>
                ) : (
                    <Card>
                        <CardBody className="flex items-center justify-center py-20">
                            <p className="text-default-500">{tPodcast('NotFound')}</p>
                        </CardBody>
                    </Card>
                )}
            </main>
        </section>
    );
}
