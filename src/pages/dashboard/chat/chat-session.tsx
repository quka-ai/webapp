import { Accordion, AccordionItem, Avatar, Button, Listbox, ListboxItem, Modal, ModalBody, ModalContent, ModalHeader, ScrollShadow, useDisclosure } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import runes from 'runes';
import { useImmer } from 'use-immer';
import { useSnapshot } from 'valtio';

import { GenChatMessageID, GetChatSessionHistory, GetMessageExt, MessageDetail, NamedChatSession, SendMessage, StopChatStream } from '@/apis/chat';
import { ensureHermesAgentConfigured, HasHermesProviderConfigured, isHermesDesktopAvailable, SubscribeHermesChatStreamEvent } from '@/apis/hermes-desktop';
import KnowledgeModal from '@/components/knowledge-modal';
import { LogoIcon } from '@/components/logo';
import AnimatedShinyText from '@/components/shiny-text';
import { useMedia } from '@/hooks/use-media';
import useUserAvatar from '@/hooks/use-user-avatar';
import HermesStatusIndicator from '@/pages/dashboard/chat/hermes-status-indicator';
import MessageCard, { type MessageExt } from '@/pages/dashboard/chat/message-card';
import PromptInputWithEnclosedActions from '@/pages/dashboard/chat/prompt-input-with-enclosed-actions';
import HermesProviderSetting from '@/pages/dashboard/setting/hermes-provider-setting';
import HermesSkillsSetting from '@/pages/dashboard/setting/hermes-skills-setting';
import { notifySessionNamedEvent, notifySessionReload } from '@/stores/session';
import socketStore, { CONNECTION_OK } from '@/stores/socket';
import spaceStore from '@/stores/space';
import { EventType, MessageType, StreamMessage, ToolStatus, ToolTips } from '@/types/chat';

export interface Message {
    key: string;
    message: string;
    role: string;
    status: 'success' | 'failed' | 'continue' | undefined;
    sequence: number;
    spaceID: string;
    attach?: Attach[];
    ext?: MessageExt;
    len?: number;
    toolTips?: ToolTips[];
}

interface MessageEvent {
    type: number | string; // 支持 Centrifuge 的字符串类型
    message: string;
    messageID: string;
    spaceID?: string;
    sessionID?: string;
    startAt?: number;
    sequence?: number;
    toolTips?: ToolTips[];
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const messageDaemon: Map<string, NodeJS.Timeout> = new Map();
const AUTO_SCROLL_BOTTOM_THRESHOLD = 180;

function setMessageDaemon(messageID: string, callback: () => void) {
    const existInterval = messageDaemon.get(messageID);
    if (existInterval) {
        clearTimeout(existInterval);
    }
    const id = setTimeout(callback, 50000);
    messageDaemon.set(messageID, id);
}

function removeMessageDaemon(messageID: string) {
    const existInterval = messageDaemon.get(messageID);
    if (existInterval) {
        clearTimeout(existInterval);
        messageDaemon.delete(messageID);
    }
}

let onChatSessionMessageListReload = false;

export default function Chat() {
    const { t } = useTranslation();
    const [messages, setMessages] = useImmer<Message[]>([]);
    const [aiTyping, setAiTyping] = useState<boolean>(true);
    const { currentSelectedSpace } = useSnapshot(spaceStore);
    const userAvatar = useUserAvatar();
    const { sessionID } = useParams();
    const pageSize: number = 100;
    const [, setPage] = useState<number>(1);
    // const [onEvent, setEvent] = useState<FireTowerMsg | null>();
    const { subscribe, connectionStatus } = useSnapshot(socketStore);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const desktopMode = isHermesDesktopAvailable();
    const [providerConfigured, setProviderConfigured] = useState<boolean>(() => !isHermesDesktopAvailable());
    const [hermesTurnActive, setHermesTurnActive] = useState<boolean>(false);
    const [hermesAssistantStreaming, setHermesAssistantStreaming] = useState<boolean>(false);
    const { isOpen: isHermesSettingOpen, onOpen: openHermesSetting, onClose: closeHermesSetting, onOpenChange: onHermesSettingOpenChange } = useDisclosure();
    const { isOpen: isHermesSkillsOpen, onOpen: openHermesSkills, onClose: closeHermesSkills, onOpenChange: onHermesSkillsOpenChange } = useDisclosure();

    const ssDom = useRef<HTMLElement>(null);
    const autoScrollRef = useRef(true);
    const hermesTurnActiveRef = useRef(false);
    const hermesAssistantStreamingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const getScrollBottom = useScrollBottom(ssDom);

    useEffect(() => {
        if (!desktopMode) {
            setProviderConfigured(true);
            return;
        }

        HasHermesProviderConfigured()
            .then(setProviderConfigured)
            .catch(error => {
                console.error('Failed to check Hermes provider configuration:', error);
                setProviderConfigured(false);
            });
    }, [desktopMode]);

    useEffect(() => {
        if (!currentSelectedSpace || !desktopMode || !providerConfigured) {
            return;
        }

        ensureHermesAgentConfigured(currentSelectedSpace).catch(error => {
            console.error('Failed to start Hermes Agent:', error);
        });
    }, [currentSelectedSpace, desktopMode, providerConfigured]);

    const handleMessageScroll = useCallback(() => {
        autoScrollRef.current = getScrollBottom() <= AUTO_SCROLL_BOTTOM_THRESHOLD;
    }, [getScrollBottom]);

    function goToBottom() {
        if (ssDom.current) {
            ssDom.current.scrollTop = ssDom.current.scrollHeight;
            autoScrollRef.current = true;
        }
    }

    function followStreamToBottom() {
        if (autoScrollRef.current || getScrollBottom() <= AUTO_SCROLL_BOTTOM_THRESHOLD) {
            goToBottom();
        }
    }

    const setHermesTurnRunning = useCallback((running: boolean) => {
        hermesTurnActiveRef.current = running;
        setHermesTurnActive(running);
    }, []);

    const markHermesAssistantStreaming = useCallback((streaming: boolean, settleDelay = 0) => {
        if (hermesAssistantStreamingTimerRef.current) {
            clearTimeout(hermesAssistantStreamingTimerRef.current);
            hermesAssistantStreamingTimerRef.current = null;
        }

        if (streaming) {
            setHermesAssistantStreaming(true);
            return;
        }

        if (settleDelay > 0) {
            hermesAssistantStreamingTimerRef.current = setTimeout(() => {
                hermesAssistantStreamingTimerRef.current = null;
                setHermesAssistantStreaming(false);
            }, settleDelay);
            return;
        }

        setHermesAssistantStreaming(false);
    }, []);

    useEffect(() => {
        return () => {
            if (hermesAssistantStreamingTimerRef.current) {
                clearTimeout(hermesAssistantStreamingTimerRef.current);
                hermesAssistantStreamingTimerRef.current = null;
            }
        };
    }, []);

    const loadMessageExt = useCallback(
        async (messageID: string) => {
            if (!currentSelectedSpace || !sessionID) {
                return;
            }
            try {
                const resp = await GetMessageExt(currentSelectedSpace, sessionID, messageID);

                setMessages((prev: Message[]) => {
                    const todo = prev.find(v => v.key === messageID);

                    if (todo) {
                        todo.ext = {
                            relDocs: resp.rel_docs,
                            toolName: resp.tool_name,
                            toolArgs: resp.tool_args
                        };
                    }
                });
            } catch (e: any) {
                console.error(e);
            }
        },
        [currentSelectedSpace, sessionID, messages]
    );

    useEffect(() => {
        if (!currentSelectedSpace || !sessionID) {
            return;
        }
        let queue: MessageEvent[] = [];
        let isExist = false;
        let waitReloadTimes = 0;
        const reloadFunc = async () => {
            onChatSessionMessageListReload = true;
            await loadData(1);
            // 检查重新加载后的消息状态，如果所有消息都已完成，重置 aiTyping
            setMessages((prev: Message[]) => {
                if (prev.length > 0) {
                    const hasOngoingMessage = prev.some(msg => msg.status === 'continue');
                    if (!hasOngoingMessage && (!desktopMode || !hermesTurnActiveRef.current)) {
                        console.log('[reloadFunc] No ongoing messages found, setting aiTyping to false');
                        setAiTyping(false);
                    }
                } else if (!desktopMode || !hermesTurnActiveRef.current) {
                    // 如果没有消息，也重置 aiTyping
                    setAiTyping(false);
                }
                return prev;
            });
            onChatSessionMessageListReload = false;
        };

        if (desktopMode && !providerConfigured) {
            return;
        }

        if (!desktopMode && (connectionStatus !== CONNECTION_OK || !sessionID || !subscribe)) {
            if (messages.length > 0) {
                reloadFunc();
            }

            return;
        }

        const interval = () => {
            if (isExist) {
                return;
            }
            setTimeout(async () => {
                while (true) {
                    // reload 过程中不要消费 queue
                    if (onChatSessionMessageListReload) {
                        if (waitReloadTimes >= 30) {
                            // 200ms * 30 = 6s
                            waitReloadTimes = 0;
                            reloadFunc();
                            interval();
                            return;
                        }
                        waitReloadTimes++;
                        interval();

                        return;
                    }
                    const data = queue.shift();

                    if (!data) {
                        break;
                    }

                    switch (data.type) {
                        case EventType.EVENT_TURN_START:
                            if (desktopMode) {
                                markHermesAssistantStreaming(false);
                                setHermesTurnRunning(true);
                                setAiTyping(true);
                            }
                            break;
                        case EventType.EVENT_TURN_DONE:
                            if (desktopMode) {
                                markHermesAssistantStreaming(false);
                                setHermesTurnRunning(false);
                                setAiTyping(false);
                            }
                            break;
                        case EventType.EVENT_TOOL_INIT:
                            console.log(`[TOOL_INIT] Tool message initialized, messageID: ${data.messageID}`);
                            setMessages((prev: Message[]) => {
                                if (prev.find(v => v.key === data.messageID)) {
                                    console.log(`[TOOL_INIT] Message already exists, skipping`);
                                    return;
                                }
                                prev.push({
                                    key: data.messageID,
                                    spaceID: data.spaceID || currentSelectedSpace,
                                    message: '',
                                    role: 'tool',
                                    status: 'continue',
                                    sequence: data.sequence || 0,
                                    len: 0,
                                    ext: {}
                                });
                            });

                            setMessageDaemon(data.messageID, reloadFunc);
                            break;
                        case EventType.EVENT_ASSISTANT_INIT:
                            console.log(`[INIT] Assistant message initialized, messageID: ${data.messageID}`);
                            if (!desktopMode) {
                                setAiTyping(false);
                            }
                            if (messages.find(v => v.key === data.messageID)) {
                                console.log(`[INIT] Message already exists, skipping`);
                                break;
                            }

                            setMessages((prev: Message[]) => {
                                prev.push({
                                    key: data.messageID,
                                    spaceID: data.spaceID || currentSelectedSpace,
                                    message: '',
                                    role: 'assistant',
                                    status: 'continue',
                                    sequence: data.sequence || 0,
                                    len: 0,
                                    ext: {}
                                });
                            });

                            setMessageDaemon(data.messageID, reloadFunc);

                            break;
                        case EventType.EVENT_ASSISTANT_CONTINUE:
                            const messageRunes = runes(data.message);
                            if (desktopMode && messageRunes.length > 0) {
                                markHermesAssistantStreaming(true);
                            }
                            // 只在消息开始时和较长的消息时记录日志，避免日志过多
                            if (data.startAt === 0 || messageRunes.length > 100) {
                                console.log(`[CONTINUE] messageID: ${data.messageID}, startAt: ${data.startAt}, length: ${messageRunes.length}`);
                            }
                            for (let i = 0; i < messageRunes.length; i += 2) {
                                setMessages((prev: Message[]) => {
                                    const todo = prev.find(todo => todo.key === data.messageID);
                                    if (!todo) {
                                        console.warn(`[CONTINUE] Message not found, triggering reload. messageID: ${data.messageID}`);
                                        reloadFunc();
                                        return;
                                    }

                                    if (!data.startAt) {
                                        data.startAt = 0;
                                    }

                                    if (todo.len && todo.len !== data.startAt && todo.len + 2 < data.startAt) {
                                        console.warn(`[CONTINUE] Length mismatch - expected: ${data.startAt}, actual: ${todo.len}`);
                                        return;
                                    }

                                    if (todo.len !== data.startAt) {
                                        todo.len = data.startAt;
                                    }

                                    let char = messageRunes.slice(i, i + 2); // append two words at once

                                    todo.message += char.join('');
                                    if (!todo.len) {
                                        todo.len = 0;
                                    }
                                    todo.len += char.length;
                                    if (!data.startAt) {
                                        data.startAt = 0;
                                    }
                                    data.startAt += char.length;
                                });

                                if (i % 26 === 0) {
                                    followStreamToBottom();
                                }

                                await delay(30);
                            }
                            if (desktopMode && messageRunes.length > 0) {
                                markHermesAssistantStreaming(false, 900);
                            }
                            setMessageDaemon(data.messageID, reloadFunc);

                            break;
                        case EventType.EVENT_ASSISTANT_DONE:
                            console.log(`[DONE] messageID: ${data.messageID}, startAt: ${data.startAt}`);
                            if (desktopMode) {
                                markHermesAssistantStreaming(false);
                            }
                            if (!desktopMode) {
                                setAiTyping(false);
                            }
                            removeMessageDaemon(data.messageID);
                            setMessages((prev: Message[]) => {
                                const todo = prev.find(todo => todo.key === data.messageID);
                                console.log(`[DONE] found message:`, todo ? `len=${todo.len}, expected=${data.startAt}` : 'not found');
                                if (!todo || todo.len !== data.startAt) {
                                    console.warn('reload history due to message length mismatch or message not found');
                                    reloadFunc();
                                } else {
                                    todo.status = 'success';
                                    loadMessageExt(data.messageID);
                                }
                            });
                            break;
                        case EventType.EVENT_TOOL_CONTINUE:
                            setMessages((prev: Message[]) => {
                                const todo = prev.find(todo => todo.key === data.messageID);
                                if (!todo) {
                                    return;
                                }
                                todo.toolTips = data.toolTips;
                            });
                            break;
                        case EventType.EVENT_TOOL_DONE:
                            console.log(`[TOOL_DONE] Tool execution completed, messageID: ${data.messageID}`);
                            removeMessageDaemon(data.messageID);
                            setMessages((prev: Message[]) => {
                                const todo = prev.find(todo => todo.key === data.messageID);
                                if (!todo || !todo.toolTips) {
                                    console.log(`[TOOL_DONE] Message or toolTips not found`);
                                    return;
                                }

                                if (data.toolTips?.length) {
                                    todo.toolTips = data.toolTips;
                                } else {
                                    todo.toolTips.forEach(toolTip => {
                                        toolTip.status = ToolStatus.TOOL_STATUS_SUCCESS;
                                    });
                                }

                                // 标记 tool 消息为完成状态
                                todo.status = 'success';
                            });
                            if (!desktopMode) {
                                // Tool 完成后也需要检查是否还有其他正在进行的消息
                                // 如果没有，则重置 aiTyping
                                setMessages((prev: Message[]) => {
                                    const hasOngoingMessage = prev.some(msg => msg.status === 'continue');
                                    if (!hasOngoingMessage) {
                                        console.log('[TOOL_DONE] No ongoing messages, setting aiTyping to false');
                                        setAiTyping(false);
                                    }
                                    return prev;
                                });
                            }
                            break;
                        case EventType.EVENT_TOOL_FAILED:
                            console.log(`[TOOL_FAILED] Tool execution failed, messageID: ${data.messageID}`);
                            removeMessageDaemon(data.messageID);
                            setMessages((prev: Message[]) => {
                                const todo = prev.find(todo => todo.key === data.messageID);
                                if (!todo) {
                                    prev.push({
                                        key: data.messageID,
                                        spaceID: data.spaceID || currentSelectedSpace,
                                        message: '',
                                        role: 'tool',
                                        status: 'failed',
                                        sequence: data.sequence || 0,
                                        len: 0,
                                        toolTips: data.toolTips,
                                        ext: {}
                                    });
                                    return;
                                }

                                if (!todo.toolTips) {
                                    todo.toolTips = data.toolTips || [];
                                }

                                if (data.toolTips?.length) {
                                    todo.toolTips = data.toolTips;
                                } else {
                                    todo.toolTips.forEach(toolTip => {
                                        toolTip.status = ToolStatus.TOOL_STATUS_FAILED;
                                    });
                                }

                                // 标记 tool 消息为失败状态
                                todo.status = 'failed';
                            });
                            if (!desktopMode) {
                                // Tool 失败后也需要检查是否还有其他正在进行的消息
                                // 如果没有，则重置 aiTyping
                                setMessages((prev: Message[]) => {
                                    const hasOngoingMessage = prev.some(msg => msg.status === 'continue');
                                    if (!hasOngoingMessage) {
                                        console.log('[TOOL_FAILED] No ongoing messages, setting aiTyping to false');
                                        setAiTyping(false);
                                    }
                                    return prev;
                                });
                            }
                            break;
                        case EventType.EVENT_ASSISTANT_FAILED:
                            console.log(`[FAILED] Assistant message failed, messageID: ${data.messageID}`);
                            if (desktopMode) {
                                markHermesAssistantStreaming(false);
                            }
                            setMessages((prev: Message[]) => {
                                const todo = prev.find(todo => todo.key === data.messageID);
                                if (!todo) {
                                    prev.push({
                                        key: data.messageID,
                                        spaceID: data.spaceID || currentSelectedSpace,
                                        message: data.message || t('SystemError'),
                                        role: 'assistant',
                                        status: 'failed',
                                        sequence: data.sequence || 0,
                                        len: runes(data.message || '').length,
                                        ext: {}
                                    });
                                    return;
                                }
                                if (!todo.message && data.message) {
                                    todo.message = data.message;
                                    todo.len = runes(data.message).length;
                                }
                                todo.status = 'failed';
                            });
                            removeMessageDaemon(data.messageID);
                            // 消息失败时也应该重置 aiTyping
                            if (!desktopMode) {
                                setAiTyping(false);
                            }
                            break;

                        default:
                    }

                    followStreamToBottom();
                }
                interval();
            }, 200);
        };

        setTimeout(() => {
            interval();
        });

        const enqueueStreamEvent = (eventType: EventType | string | number, streamData: StreamMessage & { sequence?: number; space_id?: string }, data: any = streamData) => {
            // 处理 Centrifuge 字符串类型的 EventType
            eventType = typeof eventType === 'string' ? parseInt(eventType) : eventType;
            switch (eventType) {
                case EventType.EVENT_ASSISTANT_INIT:
                case EventType.EVENT_TOOL_INIT:
                case EventType.EVENT_TURN_START:
                case EventType.EVENT_TURN_DONE:
                    queue.push({
                        messageID: streamData.message_id,
                        type: eventType,
                        startAt: 0,
                        sequence: data.sequence,
                        spaceID: data.space_id,
                        sessionID: streamData.session_id,
                        message: ''
                    });
                    break;
                case EventType.EVENT_ASSISTANT_CONTINUE:
                case EventType.EVENT_TOOL_CONTINUE:
                    if (streamData.msg_type === MessageType.MESSAGE_TYPE_TOOL_TIPS) {
                        const newToolTips: ToolTips[] = [];
                        if (streamData.tool_tips) {
                            streamData.tool_tips.status = ToolStatus.TOOL_STATUS_RUNNING;
                            newToolTips.push(streamData.tool_tips);
                        }
                        queue.push({
                            messageID: streamData.message_id,
                            type: eventType,
                            startAt: streamData.start_at,
                            toolTips: newToolTips,
                            message: ''
                        });
                        // 可以在这里处理tool tips相关逻辑
                    } else {
                        if (desktopMode && eventType === EventType.EVENT_ASSISTANT_CONTINUE && streamData.message) {
                            markHermesAssistantStreaming(true);
                        }
                        queue.push({
                            messageID: streamData.message_id,
                            type: eventType,
                            startAt: streamData.start_at,
                            message: streamData.message || ''
                        });
                    }
                    break;
                case EventType.EVENT_ASSISTANT_DONE:
                    queue.push({
                        messageID: streamData.message_id,
                        type: eventType,
                        startAt: streamData.start_at,
                        message: streamData.message || ''
                    });
                    // todo load this message exts
                    break;
                case EventType.EVENT_TOOL_DONE:
                    const newToolTips: ToolTips[] = [];
                    if (streamData.tool_tips) {
                        streamData.tool_tips.status = ToolStatus.TOOL_STATUS_SUCCESS;
                        newToolTips.push(streamData.tool_tips);
                    }

                    queue.push({
                        messageID: streamData.message_id,
                        type: eventType,
                        startAt: streamData.start_at,
                        toolTips: newToolTips,
                        message: ''
                    });
                    // 可以在这里处理tool tips相关逻辑
                    break;
                case EventType.EVENT_ASSISTANT_FAILED:
                case EventType.EVENT_TOOL_FAILED:
                    const failedToolTips: ToolTips[] = [];
                    if (streamData.tool_tips) {
                        streamData.tool_tips.status = ToolStatus.TOOL_STATUS_FAILED;
                        failedToolTips.push(streamData.tool_tips);
                    }
                    queue.push({
                        messageID: streamData.message_id,
                        type: eventType,
                        startAt: streamData.start_at,
                        sequence: data.sequence,
                        spaceID: data.space_id,
                        sessionID: streamData.session_id,
                        toolTips: failedToolTips,
                        message: streamData.message || streamData.tool_tips?.content || ''
                    });
                    break;
            }
        };

        if (desktopMode) {
            const unSubscribe = SubscribeHermesChatStreamEvent(currentSelectedSpace, sessionID, enqueueStreamEvent);

            return () => {
                isExist = true;
                unSubscribe();
            };
        }

        // data : {\"subject\":\"stage_changed\",\"version\":\"v1\",\"data\":{\"knowledge_id\":\"n9qU71qKbqhHak6weNrH7UpCzU4yNiBv\",\"stage\":\"Done\"}}"
        const unSubscribe = subscribe!(['/chat_session/' + currentSelectedSpace + '/' + sessionID], (msg: FireTowerMsg) => {
            if (msg.data.subject !== 'on_message' && msg.data.subject !== 'on_message_init') {
                return;
            }

            const { type, data } = msg.data;
            const streamData = data as StreamMessage;

            enqueueStreamEvent(typeof type === 'string' ? parseInt(type) : type, streamData, data);
        });

        return () => {
            isExist = true;
            unSubscribe();
        };
    }, [connectionStatus, currentSelectedSpace, sessionID, desktopMode, providerConfigured, markHermesAssistantStreaming, setHermesTurnRunning]);

    const loadData = useCallback(
        async (page: number): Promise<number | void> => {
            if (!currentSelectedSpace || (!hasMore && page !== 1) || !sessionID) {
                return;
            }
            try {
                const resp = await GetChatSessionHistory(currentSelectedSpace, sessionID, 0, page, pageSize);

                setPage(page);
                if (page * pageSize >= resp.total) {
                    setHasMore(false);
                } else {
                    setHasMore(true);
                }

                const newMsgs =
                    resp.list &&
                    resp.list.map((v: MessageDetail): Message => {
                        let role = '';
                        switch (v.meta.role) {
                            case 1:
                                role = 'user';
                                break;
                            case 2:
                                role = 'assistant';
                                break;
                            case 4:
                                role = 'tool';
                                break;
                            default:
                                role = 'assistant';
                                break;
                        }
                        return {
                            key: v.meta.message_id,
                            message: v.meta.message.text,
                            role: role,
                            status: v.meta.complete !== 4 ? 'success' : 'failed',
                            sequence: v.meta.sequence,
                            spaceID: currentSelectedSpace,
                            attach: v.meta.attach,
                            ext: {
                                relDocs: v.ext?.rel_docs,
                                toolName: v.ext?.tool_name,
                                toolArgs: v.ext?.tool_args
                            },
                            toolTips: v.ext?.tool_tips
                        };
                    });

                if (page === 1) {
                    setMessages(newMsgs || []);
                } else if (resp.list) {
                    setMessages([...newMsgs, ...messages]);
                }

                setTimeout(() => {
                    if (page === 1) {
                        goToBottom();
                    }
                }, 500);

                return resp.total;
            } catch (e: any) {
                console.error(e);
            }
        },
        [currentSelectedSpace, sessionID, hasMore]
    );

    const location = useLocation();
    const urlParams = new URLSearchParams(window.location.search);
    const isNew = urlParams.get('isNew');

    const hasOngoingMessage = useMemo<boolean>(() => messages.some(msg => msg.status === 'continue'), [messages]);
    const hasActiveAssistantPlaceholder = useMemo<boolean>(() => messages.some(msg => msg.role === 'assistant' && msg.status === 'continue' && !msg.message.trim()), [messages]);
    const hasRunningToolMessage = useMemo<boolean>(() => messages.some(msg => msg.role === 'tool' && msg.status === 'continue'), [messages]);

    const isGenerating = useMemo<boolean>(() => {
        if (desktopMode) {
            return hermesTurnActive || aiTyping || hasOngoingMessage;
        }
        return aiTyping || hasOngoingMessage;
    }, [aiTyping, desktopMode, hasOngoingMessage, hermesTurnActive]);

    const showHermesThinkingIndicator = useMemo<boolean>(() => {
        if (!desktopMode || (!hermesTurnActive && !aiTyping)) {
            return false;
        }
        return !hermesAssistantStreaming && !hasActiveAssistantPlaceholder && !hasRunningToolMessage;
    }, [aiTyping, desktopMode, hasActiveAssistantPlaceholder, hasRunningToolMessage, hermesAssistantStreaming, hermesTurnActive]);

    const showTypingIndicator = desktopMode ? showHermesThinkingIndicator : aiTyping;

    const query = useCallback(
        async (message: string, agent: string, args: ChatArgs, files?: Attach[]) => {
            console.info('[hermes] chat session query invoked', {
                spaceID: currentSelectedSpace,
                sessionID,
                messageLength: message.length,
                args
            });
            if (!currentSelectedSpace || !sessionID) {
                console.warn('[hermes] chat session query skipped: missing space or session', {
                    spaceID: currentSelectedSpace,
                    sessionID
                });
                return;
            }
            if (desktopMode && !providerConfigured) {
                openHermesSetting();
                return;
            }

            message = message.replace(/\n/g, '  \n');

            try {
                const msgID = await GenChatMessageID(currentSelectedSpace, sessionID);
                console.info('[hermes] chat session generated message id', { msgID });
                const resp = await SendMessage(currentSelectedSpace, sessionID, {
                    messageID: msgID,
                    message: message,
                    agent: agent,
                    enableThinking: args.enableThinking,
                    enableSearch: args.enableSearch,
                    enableKnowledge: args.enableKnowledge,
                    files: files
                });
                console.info('[hermes] chat session send returned', resp);

                setMessages((prev: Message[]) => {
                    prev.push({
                        key: msgID,
                        message: message,
                        role: 'user',
                        status: 'success',
                        sequence: resp.sequence,
                        spaceID: currentSelectedSpace,
                        attach: files,
                        ext: {}
                    });
                });

                // waiting ws response
                if (desktopMode) {
                    markHermesAssistantStreaming(false);
                }
                setAiTyping(true);

                if (desktopMode) {
                    setHermesTurnRunning(true);
                } else {
                    // 在消息守护进程中清除这个超时
                    setMessageDaemon(resp.answer_id, () => {
                        console.warn('未收到 MESSAGE INIT 事件，触发重载');
                        setAiTyping(false);
                        // 重新加载数据以获取最新状态
                        loadData(1);
                    });
                }

                sessionID && notifySessionReload(sessionID);

                setTimeout(() => {
                    goToBottom();
                }, 500);
            } catch (e: any) {
                console.error('[hermes] chat session query failed', e);
                if (desktopMode) {
                    markHermesAssistantStreaming(false);
                    setHermesTurnRunning(false);
                }
                setAiTyping(false);
                console.error(e);
                throw e;
            }
        },
        [currentSelectedSpace, sessionID, loadData, desktopMode, providerConfigured, openHermesSetting, setHermesTurnRunning, markHermesAssistantStreaming]
    );

    async function NamedSession(firstMessage: string) {
        if (!sessionID) {
            return;
        }
        try {
            const resp = await NamedChatSession(currentSelectedSpace, sessionID, firstMessage);

            notifySessionNamedEvent({
                sessionID: resp.session_id,
                name: resp.name
            });
        } catch (e: any) {
            console.error(e);
        }
    }

    const navigate = useNavigate();

    const [selectedUseMemory, setSelectedUseMemory] = useState(localStorage.getItem('selectedUseMemory') === 'true');
    const [selectedEnableThinking, setSelectedEnableThinking] = useState(localStorage.getItem('selectedEnableThinking') === 'true');
    const [selectedEnableSearch, setSelectedEnableSearch] = useState(localStorage.getItem('selectedEnableSearch') === 'true');

    useEffect(() => {
        async function load() {
            setMessages([]);
            markHermesAssistantStreaming(false);
            setAiTyping(true);
            const total = await loadData(1);
            if (isNew && total === 0) {
                if (location.state && location.state.messages && location.state.messages.length === 1) {
                    console.info('[hermes] new chat session auto-send begin', location.state);
                    try {
                        NamedSession(location.state.messages[0].message);
                        setSelectedUseMemory(Boolean(location.state.args?.enableKnowledge));
                        setSelectedEnableThinking(Boolean(location.state.args?.enableThinking));
                        setSelectedEnableSearch(Boolean(location.state.args?.enableSearch));
                        await query(location.state.messages[0].message, location.state.agent, location.state.args, location.state.files);
                        location.state.messages = undefined;
                        return;
                    } catch (error) {
                        console.error('[hermes] new chat session auto-send failed', error);
                        markHermesAssistantStreaming(false);
                        setHermesTurnRunning(false);
                        setAiTyping(false);
                    }
                }
            }
            setAiTyping(false);
        }
        if (currentSelectedSpace) {
            if (desktopMode && !providerConfigured) {
                setMessages([]);
                markHermesAssistantStreaming(false);
                setHermesTurnRunning(false);
                setAiTyping(false);
                return;
            }
            if (!sessionID || (messages && messages.length > 0 && messages[0].spaceID !== currentSelectedSpace)) {
                navigate(`/dashboard/${currentSelectedSpace}/chat`);

                return;
            }
            load();
        }
    }, [currentSelectedSpace, sessionID, desktopMode, providerConfigured, setHermesTurnRunning, markHermesAssistantStreaming]);

    const viewKnowledge = useRef(null);

    const showKnowledge = useCallback(
        (knowledgeID: string) => {
            if (viewKnowledge && viewKnowledge.current) {
                // @ts-ignore
                viewKnowledge.current.show(knowledgeID);
            }
        },
        [viewKnowledge]
    );

    const { isMobile } = useMedia();

    const stopChatStream = useCallback(async () => {
        if (!currentSelectedSpace || !sessionID) {
            return;
        }
        try {
            await StopChatStream(currentSelectedSpace, sessionID);
        } catch (error) {
            console.error('[hermes] stop chat stream failed', error);
        } finally {
            if (desktopMode) {
                markHermesAssistantStreaming(false);
                setHermesTurnRunning(false);
            }
            setAiTyping(false);
            setMessages((prev: Message[]) => {
                prev.forEach(message => {
                    if (message.status !== 'continue') {
                        return;
                    }
                    removeMessageDaemon(message.key);
                    message.status = 'success';
                    if (message.role === 'assistant' && !message.message.trim()) {
                        message.message = t('Generation stopped');
                        message.len = runes(message.message).length;
                    }
                    message.toolTips?.forEach(toolTip => {
                        if (toolTip.status === ToolStatus.TOOL_STATUS_RUNNING) {
                            toolTip.status = ToolStatus.TOOL_STATUS_SUCCESS;
                        }
                    });
                });
            });
        }
    }, [currentSelectedSpace, sessionID, setMessages, t, desktopMode, setHermesTurnRunning, markHermesAssistantStreaming]);

    const handleProviderConfigured = useCallback(() => {
        setProviderConfigured(true);
        closeHermesSetting();
        if (currentSelectedSpace) {
            ensureHermesAgentConfigured(currentSelectedSpace).catch(error => {
                console.error('Failed to start Hermes Agent:', error);
            });
        }
    }, [closeHermesSetting, currentSelectedSpace]);

    if (desktopMode && !providerConfigured) {
        return (
            <div className="overflow-hidden w-full h-full flex justify-center relative">
                <div className="absolute right-4 top-4 z-10">
                    <HermesStatusIndicator />
                </div>
                <div className="flex w-full h-full flex-col px-4 sm:max-w-[620px] justify-center">
                    <HermesProviderSetting
                        className="rounded-large border border-default-200 bg-content1 p-4 shadow-sm"
                        description={t('Configure Hermes before chatting')}
                        onConfigured={handleProviderConfigured}
                    />
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="overflow-hidden w-full h-full flex flex-col relative px-3">
                {desktopMode && (
                    <>
                        <div className="pointer-events-none absolute right-4 top-4 z-50 flex items-center gap-2">
                            <HermesStatusIndicator className="pointer-events-auto" />
                            <Button isIconOnly className="pointer-events-auto" variant="light" aria-label={t('Hermes Skills')} onClick={openHermesSkills} onPress={openHermesSkills}>
                                <Icon icon="material-symbols:extension-rounded" width={22} />
                            </Button>
                            <Button isIconOnly className="pointer-events-auto" variant="light" aria-label={t('Hermes Settings')} onClick={openHermesSetting} onPress={openHermesSetting}>
                                <Icon icon="material-symbols:settings-rounded" width={22} />
                            </Button>
                        </div>
                        <Modal backdrop="blur" isOpen={isHermesSettingOpen} placement="center" scrollBehavior="inside" onClose={closeHermesSetting} onOpenChange={onHermesSettingOpenChange}>
                            <ModalContent>
                                <ModalHeader>{t('Hermes Settings')}</ModalHeader>
                                <ModalBody className="pb-6">
                                    <HermesProviderSetting onConfigured={handleProviderConfigured} />
                                </ModalBody>
                            </ModalContent>
                        </Modal>
                        <Modal backdrop="blur" isOpen={isHermesSkillsOpen} size="3xl" placement="center" scrollBehavior="inside" onClose={closeHermesSkills} onOpenChange={onHermesSkillsOpenChange}>
                            <ModalContent>
                                <ModalHeader>{t('Hermes Skills')}</ModalHeader>
                                <ModalBody className="pb-6">
                                    <HermesSkillsSetting />
                                </ModalBody>
                            </ModalContent>
                        </Modal>
                    </>
                )}
                <main className="h-full w-full relative gap-4 py-3 flex flex-col justify-center items-center">
                    <ScrollShadow ref={ssDom} hideScrollBar className="w-full py-6 flex-grow items-center" onScroll={handleMessageScroll}>
                        <div className="w-full m-auto max-w-[760px] overflow-hidden relative flex flex-col">
                            {messages.map(({ key, role, message, attach, status, ext, toolTips }, index) => {
                                const prevRole = index > 0 ? messages[index - 1].role : null;
                                const shouldHaveNormalSpacing = role === 'user' || (role !== 'user' && prevRole === 'user');
                                const marginClass = index === 0 ? '' : shouldHaveNormalSpacing ? 'mt-4' : 'mt-1';

                                return (
                                    <MessageCard
                                        key={key}
                                        className={marginClass}
                                        avatar={role === 'assistant' ? <LogoIcon size={isMobile ? '30' : '38'} /> : <Avatar src={userAvatar} size={isMobile ? 'sm' : 'md'} />}
                                        message={message}
                                        attach={attach}
                                        messageClassName={role === 'user' ? 'bg-content2 text-content2-foreground !py-3 w-full px-3' : 'px-1 w-full'}
                                        // showFeedback={role === 'assistant'}
                                        status={status}
                                        ext={ext}
                                        role={role}
                                        toolTips={toolTips}
                                        extContent={
                                            role === 'assistant' &&
                                            !desktopMode &&
                                            ext &&
                                            ext.relDocs &&
                                            ext.relDocs.length > 0 && (
                                                <div className="mx-2 w-auto overflow-hidden">
                                                    <Accordion isCompact variant="bordered">
                                                        <AccordionItem
                                                            key="1"
                                                            aria-label="Relevance Detail"
                                                            title={t('showRelevanceDocs')}
                                                            classNames={{ title: 'dark:text-zinc-300 text-zinc-500 text-sm' }}
                                                            className="overflow-hidden w-ful"
                                                        >
                                                            {ext.relDocs && (
                                                                <Listbox
                                                                    aria-label="rel docs"
                                                                    title="docs id"
                                                                    onAction={key => {
                                                                        showKnowledge(key as string);
                                                                    }}
                                                                >
                                                                    {ext.relDocs.map(v => {
                                                                        return (
                                                                            <ListboxItem
                                                                                key={v.id}
                                                                                aria-label={v.title}
                                                                                className="overflow-hidden text-wrap break-words break-all flex flex-col items-start"
                                                                            >
                                                                                {v.title && <div>{v.title}</div>}
                                                                                <div> {v.id}</div>
                                                                            </ListboxItem>
                                                                        );
                                                                    })}
                                                                </Listbox>
                                                            )}
                                                        </AccordionItem>
                                                    </Accordion>
                                                </div>
                                            )
                                        }
                                    />
                                );
                            })}
                            {showTypingIndicator &&
                                (showHermesThinkingIndicator ? (
                                    <HermesThinkingIndicator className={messages.length > 0 && messages[messages.length - 1].role === 'user' ? 'mt-4' : 'mt-1'} />
                                ) : (
                                    <MessageCard
                                        key="aiTyping"
                                        isLoading
                                        className={messages.length > 0 && messages[messages.length - 1].role === 'user' ? 'mt-4' : 'mt-1'}
                                        messageClassName="w-full"
                                        attempts={1}
                                        currentAttempt={1}
                                        message={''}
                                    />
                                ))}
                        </div>
                        <div className="pb-40" />
                    </ScrollShadow>

                    <div className="mt-auto flex flex-col gap-2 max-w-[760px] w-full">
                        <PromptInputWithEnclosedActions
                            allowAttach={true}
                            disableAgentMention={desktopMode}
                            hideFeatureControls={desktopMode}
                            isLoading={isGenerating}
                            classNames={{
                                button: 'bg-default-foreground opacity-100 w-[30px] h-[30px] !min-w-[30px] self-center',
                                buttonIcon: 'text-background',
                                input: 'placeholder:text-default-500'
                            }}
                            placeholder={t('chatToAgent')}
                            selectedUseMemory={selectedUseMemory}
                            selectedEnableSearch={selectedEnableSearch}
                            selectedEnableThinking={selectedEnableThinking}
                            onSubmitFunc={query}
                            onStopFunc={stopChatStream}
                        />
                        <p className="text-center text-small font-medium leading-5 text-default-500">{t('chatNotice')}</p>
                    </div>
                </main>
            </div>
            <KnowledgeModal ref={viewKnowledge} />
        </>
    );
}

function useScrollBottom(ref: React.RefObject<HTMLElement>) {
    const getScrollBottom = (): number => {
        if (ref.current) {
            return ref.current.scrollHeight - (ref.current.clientHeight + ref.current.scrollTop);
        }
        return 0;
    };

    return getScrollBottom;
}

function HermesThinkingIndicator({ className }: { className?: string }) {
    const { t } = useTranslation();

    return (
        <div className={`flex flex-col md:flex-row md:gap-2 ${className || ''}`}>
            <div className="relative flex-none md:py-1">
                <div className="w-10" />
            </div>
            <div className="flex min-h-7 flex-1 items-center overflow-hidden px-1">
                <div className="flex items-center gap-2.5">
                    <AnimatedShinyText>{t('Hermes is thinking...')}</AnimatedShinyText>
                </div>
            </div>
        </div>
    );
}
