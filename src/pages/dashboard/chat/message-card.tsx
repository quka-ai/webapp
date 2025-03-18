import { Avatar, Badge, Button, Image, Link, Skeleton, Tooltip } from '@heroui/react';
import { cn } from '@heroui/react';
import { useClipboard } from '@heroui/use-clipboard';
import { Icon } from '@iconify/react';
import { t } from 'i18next';
import React, { ReactNode } from 'react';

import { RelDoc } from '@/apis/chat';
import Markdown from '@/components/markdown';
import { useMedia } from '@/hooks/use-media';

// import { useMedia } from '@/hooks/use-media';

export type MessageCardProps = React.HTMLAttributes<HTMLDivElement> & {
    avatar?: React.ReactNode;
    role?: string;
    showFeedback?: boolean;
    message?: string;
    attach?: Attach[];
    currentAttempt?: number;
    status?: 'success' | 'failed' | 'continue';
    attempts?: number;
    messageClassName?: string;
    isLoading?: boolean;
    onAttemptChange?: (attempt: number) => void;
    onMessageCopy?: (content: string | string[]) => void;
    onFeedback?: (feedback: 'like' | 'dislike') => void;
    onAttemptFeedback?: (feedback: 'like' | 'dislike' | 'same') => void;
    ext?: MessageExt;
    extContent?: ReactNode;
};

export interface MessageExt {
    relDocs?: RelDoc[];
}

const MessageCard = React.forwardRef<HTMLDivElement, MessageCardProps>(
    (
        {
            avatar,
            message,
            showFeedback,
            attempts = 1,
            attach,
            currentAttempt = 1,
            status,
            isLoading,
            onMessageCopy,
            onAttemptChange,
            onFeedback,
            onAttemptFeedback,
            className,
            messageClassName,
            extContent,
            ...props
        },
        ref
    ) => {
        const [feedback, setFeedback] = React.useState<'like' | 'dislike'>();
        const [attemptFeedback, setAttemptFeedback] = React.useState<'like' | 'dislike' | 'same'>();
        // const { isMobile } = useMedia();
        const messageRef = React.useRef<HTMLDivElement>(null);

        const { copied, copy } = useClipboard();

        const failedMessageClassName = status === 'failed' ? 'bg-danger-100/50 border border-danger-100 text-foreground' : '';
        const failedMessage = (
            <p className="px-4">
                {/* Something went wrong, if the issue persists please contact us through our help center at&nbsp;
                <Link href="mailto:support@brew.re" size="sm">
                    support@brew.re
                </Link> */}
                {t('SystemError')}
            </p>
        );

        const hasFailed = status === 'failed';
        // const typing = status === 'continue';

        const handleCopy = React.useCallback(() => {
            let stringValue = '';

            if (typeof message === 'string') {
                stringValue = message;
            }

            const valueToCopy = stringValue || messageRef.current?.textContent || '';

            copy(valueToCopy);

            onMessageCopy?.(valueToCopy);
        }, [copy, message, onMessageCopy]);

        const handleFeedback = React.useCallback(
            (liked: boolean) => {
                setFeedback(liked ? 'like' : 'dislike');

                onFeedback?.(liked ? 'like' : 'dislike');
            },
            [onFeedback]
        );

        const handleAttemptFeedback = React.useCallback(
            (feedback: 'like' | 'dislike' | 'same') => {
                setAttemptFeedback(feedback);

                onAttemptFeedback?.(feedback);
            },
            [onAttemptFeedback]
        );

        const { isMobile } = useMedia();

        return (
            <div {...props} ref={ref} className={cn('flex flex-col md:flex-row md:gap-2', className)}>
                <div className="relative flex-none md:py-1">
                    <Badge
                        isOneChar
                        color="danger"
                        content={<Icon className="text-background" icon="gravity-ui:circle-exclamation-fill" />}
                        isInvisible={!hasFailed}
                        placement="bottom-right"
                        shape="circle"
                    >
                        {avatar ? (
                            <Avatar icon={avatar} size={isMobile ? 'sm' : 'base'} />
                        ) : (
                            <Skeleton className="rounded-full">
                                <Avatar />
                            </Skeleton>
                        )}
                    </Badge>
                </div>
                <div className="max-w-full flex flex-1 overflow-hidden flex-col items-start gap-4 relative">
                    <div className={cn('relative rounded-medium md:py-3 text-default-600', failedMessageClassName, messageClassName)}>
                        {!hasFailed && !message ? (
                            <>
                                <div className="flex flex-col gap-3 mt-[-3px]">
                                    <Skeleton className="h-6 w-3/5 rounded-lg" />
                                    <Skeleton className="h-6 w-5/6 rounded-lg" />
                                    <Skeleton className="h-6 w-5/6 rounded-lg" />
                                </div>
                            </>
                        ) : (
                            <div ref={messageRef} className={'text-small gap-1'}>
                                {hasFailed ? (
                                    failedMessage
                                ) : (
                                    <>
                                        <Markdown className="text-wrap break-words text-gray-600 dark:text-gray-300 leading-loose">{message}</Markdown>
                                        {attach && attach.length > 0 && (
                                            <div className="flex flex-wrap gap-3 m-2 mb-0">
                                                {attach.map((v, index) => {
                                                    return <Image key={index} className="w-40 h-50 rounded-small border-small border-default-200/50 object-cover" src={v.url} />;
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                        {showFeedback && !hasFailed && (
                            <div className="absolute right-2 top-2 flex rounded-full bg-content2 shadow-small">
                                <Button isIconOnly radius="full" size="sm" variant="light" onPress={handleCopy}>
                                    {copied ? <Icon className="text-lg text-default-600" icon="gravity-ui:check" /> : <Icon className="text-lg text-default-600" icon="gravity-ui:copy" />}
                                </Button>
                                <Button isIconOnly radius="full" size="sm" variant="light" onPress={() => handleFeedback(true)}>
                                    {feedback === 'like' ? (
                                        <Icon className="text-lg text-default-600" icon="gravity-ui:thumbs-up-fill" />
                                    ) : (
                                        <Icon className="text-lg text-default-600" icon="gravity-ui:thumbs-up" />
                                    )}
                                </Button>
                                <Button isIconOnly radius="full" size="sm" variant="light" onPress={() => handleFeedback(false)}>
                                    {feedback === 'dislike' ? (
                                        <Icon className="text-lg text-default-600" icon="gravity-ui:thumbs-down-fill" />
                                    ) : (
                                        <Icon className="text-lg text-default-600" icon="gravity-ui:thumbs-down" />
                                    )}
                                </Button>
                            </div>
                        )}
                        {attempts > 1 && !hasFailed && (
                            <div className="flex w-full items-center justify-end">
                                <button onClick={() => onAttemptChange?.(currentAttempt > 1 ? currentAttempt - 1 : 1)}>
                                    <Icon className="cursor-pointer text-default-400 hover:text-default-500" icon="gravity-ui:circle-arrow-left" />
                                </button>
                                <button onClick={() => onAttemptChange?.(currentAttempt < attempts ? currentAttempt + 1 : attempts)}>
                                    <Icon className="cursor-pointer text-default-400 hover:text-default-500" icon="gravity-ui:circle-arrow-right" />
                                </button>
                                <p className="px-1 text-tiny font-medium text-default-500">
                                    {currentAttempt}/{attempts}
                                </p>
                            </div>
                        )}
                    </div>
                    {showFeedback && attempts > 1 && (
                        <div className="flex items-center justify-between rounded-medium border-small border-default-100 px-4 py-3 shadow-small">
                            <p className="text-small text-default-600">Was this response better or worse?</p>
                            <div className="flex gap-1">
                                <Tooltip content="Better">
                                    <Button isIconOnly radius="full" size="sm" variant="light" onPress={() => handleAttemptFeedback('like')}>
                                        {attemptFeedback === 'like' ? (
                                            <Icon className="text-lg text-primary" icon="gravity-ui:thumbs-up-fill" />
                                        ) : (
                                            <Icon className="text-lg text-default-600" icon="gravity-ui:thumbs-up" />
                                        )}
                                    </Button>
                                </Tooltip>
                                <Tooltip content="Worse">
                                    <Button isIconOnly radius="full" size="sm" variant="light" onPress={() => handleAttemptFeedback('dislike')}>
                                        {attemptFeedback === 'dislike' ? (
                                            <Icon className="text-lg text-default-600" icon="gravity-ui:thumbs-down-fill" />
                                        ) : (
                                            <Icon className="text-lg text-default-600" icon="gravity-ui:thumbs-down" />
                                        )}
                                    </Button>
                                </Tooltip>
                                <Tooltip content="Same">
                                    <Button isIconOnly radius="full" size="sm" variant="light" onPress={() => handleAttemptFeedback('same')}>
                                        {attemptFeedback === 'same' ? (
                                            <Icon className="text-lg text-danger" icon="gravity-ui:face-sad" />
                                        ) : (
                                            <Icon className="text-lg text-default-600" icon="gravity-ui:face-sad" />
                                        )}
                                    </Button>
                                </Tooltip>
                            </div>
                        </div>
                    )}
                    {extContent}
                </div>
            </div>
        );
    }
);

export default MessageCard;

MessageCard.displayName = 'MessageCard';
