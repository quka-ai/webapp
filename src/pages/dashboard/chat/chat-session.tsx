import { Accordion, AccordionItem, Avatar, Listbox, ListboxItem, ScrollShadow } from '@heroui/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import runes from 'runes';
import { useImmer } from 'use-immer';
import { useSnapshot } from 'valtio';

import { GenChatMessageID, GetChatSessionHistory, GetMessageExt, MessageDetail, NamedChatSession, SendMessage } from '@/apis/chat';
import KnowledgeModal from '@/components/knowledge-modal';
import { LogoIcon, Name } from '@/components/logo';
import useUserAvatar from '@/hooks/use-user-avatar';
import { FireTowerMsg } from '@/lib/firetower';
import MessageCard, { type MessageExt } from '@/pages/dashboard/chat/message-card';
import PromptInputWithEnclosedActions from '@/pages/dashboard/chat/prompt-input-with-enclosed-actions';
import { notifySessionNamedEvent, notifySessionReload } from '@/stores/session';
import socketStore, { CONNECTION_OK } from '@/stores/socket';
import spaceStore from '@/stores/space';
import { EventType } from '@/types/chat';

interface Message {
    key: string;
    message: string;
    role: string;
    status: 'success' | 'failed' | 'continue' | undefined;
    sequence: number;
    spaceID: string;
    attach: Attach[];
    ext: MessageExt;
    len: number;
}

interface MessageEvent {
    type: number;
    message: string;
    messageID: string;
    spaceID?: string;
    sessionID?: string;
    startAt?: number;
    sequence?: number;
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const messageDaemon: Map<string, number> = new Map();

function setMessageDaemon(messageID: string, callback: () => void) {
    const existInterval = messageDaemon.get(messageID);
    if (existInterval) {
        clearTimeout(existInterval);
    }
    const id = setTimeout(callback, 100000);
    messageDaemon.set(messageID, id);
}

function removeMessageDaemon(messageID: string) {
    const existInterval = messageDaemon.get(messageID);
    if (existInterval) {
        clearTimeout(existInterval);
        messageDaemon.delete(messageID);
    }
}

export default function Chat() {
    const { t } = useTranslation();
    const [messages, setMessages] = useImmer<Message[]>([]);
    const [aiTyping, setAiTyping] = useState<boolean>(true);
    const { currentSelectedSpace } = useSnapshot(spaceStore);
    const userAvatar = useUserAvatar();
    const { sessionID } = useParams();
    const pageSize: number = 20;
    const [page, setPage] = useState<number>(1);
    // const [onEvent, setEvent] = useState<FireTowerMsg | null>();
    const { subscribe, connectionStatus } = useSnapshot(socketStore);
    const [hasMore, setHasMore] = useState<boolean>(true);

    const ssDom = useRef<HTMLElement>(null);

    const getScrollBottom = useScrollBottom(ssDom);

    function goToBottom() {
        if (ssDom) {
            // @ts-ignore
            ssDom.current.scrollTop = 9999999;
        }
    }

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
                            relDocs: resp.rel_docs
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
        let queue: MessageEvent[] = [];
        let onReload = false;
        const reloadFunc = async () => {
            onReload = true;
            await loadData(1);
            queue = [];
            onReload = false;
        };

        if (connectionStatus !== CONNECTION_OK || !sessionID || !subscribe) {
            if (messages.length > 0) {
                reloadFunc();
            }

            return;
        }

        const interval = () => {
            setTimeout(async () => {
                if (onReload) {
                    interval();

                    return;
                }
                while (true) {
                    const data = queue.shift();

                    if (!data || (data.type !== EventType.EVENT_ASSISTANT_INIT && messages.find(v => v.key === data.messageID))) {
                        data && queue.unshift(data);
                        break;
                    }

                    switch (data.type) {
                        case EventType.EVENT_ASSISTANT_INIT:
                            if (messages.find(v => v.key === data.messageID)) {
                                break;
                            }
                            setAiTyping(false);
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
                            const totalLength = messageRunes.length;
                            for (let i = 0; i < messageRunes.length; i += 2) {
                                setMessages((prev: Message[]) => {
                                    const todo = prev.find(todo => todo.key === data.messageID);

                                    if (!todo || todo.len !== data.startAt) {
                                        return;
                                    }

                                    let char = messageRunes.slice(i, i + 2); // append two words at once

                                    todo.message += char.join('');
                                    todo.len += char.length;
                                    data.startAt += char.length;
                                });

                                if (i % 26 === 0) {
                                    if (getScrollBottom() < 150) {
                                        goToBottom();
                                    }
                                }

                                await delay(30);
                            }
                            setMessageDaemon(data.messageID, reloadFunc);

                            break;
                        case EventType.EVENT_ASSISTANT_DONE:
                            setMessages((prev: Message[]) => {
                                const todo = prev.find(todo => todo.key === data.messageID);
                                if (!todo || todo.len !== data.startAt) {
                                    console.warn('reload history');
                                    reloadFunc();
                                } else {
                                    todo.status = 'success';
                                    loadMessageExt(data.messageID);
                                }
                            });
                            // todo load this message exts
                            removeMessageDaemon(data.messageID);
                            break;
                        case EventType.EVENT_ASSISTANT_FAILED:
                            setMessages((prev: Message[]) => {
                                const todo = prev.find(todo => todo.key === data.messageID);

                                if (todo) {
                                    todo.status = 'failed';
                                }
                            });
                            removeMessageDaemon(data.messageID);
                            break;
                        default:
                    }

                    if (getScrollBottom() < 150) {
                        goToBottom();
                    }
                }
                interval();
            }, 200);
        };

        setTimeout(() => {
            interval();
        });

        // data : {\"subject\":\"stage_changed\",\"version\":\"v1\",\"data\":{\"knowledge_id\":\"n9qU71qKbqhHak6weNrH7UpCzU4yNiBv\",\"stage\":\"Done\"}}"
        const unSubscribe = subscribe(['/chat_session/' + sessionID], (msg: FireTowerMsg) => {
            if (msg.data.subject !== 'on_message' && msg.data.subject !== 'on_message_init') {
                return;
            }

            const { type, data } = msg.data;

            switch (type) {
                case EventType.EVENT_ASSISTANT_INIT:
                    queue.push({
                        messageID: data.message_id,
                        type: EventType.EVENT_ASSISTANT_INIT,
                        startAt: 0,
                        sequence: data.sequence,
                        spaceID: data.space_id,
                        sessionID: data.session_id,
                        message: ''
                    });
                    // setMessages((prev: Message[]): Message[] => {
                    //     prev.push({
                    //         key: data.message_id,
                    //         message: '',
                    //         role: 'assistant',
                    //         status: 'continue',
                    //         sequence: data.sequence,
                    //         loading: true
                    //     });
                    // });
                    break;
                case EventType.EVENT_ASSISTANT_CONTINUE:
                    queue.push({
                        messageID: data.message_id,
                        type: EventType.EVENT_ASSISTANT_CONTINUE,
                        startAt: data.start_at,
                        message: data.message
                    });
                    // setMessages((prev: Message[]) => {
                    //     const todo = prev.find(todo => todo.key === data.message_id);
                    //     if (!todo) {
                    //     }
                    //     if (todo?.message.length !== data.start_at) {
                    //         console.warn('reload history');
                    //     }
                    //     todo.message += data.message;
                    // });
                    break;
                case EventType.EVENT_ASSISTANT_DONE:
                    queue.push({
                        messageID: data.message_id,
                        type: EventType.EVENT_ASSISTANT_DONE,
                        startAt: data.start_at,
                        message: ''
                    });
                    // setMessages((prev: Message[]) => {
                    //     const todo = prev.find(todo => todo.key === data.message_id);

                    //     if (todo?.message.length !== data.start_at) {
                    //         console.warn('reload history');
                    //     } else {
                    //         todo.status = 'success';
                    //     }
                    // });
                    // todo load this message exts
                    break;
                case EventType.EVENT_ASSISTANT_FAILED:
                    queue.push({
                        messageID: data.message_id,
                        type: EventType.EVENT_ASSISTANT_FAILED,
                        startAt: 0,
                        message: ''
                    });
                    // setMessages((prev: Message[]) => {
                    //     const todo = prev.find(todo => todo.key === data.message_id);

                    //     todo.status = 'failed';
                    // });
                    break;
            }
        });

        return unSubscribe;
    }, [connectionStatus, sessionID]);

    const loadData = useCallback(
        async (page: number): Promise<number | void> => {
            if (!currentSelectedSpace || (!hasMore && page !== 1) || !sessionID) {
                return;
            }
            try {
                const resp = await GetChatSessionHistory(currentSelectedSpace, sessionID, '', page, pageSize);

                setPage(page);
                if (page * pageSize >= resp.total) {
                    setHasMore(false);
                } else {
                    setHasMore(true);
                }

                const newMsgs =
                    resp.list &&
                    resp.list.map((v: MessageDetail): Message => {
                        return {
                            key: v.meta.message_id,
                            message: v.meta.message.text,
                            role: v.meta.role === 1 ? 'user' : 'assistant',
                            status: v.meta.complete === 1 ? 'success' : 'failed',
                            sequence: v.meta.sequence,
                            spaceID: currentSelectedSpace,
                            attach: v.meta.attach,
                            ext: {
                                relDocs: v.ext?.rel_docs
                            }
                        };
                    });

                if (page === 1) {
                    setMessages(newMsgs || []);
                } else if (resp.list) {
                    setMessages([...newMsgs, ...messages]);
                }

                setTimeout(() => {
                    goToBottom();
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

    const query = useCallback(
        async (message: string, agent: string, files?: Attach[]) => {
            if (!currentSelectedSpace || !sessionID) {
                return;
            }

            message = message.replace(/\n/g, '  \n');

            try {
                const msgID = await GenChatMessageID(currentSelectedSpace, sessionID);
                const resp = await SendMessage(currentSelectedSpace, sessionID, {
                    messageID: msgID,
                    message: message,
                    agent: agent,
                    files: files
                });

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
                setAiTyping(true);

                sessionID && notifySessionReload(sessionID);

                setTimeout(() => {
                    goToBottom();
                }, 500);
            } catch (e: any) {
                console.error(e);
                throw e;
            }
        },
        [currentSelectedSpace, messages]
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
    useEffect(() => {
        async function load() {
            setMessages([]);
            setAiTyping(true);
            const total = await loadData(1);

            if (isNew && total === 0) {
                if (location.state && location.state.messages && location.state.messages.length === 1) {
                    NamedSession(location.state.messages[0].message);
                    setSelectedUseMemory(location.state.agent === 'rag');
                    await query(location.state.messages[0].message, location.state.agent, location.state.files);
                    location.state.messages = undefined;
                }
            } else {
                setAiTyping(false);
            }
        }
        if (currentSelectedSpace) {
            if (!sessionID || (messages && messages.length > 0 && messages[0].spaceID !== currentSelectedSpace)) {
                navigate(`/dashboard/${currentSelectedSpace}/chat`);

                return;
            }
            load();
        }
    }, [currentSelectedSpace, sessionID]);

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

    return (
        <>
            <div className="overflow-hidden w-full h-full flex flex-col relative px-3">
                <main className="h-full w-full relative gap-4 py-3 flex flex-col justify-center items-center">
                    <ScrollShadow ref={ssDom} hideScrollBar className="w-full py-6 flex-grow items-center">
                        <div className="w-full m-auto max-w-[760px] overflow-hidden relative flex flex-col gap-4">
                            {messages.map(({ key, role, message, attach, status, ext }) => (
                                <MessageCard
                                    key={key}
                                    avatar={role === 'assistant' ? <LogoIcon /> : <Avatar src={userAvatar} />}
                                    message={message}
                                    attach={attach}
                                    messageClassName={role === 'user' ? 'bg-content2 text-content2-foreground !py-3 w-full px-3' : 'px-1 w-full'}
                                    // showFeedback={role === 'assistant'}
                                    status={status}
                                    ext={ext}
                                    role={role}
                                    extContent={
                                        role === 'assistant' &&
                                        ext &&
                                        ext.relDocs && (
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
                            ))}
                            {aiTyping && <MessageCard key="aiTyping" isLoading attempts={1} currentAttempt={1} message={''} />}
                        </div>
                        <div className="pb-40" />
                    </ScrollShadow>

                    <div className="mt-auto flex flex-col gap-2 max-w-[760px] w-full">
                        <PromptInputWithEnclosedActions
                            allowAttach={true}
                            classNames={{
                                button: 'bg-default-foreground opacity-100 w-[30px] h-[30px] !min-w-[30px] self-center',
                                buttonIcon: 'text-background',
                                input: 'placeholder:text-default-500'
                            }}
                            placeholder={t('chatToAgent')}
                            selectedUseMemory={selectedUseMemory}
                            onSubmitFunc={query}
                        />
                        <p className="p-2 text-center text-small font-medium leading-5 text-default-500">{t('chatNotice')}</p>
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
