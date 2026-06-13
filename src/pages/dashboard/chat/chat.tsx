import { Button, Modal, ModalBody, ModalContent, ModalHeader, useDisclosure } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import PromptInputWithEnclosedActions from './prompt-input-with-enclosed-actions';
import HermesStatusIndicator from './hermes-status-indicator';

import { CreateChatSession } from '@/apis/chat';
import { HasHermesProviderConfigured, ensureHermesAgentConfigured, isHermesDesktopAvailable, ListHermesAgents, type HermesAgentProfile } from '@/apis/hermes-desktop';
import { LogoIcon } from '@/components/logo';
import { getHermesAgentMentionOptions } from '@/lib/hermes-agent-mentions';
import HermesAgentsSetting from '@/pages/dashboard/setting/hermes-agents-setting';
import HermesProviderSetting from '@/pages/dashboard/setting/hermes-provider-setting';
import HermesSkillsSetting from '@/pages/dashboard/setting/hermes-skills-setting';
import spaceStore from '@/stores/space';

export default function Chat() {
    const navigate = useNavigate();
    const { currentSelectedSpace } = useSnapshot(spaceStore);
    const [isLoading, setIsLoading] = useState(false);
    const [providerConfigured, setProviderConfigured] = useState<boolean>(() => !isHermesDesktopAvailable());
    const { isOpen: isProviderSettingOpen, onOpen: openProviderSetting, onClose: closeProviderSetting, onOpenChange: onProviderSettingOpenChange } = useDisclosure();
    const { isOpen: isSkillsSettingOpen, onOpen: openSkillsSetting, onClose: closeSkillsSetting, onOpenChange: onSkillsSettingOpenChange } = useDisclosure();
    const { isOpen: isAgentsSettingOpen, onOpen: openAgentsSetting, onClose: closeAgentsSetting, onOpenChange: onAgentsSettingOpenChange } = useDisclosure();
    const desktopMode = isHermesDesktopAvailable();
    const [hermesAgentProfiles, setHermesAgentProfiles] = useState<HermesAgentProfile[]>([]);

    useEffect(() => {
        if (!desktopMode) {
            setProviderConfigured(true);
            return;
        }

        HasHermesProviderConfigured().then(setProviderConfigured).catch(error => {
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

    useEffect(() => {
        if (!desktopMode || !providerConfigured) {
            setHermesAgentProfiles([]);
            return;
        }

        ListHermesAgents()
            .then(list => setHermesAgentProfiles(list.profiles))
            .catch(error => {
                console.error('Failed to load Hermes agents:', error);
                setHermesAgentProfiles([]);
            });
    }, [desktopMode, providerConfigured, isAgentsSettingOpen]);

    const handleProviderConfigured = useCallback(() => {
        setProviderConfigured(true);
        closeProviderSetting();
        if (currentSelectedSpace) {
            ensureHermesAgentConfigured(currentSelectedSpace).catch(error => {
                console.error('Failed to start Hermes Agent:', error);
            });
        }
    }, [closeProviderSetting, currentSelectedSpace]);

    const onSubmit = useCallback<(msg: string, agent: string, args: ChatArgs, files?: Attach[]) => Promise<void>>(
        async (message: string, agent: string, args: ChatArgs, files?: Attach[]) => {
            if (!currentSelectedSpace) {
                throw new Error('uninited');
            }
            setIsLoading(true);

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
                        args: args,
                        files: files,
                        hermesAgentProfiles: hermesAgentProfiles
                    }
                });
            } catch (e: any) {
                console.error(e);
                throw e;
            }
            setIsLoading(false);
        },
        [currentSelectedSpace, hermesAgentProfiles]
    );

    const { t } = useTranslation();

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
        <div className="overflow-hidden w-full h-full flex justify-center">
            {desktopMode && (
                <>
                    <div className="pointer-events-none absolute right-4 top-4 z-50 flex items-center gap-2">
                        <HermesStatusIndicator className="pointer-events-auto" />
                        <Button isIconOnly className="pointer-events-auto" variant="light" aria-label={t('Hermes Agents')} onClick={openAgentsSetting} onPress={openAgentsSetting}>
                            <Icon icon="material-symbols:account-tree-outline-rounded" width={22} />
                        </Button>
                        <Button isIconOnly className="pointer-events-auto" variant="light" aria-label={t('Hermes Skills')} onClick={openSkillsSetting} onPress={openSkillsSetting}>
                            <Icon icon="material-symbols:extension-rounded" width={22} />
                        </Button>
                        <Button isIconOnly className="pointer-events-auto" variant="light" aria-label={t('Hermes Provider Settings')} onClick={openProviderSetting} onPress={openProviderSetting}>
                            <Icon icon="material-symbols:settings-rounded" width={22} />
                        </Button>
                    </div>
                    <Modal backdrop="blur" isOpen={isProviderSettingOpen} placement="center" scrollBehavior="inside" onClose={closeProviderSetting} onOpenChange={onProviderSettingOpenChange}>
                        <ModalContent>
                            <ModalHeader>{t('Hermes Settings')}</ModalHeader>
                            <ModalBody className="pb-6">
                                <HermesProviderSetting onConfigured={handleProviderConfigured} />
                            </ModalBody>
                        </ModalContent>
                    </Modal>
                    <Modal backdrop="blur" isOpen={isSkillsSettingOpen} size="3xl" placement="center" scrollBehavior="inside" onClose={closeSkillsSetting} onOpenChange={onSkillsSettingOpenChange}>
                        <ModalContent>
                            <ModalHeader>{t('Hermes Skills')}</ModalHeader>
                            <ModalBody className="pb-6">
                                <HermesSkillsSetting />
                            </ModalBody>
                        </ModalContent>
                    </Modal>
                    <Modal backdrop="blur" isOpen={isAgentsSettingOpen} size="5xl" placement="center" scrollBehavior="inside" onClose={closeAgentsSetting} onOpenChange={onAgentsSettingOpenChange}>
                        <ModalContent>
                            <ModalHeader>{t('Hermes Agents')}</ModalHeader>
                            <ModalBody className="overflow-hidden pb-6">
                                <HermesAgentsSetting />
                            </ModalBody>
                        </ModalContent>
                    </Modal>
                </>
            )}
            <div className="flex w-full h-full flex-col px-4 sm:max-w-[760px] justify-center">
                <div className="flex h-full flex-col items-center justify-center gap-10">
                    <div className="flex rounded-full items-center">
                        <LogoIcon size={60} />
                    </div>
                    <div className="flex flex-col w-full">
                        <PromptInputWithEnclosedActions
                            autoFocus={true}
                            allowAttach={true}
                            agentMentionOptions={desktopMode ? getHermesAgentMentionOptions(hermesAgentProfiles) : undefined}
                            hideFeatureControls={desktopMode}
                            isLoading={isLoading}
                            classNames={{
                                button: 'bg-default-foreground opacity-100 w-[30px] h-[30px] !min-w-[30px] self-center',
                                buttonIcon: 'text-background',
                                input: 'placeholder:text-default-500'
                            }}
                            placeholder={t('chatToAgent')}
                            onSubmitFunc={onSubmit}
                        />
                        <p className="py-2 text-center text-small font-medium leading-5 text-default-500">{t('chatNotice')}</p>
                    </div>
                </div>
                <div className="mt-auto flex max-w-full flex-col gap-2" />
            </div>
        </div>
    );
}
