import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { type HermesInteractionRequest, type HermesInteractionResolveRequest, ResolveHermesInteraction, SubscribeHermesInteraction } from '@/apis/hermes-desktop';

export function HermesInteractionModal() {
    const { t } = useTranslation();
    const [queue, setQueue] = React.useState<HermesInteractionRequest[]>([]);
    const [password, setPassword] = React.useState('');
    const [isResolving, setIsResolving] = React.useState(false);

    const active = queue[0];
    const isSudoPrompt = active?.kind === 'sudo_password';

    React.useEffect(() => {
        return SubscribeHermesInteraction(event => {
            if (!event?.request_id) {
                return;
            }
            setQueue(prev => {
                if (prev.some(item => item.request_id === event.request_id)) {
                    return prev;
                }
                return [...prev, event];
            });
        });
    }, []);

    React.useEffect(() => {
        setPassword('');
        setIsResolving(false);
    }, [active?.request_id]);

    const resolveActive = React.useCallback(
        async (action: HermesInteractionResolveRequest['action'], value = '') => {
            if (!active || isResolving) {
                return;
            }
            setIsResolving(true);
            try {
                await ResolveHermesInteraction({
                    request_id: active.request_id,
                    action,
                    value
                });
            } catch (error) {
                console.error('[hermes] failed to resolve interaction', error);
                toast.error(t('Hermes interaction failed'));
            } finally {
                setQueue(prev => prev.filter(item => item.request_id !== active.request_id));
                setIsResolving(false);
                setPassword('');
            }
        },
        [active, isResolving, t]
    );

    const denyAction: HermesInteractionResolveRequest['action'] = isSudoPrompt ? 'cancel' : 'deny';

    return (
        <Modal backdrop="blur" isDismissable={false} isKeyboardDismissDisabled={true} isOpen={Boolean(active)} placement="center" size="2xl" onClose={() => resolveActive(denyAction)}>
            <ModalContent>
                {active && (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            <span>{t(isSudoPrompt ? 'Hermes sudo confirmation' : 'Hermes command confirmation')}</span>
                            {queue.length > 1 && <span className="text-xs font-normal text-default-500">{t('Hermes pending confirmations', { count: queue.length })}</span>}
                        </ModalHeader>
                        <ModalBody className="gap-4">
                            <div className="text-sm text-default-600">{isSudoPrompt ? active.message || t('Hermes needs your confirmation') : t('Hermes command confirmation description')}</div>
                            {isSudoPrompt ? (
                                <Input
                                    autoFocus
                                    autoComplete="current-password"
                                    label={t('Password')}
                                    type="password"
                                    value={password}
                                    onChange={event => setPassword(event.target.value)}
                                    onKeyDown={event => {
                                        if (event.key === 'Enter' && password && !isResolving) {
                                            resolveActive('submit', password);
                                        }
                                    }}
                                />
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {(active.explanation || active.description) && (
                                        <div>
                                            <div className="mb-1 text-xs font-medium uppercase text-default-500">{t('What Hermes will do')}</div>
                                            <div className="whitespace-pre-wrap rounded-md border border-default-200 bg-default-50 px-3 py-2 text-sm leading-6 text-default-700 dark:bg-default-100/10">
                                                {active.explanation || active.description}
                                            </div>
                                        </div>
                                    )}
                                    {active.description && (
                                        <details className="rounded-md border border-default-200 bg-default-50 px-3 py-2 text-sm text-default-600 dark:bg-default-100/10">
                                            <summary className="cursor-pointer select-none text-xs font-medium uppercase text-default-500">{t('Technical risk details')}</summary>
                                            <div className="mt-2 leading-5">{active.description}</div>
                                        </details>
                                    )}
                                    {active.command && (
                                        <div>
                                            <div className="mb-1 text-xs font-medium uppercase text-default-500">{t('Command')}</div>
                                            <pre className="max-h-72 overflow-auto rounded-md border border-default-200 bg-default-100 px-3 py-2 text-xs leading-5 text-default-800 dark:bg-default-100/10">
                                                {active.command}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}
                        </ModalBody>
                        <ModalFooter className="flex flex-wrap justify-end gap-2">
                            {isSudoPrompt ? (
                                <>
                                    <Button variant="flat" onPress={() => resolveActive('cancel')}>
                                        {t('Cancel')}
                                    </Button>
                                    <Button color="primary" isDisabled={!password} isLoading={isResolving} onPress={() => resolveActive('submit', password)}>
                                        {t('Confirm')}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button color="danger" variant="flat" onPress={() => resolveActive('deny')}>
                                        {t('Deny')}
                                    </Button>
                                    <Button variant="flat" isLoading={isResolving} onPress={() => resolveActive('approve_once')}>
                                        {t('Allow Once')}
                                    </Button>
                                    <Button color="primary" variant="flat" isLoading={isResolving} onPress={() => resolveActive('approve_session')}>
                                        {t('Allow This Session')}
                                    </Button>
                                    {active.allow_permanent && (
                                        <Button color="primary" isLoading={isResolving} onPress={() => resolveActive('approve_always')}>
                                            {t('Always Allow')}
                                        </Button>
                                    )}
                                </>
                            )}
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
