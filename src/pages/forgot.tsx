import { Alert, Button, Checkbox, Input, Link } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { RequestResetPassword } from '@/apis/user';
import { LogoIcon, Name } from '@/components/logo';

export default function Component() {
    const [email, setEmail] = useState('');
    const [isEmailValid, setIsEmailValid] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const { t } = useTranslation();

    const navigate = useNavigate();

    const requestReset = async () => {
        setIsEmailValid(true);
        try {
            if (!email) {
                setIsEmailValid(false);
                return;
            }
            setIsLoading(true);
            await RequestResetPassword(`${window.location.origin}/reset/password`, email);
            setIsSuccess(true);
        } catch (e: any) {
            console.error(e);
        }
        setIsLoading(false);
    };

    return (
        <div className="flex flex-col h-screen w-full items-center justify-center">
            <div className="flex gap-4 w-full max-w-sm px-8 items-start justify-start">
                <Button
                    isIconOnly
                    size="sm"
                    variant="bordered"
                    onPress={() => {
                        navigate('/login');
                    }}
                >
                    <Icon className="text-default-500" icon="solar:alt-arrow-left-linear" width={16} />
                </Button>
                <div className="flex gap-2 justify-center items-center">
                    <LogoIcon size={32} />
                    {Name}
                </div>
            </div>
            {isSuccess ? (
                <div className="flex w-full max-w-sm flex-col gap-4 rounded-large px-6 pb-10 pt-6">
                    <Alert color="success" title={t('Success')} description={t('ResetEmailSended')} variant="faded" />
                </div>
            ) : (
                <div className="flex w-full max-w-sm flex-col gap-4 rounded-large px-8 pb-10 pt-6">
                    <p className="pb-4 text-left text-3xl font-semibold">
                        {t('Forgot Password')}
                        <span aria-label="emoji" className="ml-2" role="img">
                            👋
                        </span>
                    </p>
                    <div className="flex flex-col gap-4">
                        <Input
                            isRequired
                            label={t('Email Address')}
                            isInvalid={!isEmailValid}
                            labelPlacement="outside"
                            name="email"
                            placeholder="Enter your email"
                            type="email"
                            variant="bordered"
                            onValueChange={setEmail}
                        />
                        <div className="flex w-full items-center justify-between px-1 py-2"></div>
                        <Button className="w-full" color="primary" isLoading={isLoading} isDisabled={!email} onPress={requestReset}>
                            {t('ResetPassword')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
