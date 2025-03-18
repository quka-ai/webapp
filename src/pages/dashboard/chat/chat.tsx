import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import PromptInputWithEnclosedActions from './prompt-input-with-enclosed-actions';

import { CreateChatSession } from '@/apis/chat';
import { LogoIcon, Name } from '@/components/logo';
import spaceStore from '@/stores/space';

export default function Chat() {
    const navigate = useNavigate();
    const { currentSelectedSpace } = useSnapshot(spaceStore);

    const onSubmit = useCallback<(msg: string, agent: string, files?: Attach[]) => Promise<void>>(
        async (message: string, agent: string, files?: Attach[]) => {
            if (!currentSelectedSpace) {
                throw new Error('uninited');
            }

            message = message.replace(/\n/g, '  \n');
            // create new session
            try {
                const sessionID = await CreateChatSession(currentSelectedSpace);

                navigate(`/dashboard/${currentSelectedSpace}/chat/session/${sessionID}?isNew=true`, {
                    state: {
                        messages: [
                            {
                                role: 'user',
                                message: message,
                                key: 1
                            }
                        ],
                        agent: agent,
                        files: files
                    }
                });
            } catch (e: any) {
                throw e;
                console.error(e);
            }
        },
        [currentSelectedSpace]
    );

    const { t } = useTranslation();

    return (
        <div className="w-full h-full flex justify-center">
            <div className="flex w-full h-full flex-col px-4 sm:max-w-[760px] justify-center">
                <div className="flex h-full flex-col items-center justify-center gap-10">
                    <div className="flex rounded-full items-center">
                        <LogoIcon size={60} />
                    </div>
                    <div className="flex flex-col w-full">
                        <PromptInputWithEnclosedActions
                            allowAttach={true}
                            classNames={{
                                button: 'bg-default-foreground opacity-100 w-[30px] h-[30px] !min-w-[30px] self-center',
                                buttonIcon: 'text-background',
                                input: 'placeholder:text-default-500'
                            }}
                            placeholder={t('chatToAgent')}
                            onSubmitFunc={onSubmit}
                        />
                        <p className="p-2 text-center text-small font-medium leading-5 text-default-500">{t('chatNotice')}</p>
                    </div>
                </div>
                <div className="mt-auto flex max-w-full flex-col gap-2" />
            </div>
        </div>
    );
}
