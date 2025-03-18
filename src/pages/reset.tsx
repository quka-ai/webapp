import { Icon } from '@iconify/react';
import { Alert, Button, Checkbox, Input, Link } from "@heroui/react";
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { ResetPassword } from '@/apis/user';
import { md5 } from '@/lib/utils';

export default function Component() {
    const [isVisible, setIsVisible] = useState(false);
    const [isConfirmVisible, setIsConfirmVisible] = useState(false);
    const { token } = useParams();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [notice, setNotice] = useState('');
    const [isConfirmPasswordValid, setIsConfirmPasswordValid] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const { t } = useTranslation();

    const navigate = useNavigate();

    const toggleVisibility = () => setIsVisible(!isVisible);
    const toggleConfirmVisibility = () => setIsConfirmVisible(!isConfirmVisible);

    const resetPassword = async () => {
        setIsConfirmPasswordValid(true);
        try {
            if (password !== confirmPassword) {
                setIsConfirmPasswordValid(false);
                return;
            }
            setIsLoading(true);
            await ResetPassword(token, md5(password));
            setIsSuccess(true);
        } catch (e: any) {
            console.error(e);
        }
        setIsLoading(false);
    };

    return (
        <div className="flex h-screen w-full items-center justify-center">
            {isSuccess ? (
                <div className="w-[300px] flex flex-col gap-6">
                    <Alert color="success" title={t('Success')} variant="faded" />
                    <Button
                        className="w-full"
                        color="primary"
                        onPress={() => {
                            navigate('/login');
                        }}
                    >
                        {t('LogIn')}
                    </Button>
                </div>
            ) : (
                <div className="flex w-full max-w-sm flex-col gap-4 rounded-large px-8 pb-10 pt-6">
                    <p className="pb-4 text-left text-3xl font-semibold">
                        {t('ResetPassword')}
                        <span aria-label="emoji" className="ml-2" role="img">
                            👋
                        </span>
                    </p>
                    <div className="flex flex-col gap-4" validationbehavior="native">
                        <Input
                            isRequired
                            endContent={
                                <button type="button" onClick={toggleVisibility}>
                                    {isVisible ? (
                                        <Icon className="pointer-events-none text-2xl text-default-400" icon="solar:eye-closed-linear" />
                                    ) : (
                                        <Icon className="pointer-events-none text-2xl text-default-400" icon="solar:eye-bold" />
                                    )}
                                </button>
                            }
                            label={t('Password')}
                            labelPlacement="outside"
                            name="password"
                            placeholder="Enter your password"
                            type={isVisible ? 'text' : 'password'}
                            variant="bordered"
                            onValueChange={setPassword}
                        />
                        <Input
                            isRequired
                            endContent={
                                <button type="button" onClick={toggleConfirmVisibility}>
                                    {isConfirmVisible ? (
                                        <Icon className="pointer-events-none text-2xl text-default-400" icon="solar:eye-closed-linear" />
                                    ) : (
                                        <Icon className="pointer-events-none text-2xl text-default-400" icon="solar:eye-bold" />
                                    )}
                                </button>
                            }
                            validationState={isConfirmPasswordValid ? 'valid' : 'invalid'}
                            errorMessage={!isConfirmPasswordValid ? t('Passwords do not match') : undefined}
                            label={t('Confirm Password')}
                            labelPlacement="outside"
                            name="password"
                            placeholder="Confirm your password"
                            type={isConfirmVisible ? 'text' : 'password'}
                            variant="bordered"
                            onValueChange={setConfirmPassword}
                        />
                        <div className="flex w-full items-center justify-between px-1 py-2">{notice}</div>
                        <Button className="w-full" color="primary" isLoading={isLoading} isDisabled={!confirmPassword} onPress={resetPassword}>
                            {t('Submit')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
