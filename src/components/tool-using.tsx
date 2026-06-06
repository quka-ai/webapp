import { cn } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useState } from 'react';

import AnimatedShinyText from './shiny-text';

import { ToolStatus, ToolTips } from '@/types/chat';

export interface ToolUsingProps {
    toolTips?: ToolTips[];
}

export default function ToolUsing({ toolTips }: ToolUsingProps) {
    const [expandedByKey, setExpandedByKey] = useState<Record<string, boolean>>({});

    if (!toolTips?.length) {
        return null;
    }

    return (
        <div className="flex w-full flex-col gap-2">
            {toolTips.map((toolTip: ToolTips, index) => {
                const key = toolTip.id || `${toolTip.tool_name}-${index}`;
                const statusMeta = getStatusMeta(toolTip.status);
                const argsText = toolTip.arguments_text || formatValue(toolTip.arguments);
                const resultText = toolTip.result_text || formatValue(toolTip.result);
                const content = toolTip.content?.trim();
                const hasDetails = Boolean(content || argsText || resultText);
                const expanded = expandedByKey[key] ?? toolTip.status !== ToolStatus.TOOL_STATUS_SUCCESS;

                return (
                    <div key={key} className="w-full rounded-small border border-default-200 bg-default-50/70 px-2 py-1.5 dark:bg-default-100/20">
                        <button
                            type="button"
                            className={cn('flex min-h-8 w-full items-center gap-2 rounded-small px-1 text-left', hasDetails && 'cursor-pointer hover:bg-default-100/70 dark:hover:bg-default-100/30')}
                            onClick={() => {
                                if (!hasDetails) {
                                    return;
                                }
                                setExpandedByKey(prev => ({ ...prev, [key]: !expanded }));
                            }}
                        >
                            <AnimatedShinyText animate={toolTip.status === ToolStatus.TOOL_STATUS_RUNNING} className="mx-0 flex max-w-none flex-1 items-center gap-2 text-sm leading-none transition ease-out">
                                <Icon icon={statusMeta.icon} width={16} className={cn('shrink-0', statusMeta.color, toolTip.status === ToolStatus.TOOL_STATUS_RUNNING && 'animate-pulse')} />
                                <span className="truncate font-medium text-default-700">{toolTip.tool_name || 'tool'}</span>
                                <span className={cn('shrink-0 text-tiny leading-none', statusMeta.color)}>{statusMeta.label}</span>
                            </AnimatedShinyText>
                            {hasDetails && <Icon icon={expanded ? 'gravity-ui:chevron-up' : 'gravity-ui:chevron-down'} width={16} className="shrink-0 text-default-400" />}
                        </button>

                        {expanded && (
                            <>
                                {content && <div className="mt-1 px-1 text-xs leading-5 text-default-500">{content}</div>}

                                <div className="mt-2 flex flex-col gap-2">
                                    {argsText && <ToolDetail label="Arguments" value={argsText} />}
                                    {resultText && <ToolDetail label={toolTip.status === ToolStatus.TOOL_STATUS_FAILED ? 'Error' : 'Result'} value={resultText} />}
                                </div>
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function ToolDetail({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-small bg-background/70 px-2 py-1.5">
            <div className="mb-1 text-[11px] font-medium uppercase text-default-400">{label}</div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-default-600">{value}</pre>
        </div>
    );
}

function getStatusMeta(status: ToolStatus) {
    if (status === ToolStatus.TOOL_STATUS_SUCCESS) {
        return { label: 'Completed', icon: 'gravity-ui:circle-check-fill', color: 'text-success' };
    }
    if (status === ToolStatus.TOOL_STATUS_FAILED) {
        return { label: 'Failed', icon: 'gravity-ui:circle-exclamation-fill', color: 'text-danger' };
    }
    if (status === ToolStatus.TOOL_STATUS_RUNNING) {
        return { label: 'Running', icon: 'gravity-ui:circle-play-fill', color: 'text-warning' };
    }
    return { label: 'Pending', icon: 'gravity-ui:circle-info-fill', color: 'text-default-400' };
}

function formatValue(value: unknown): string {
    if (value === undefined || value === null) {
        return '';
    }
    if (typeof value === 'string') {
        return value.trim();
    }
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}
