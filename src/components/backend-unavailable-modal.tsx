import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import instance from '@/apis/request';
import backendAvailabilityStore, { clearBackendUnavailable } from '@/stores/backend-availability';
import { setLoginRedirect } from '@/stores/event';
import { setCurrentSelectedSpace, setUserSpaces } from '@/stores/space';
import userStore, { logout } from '@/stores/user';

export function BackendUnavailableModal() {
    const { t } = useTranslation('backend-availability');
    const { unavailable } = useSnapshot(backendAvailabilityStore);
    const [retrying, setRetrying] = useState(false);
    const [retryFailed, setRetryFailed] = useState(false);
    const navigate = useNavigate();

    async function retry() {
        setRetrying(true);
        setRetryFailed(false);
        try {
            // 只探测服务状态，不重放可能产生副作用的失败请求。
            const response = await instance.get('/user/info', { validateStatus: () => true, timeout: 10000 });
            if (response.status === 401 || response.status === 403) {
                if (userStore.accessToken || userStore.loginToken) {
                    returnToLogin();
                } else {
                    clearBackendUnavailable();
                }
                return;
            }
            if (response.status < 200 || response.status >= 300) {
                setRetryFailed(true);
                return;
            }
            clearBackendUnavailable();
            if (userStore.accessToken || userStore.loginToken) {
                window.location.reload();
            }
        } catch {
            setRetryFailed(true);
        } finally {
            setRetrying(false);
        }
    }

    function returnToLogin() {
        logout();
        setCurrentSelectedSpace('');
        setUserSpaces([]);
        setLoginRedirect('');
        setRetryFailed(false);
        navigate('/login', { replace: true, state: { configureHost: true } });
    }

    return (
        <Modal backdrop="blur" isDismissable={false} isKeyboardDismissDisabled isOpen={unavailable} placement="center">
            <ModalContent>
                <ModalHeader>{t('title')}</ModalHeader>
                <ModalBody>
                    <p>{t('description')}</p>
                    {retryFailed && <p className="text-sm text-danger">{t('retryFailed')}</p>}
                </ModalBody>
                <ModalFooter>
                    <Button variant="flat" onPress={returnToLogin} isDisabled={retrying}>{t('returnToLogin')}</Button>
                    <Button color="primary" onPress={retry} isLoading={retrying}>{t('retry')}</Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
