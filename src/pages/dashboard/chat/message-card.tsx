import { Avatar, Badge, Button, Chip, Image, Skeleton, Tooltip } from '@heroui/react';
import { cn } from '@heroui/react';
import { useClipboard } from '@heroui/use-clipboard';
import { Icon } from '@iconify/react';
import { t } from 'i18next';
import React, { ReactNode, useMemo } from 'react';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';

import { RelDoc } from '@/apis/chat';
import Markdown from '@/components/markdown';
import ToolUsing from '@/components/tool-using';
import { AgentRun, ToolStatus, ToolTips } from '@/types/chat';

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
    toolTips?: ToolTips[];
};

export interface MessageExt {
    relDocs?: RelDoc[];
    toolName?: string;
    toolArgs?: string;
    agentRun?: AgentRun;
}

const MessageCard = React.forwardRef<HTMLDivElement, MessageCardProps>(
    (
        {
            avatar,
            message,
            role,
            showFeedback,
            attempts = 1,
            attach,
            currentAttempt = 1,
            status,
            isLoading: _isLoading,
            onMessageCopy,
            onAttemptChange,
            onFeedback,
            onAttemptFeedback,
            className,
            messageClassName,
            ext,
            extContent,
            toolTips,
            ...props
        },
        ref
    ) => {
        const [feedback, setFeedback] = React.useState<'like' | 'dislike'>();
        const [attemptFeedback, setAttemptFeedback] = React.useState<'like' | 'dislike' | 'same'>();
        // const { isMobile } = useMedia();
        const messageRef = React.useRef<HTMLDivElement>(null);

        const { copied, copy } = useClipboard();

        const failedMessageClassName = status === 'failed' && role !== 'tool' && role !== 'agent' ? 'bg-danger-100/50 border border-danger-100 text-foreground' : '';
        const failedMessageText = typeof message === 'string' && message.trim() ? message : t('SystemError');

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

        const toolTipsDom = useMemo(() => {
            if (!toolTips && !ext?.toolName) {
                return <></>;
            }

            if (!toolTips && ext?.toolName) {
                toolTips = [
                    {
                        id: '',
                        tool_name: ext.toolName,
                        status: status == 'failed' ? ToolStatus.TOOL_STATUS_FAILED : status == 'success' ? ToolStatus.TOOL_STATUS_SUCCESS : ToolStatus.TOOL_STATUS_RUNNING,
                        content: ''
                    }
                ];
            }

            return <ToolUsing toolTips={toolTips} />;
        }, [toolTips, ext, status]);

        return (
            <div {...props} ref={ref} className={cn('flex flex-col md:flex-row md:gap-2', className)}>
                <div className="relative flex-none md:py-1">
                    {role === 'tool' || role === 'agent' ? (
                        <div className="w-10" />
                    ) : (
                        <Badge
                            isOneChar
                            color="danger"
                            content={<Icon className="text-background" icon="gravity-ui:circle-exclamation-fill" />}
                            isInvisible={!hasFailed}
                            placement="bottom-right"
                            shape="circle"
                        >
                            {avatar ? (
                                avatar
                            ) : (
                                <Skeleton className="rounded-full">
                                    <Avatar />
                                </Skeleton>
                            )}
                        </Badge>
                    )}
                </div>
                <div className="max-w-full flex flex-1 overflow-hidden flex-col items-start gap-4 relative">
                    <div className={cn('relative rounded-medium', failedMessageClassName, messageClassName, role === 'tool' ? '' : 'py-3')}>
                        {role === 'tool' ? (
                            toolTipsDom
                        ) : role === 'agent' ? (
                            <AgentSessionCard agentRun={ext?.agentRun} message={message} status={status} />
                        ) : (
                            <>
                                {!hasFailed && !message ? (
                                    <>
                                        <div className="flex flex-col gap-3 mt-[-3px] w-full">
                                            <Skeleton className="h-6 w-3/5 rounded-lg" />
                                            <Skeleton className="h-6 w-5/6 rounded-lg" />
                                            <Skeleton className="h-6 w-5/6 rounded-lg" />
                                        </div>
                                    </>
                                ) : (
                                    <div ref={messageRef} className={'text-small gap-1 text-default-600'}>
                                        {hasFailed ? (
                                            <Markdown className="px-4 text-wrap break-words text-danger-700 dark:text-danger-300 leading-loose">{failedMessageText}</Markdown>
                                        ) : (
                                            <>
                                                <Markdown className="text-wrap break-words text-gray-600 dark:text-gray-300 leading-loose">{message}</Markdown>

                                                {attach && attach.length > 0 && (
                                                    <div className="flex flex-wrap gap-3 m-2 mb-0">
                                                        {attach.map((v, index) => {
                                                            return (
                                                                <Zoom key={index}>
                                                                    <Image className="w-40 h-50 rounded-small border-small border-default-200/50 object-cover" src={v.url} />
                                                                </Zoom>
                                                            );
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
                            </>
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

function AgentSessionCard({ agentRun, message: _message, status }: { agentRun?: AgentRun; message?: string; status?: 'success' | 'failed' | 'continue' }) {
    const isFailed = status === 'failed' || agentRun?.status === 'failed';
    const isRunning = status === 'continue' || agentRun?.status === 'running';
    const [expanded, setExpanded] = React.useState(isRunning);
    const title = String(agentRun?.title || agentRun?.agent_id || agentRun?.node_id || 'Sub Agent');
    const subtitle = [agentRun?.agent_id, agentRun?.node_id].filter(Boolean).join(' · ');
    const task = String(agentRun?.task || '');
    const expectedOutput = String(agentRun?.expected_output || '');
    const result = String(agentRun?.result || '');
    const errorText = String(agentRun?.error || '');
    const warningText = String(agentRun?.warning || '');
    const events = Array.isArray(agentRun?.events) ? agentRun.events : [];
    const messages = Array.isArray(agentRun?.messages) ? agentRun.messages : [];
    const toolEvents = events.filter(event => String(event.type || '').startsWith('tool.') || String(event.type || '') === 'status');
    const streamedText = collectAgentStreamedText(events);
    const finalEventText = collectAgentFinalText(events);
    const assistantMessageText = collectAgentAssistantMessageText(messages);
    const assistantOutput = result || streamedText || finalEventText || assistantMessageText;
    const summaryText = String(agentRun?.summary || '');
    const preview = errorText || warningText || assistantOutput || summaryText;
    const showWaitingOutput = isRunning && !assistantOutput && !errorText;
    const showStreamedText = Boolean(result && streamedText && streamedText.trim() !== result.trim());
    const hasDetails = Boolean(
        task || expectedOutput || preview || result || streamedText || finalEventText || assistantMessageText || toolEvents.length || messages.length || agentRun?.trace_path || agentRun?.trace_dir
    );
    const statusLabel = isFailed ? t('Failed') : isRunning ? t('Running') : t('Completed');
    React.useEffect(() => {
        if (isRunning) {
            setExpanded(true);
            return;
        }
        setExpanded(false);
    }, [isRunning]);
    const toggleExpanded = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setExpanded(value => !value);
    }, []);

    return (
        <div className="w-full max-w-[680px] rounded-medium border border-default-200 bg-content1 px-3 py-2.5 shadow-sm">
            <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-default-100 text-default-600">
                    <Icon icon="material-symbols:account-tree-outline-rounded" width={17} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-small font-medium text-default-800">{title}</span>
                        <Chip size="sm" variant="flat" color={isFailed ? 'danger' : isRunning ? 'warning' : 'success'}>
                            {statusLabel}
                        </Chip>
                    </div>
                    {subtitle && <p className="truncate text-tiny text-default-500">{subtitle}</p>}
                </div>
                {hasDetails && (
                    <button
                        type="button"
                        className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-default-500 transition-colors hover:bg-default-100 hover:text-default-700"
                        aria-label={expanded ? t('Collapse') : t('Expand')}
                        aria-expanded={expanded}
                        onClick={toggleExpanded}
                    >
                        <Icon className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} icon="material-symbols:keyboard-arrow-down-rounded" width={20} />
                    </button>
                )}
            </div>
            {isRunning && task && <p className="mt-2 line-clamp-2 text-tiny text-default-500">{task}</p>}
            {!isRunning && preview && <p className="mt-2 line-clamp-2 text-tiny leading-5 text-default-600">{preview}</p>}
            {expanded && (
                <div className="mt-3 flex flex-col gap-3 border-t border-default-200 pt-3">
                    <AgentSessionFlow task={task} expectedOutput={expectedOutput} assistantOutput={assistantOutput} waiting={showWaitingOutput} errorText={errorText} warningText={warningText} />
                    {!assistantOutput && !errorText && !warningText && !isRunning && summaryText && <AgentDetailBlock title={t('Summary')} content={summaryText} />}
                    {showStreamedText && <AgentDetailBlock title={t('Stream Output')} content={streamedText} />}
                    {toolEvents.length > 0 && (
                        <div>
                            <p className="mb-1 text-tiny font-medium text-default-500">{t('Tool Activity')}</p>
                            <div className="flex flex-col gap-1.5">
                                {toolEvents.map((event, index) => (
                                    <div
                                        key={`${event.type}-${event.id || index}`}
                                        className="rounded-small border border-default-100 bg-default-50 px-2.5 py-2 text-[11px] leading-5 text-default-600 dark:bg-default-100/10"
                                    >
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium text-default-700">{String(event.name || event.type || 'event')}</span>
                                            {event.time && <span className="text-default-400">{String(event.time)}</span>}
                                        </div>
                                        {Boolean(event.arguments_text || event.arguments) && (
                                            <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words">
                                                {truncateAgentText(String(event.arguments_text || stringifyAgentValue(event.arguments)), 900)}
                                            </pre>
                                        )}
                                        {Boolean(event.result_text || event.result || event.message) && (
                                            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words">
                                                {truncateAgentText(String(event.result_text || stringifyAgentValue(event.result) || stringifyAgentValue(event.message)), 1200)}
                                            </pre>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {messages.length > 0 && (
                        <div>
                            <p className="mb-1 text-tiny font-medium text-default-500">{t('Sub Session Messages')}</p>
                            <div className="flex flex-col gap-1.5">
                                {messages.map((item, index) => (
                                    <div key={`${item.role}-${index}`} className="rounded-small border border-default-100 px-2.5 py-2 text-[11px] leading-5 text-default-600">
                                        <div className="mb-1 font-medium text-default-700">{String(item.role || item.tool_name || item.name || 'message')}</div>
                                        <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words">{truncateAgentText(String(item.content || stringifyAgentValue(item)), 1800)}</pre>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {(agentRun?.trace_path || agentRun?.trace_dir) && <p className="truncate text-[11px] text-default-400">{String(agentRun.trace_path || agentRun.trace_dir)}</p>}
                </div>
            )}
        </div>
    );
}

function AgentSessionFlow({
    task,
    expectedOutput,
    assistantOutput,
    waiting,
    errorText,
    warningText
}: {
    task: string;
    expectedOutput: string;
    assistantOutput: string;
    waiting: boolean;
    errorText: string;
    warningText: string;
}) {
    if (!task && !expectedOutput && !assistantOutput && !waiting && !errorText && !warningText) {
        return null;
    }
    return (
        <div>
            <p className="mb-2 text-tiny font-medium text-default-500">{t('Sub Session')}</p>
            <div className="flex flex-col gap-2">
                {(task || expectedOutput) && (
                    <AgentSessionFlowRow icon="material-symbols:person-outline-rounded" label={t('User')} tone="user">
                        {task && <Markdown className="text-wrap break-words">{task}</Markdown>}
                        {expectedOutput && (
                            <div className="mt-2 border-t border-default-200 pt-2">
                                <p className="mb-1 text-[11px] font-medium text-default-500">{t('Expected Output')}</p>
                                <Markdown className="text-wrap break-words">{expectedOutput}</Markdown>
                            </div>
                        )}
                    </AgentSessionFlowRow>
                )}
                <AgentSessionFlowRow
                    icon={errorText ? 'material-symbols:error-outline-rounded' : 'material-symbols:smart-toy-outline-rounded'}
                    label={errorText ? t('Error') : warningText ? t('Warning') : t('Assistant')}
                    tone={errorText ? 'error' : warningText ? 'warning' : 'assistant'}
                >
                    {assistantOutput ? (
                        <Markdown className="text-wrap break-words">{assistantOutput}</Markdown>
                    ) : errorText ? (
                        <Markdown className="text-wrap break-words">{errorText}</Markdown>
                    ) : warningText ? (
                        <Markdown className="text-wrap break-words">{warningText}</Markdown>
                    ) : waiting ? (
                        <span className="inline-flex items-center gap-2 text-default-500">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-default-400" />
                            {t('Waiting for assistant output...')}
                        </span>
                    ) : (
                        <span className="text-default-400">{t('No assistant output captured')}</span>
                    )}
                </AgentSessionFlowRow>
            </div>
        </div>
    );
}

function AgentSessionFlowRow({ icon, label, tone, children }: { icon: string; label: string; tone: 'user' | 'assistant' | 'warning' | 'error'; children: React.ReactNode }) {
    const toneClass = {
        user: 'bg-default-50 text-default-700 dark:bg-default-100/10',
        assistant: 'bg-content1 text-default-700',
        warning: 'bg-warning-50 text-warning-700 dark:bg-warning-100/10',
        error: 'bg-danger-50 text-danger-700 dark:bg-danger-100/10'
    }[tone];
    return (
        <div className="flex gap-2">
            <div className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-default-100 text-default-500">
                <Icon icon={icon} width={14} />
            </div>
            <div className={cn('min-w-0 flex-1 rounded-small border border-default-100 px-2.5 py-2 text-tiny leading-5', toneClass)}>
                <p className="mb-1 text-[11px] font-medium text-default-500">{label}</p>
                {children}
            </div>
        </div>
    );
}

function collectAgentStreamedText(events: AgentRun['events']): string {
    if (!Array.isArray(events)) {
        return '';
    }
    return events
        .filter(event => ['delta', 'assistant.delta', 'output.delta'].includes(String(event.type || '')) && event.text)
        .map(event => String(event.text))
        .join('');
}

function collectAgentFinalText(events: AgentRun['events']): string {
    if (!Array.isArray(events)) {
        return '';
    }
    return events
        .filter(event => ['assistant.final', 'output.final', 'final'].includes(String(event.type || '')))
        .map(event => String(event.text || event.message || event.result_text || stringifyAgentValue(event.result)))
        .filter(Boolean)
        .join('\n\n');
}

function collectAgentAssistantMessageText(messages: AgentRun['messages']): string {
    if (!Array.isArray(messages)) {
        return '';
    }
    return messages
        .filter(item => String(item.role || '').toLowerCase() === 'assistant' && item.content)
        .map(item => String(item.content))
        .filter(Boolean)
        .join('\n\n');
}

function AgentDetailBlock({ title, content }: { title: string; content: string }) {
    return (
        <div>
            <p className="mb-1 text-tiny font-medium text-default-500">{title}</p>
            <div className="max-h-80 overflow-auto rounded-small bg-default-50 px-2.5 py-2 text-tiny leading-5 text-default-700 dark:bg-default-100/10">
                <Markdown className="text-wrap break-words">{content}</Markdown>
            </div>
        </div>
    );
}

function stringifyAgentValue(value: unknown): string {
    if (value === undefined || value === null) {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function truncateAgentText(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, maxLength)}\n...`;
}
