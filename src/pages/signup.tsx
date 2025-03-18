import { Button, Input, Tooltip } from '@heroui/react';
import { Icon } from '@iconify/react';
import axios from 'axios';
import { AnimatePresence, domAnimation, LazyMotion, m } from 'framer-motion';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useImmer } from 'use-immer';

import { SendVerifyEmail, Signup } from '@/apis/user';
import { md5 } from '@/lib/utils';

export default function Component({ changeMode }: { changeMode: (v: string) => void }) {
    const { t } = useTranslation();

    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
    const [email, setEmail] = useState('');
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');
    const [verifyCode, setVerifyCode] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [[page, direction], setPage] = useState([0, 0]);
    const [isEmailValid, setIsEmailValid] = useState('');
    const [isUserNameValid, setIsUserNameValid] = useState('');
    const [isPasswordValid, setIsPasswordValid] = useState('');
    const [isConfirmPasswordValid, setIsConfirmPasswordValid] = useState('');
    const [isVerifyCodeValid, setIsVerifyCodeValid] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [spaceName, setSpaceName] = useState(t('MainSpace'));
    const [isSpaceNameValid, setIsSpaceNameValid] = useState('');

    const togglePasswordVisibility = () => setIsPasswordVisible(!isPasswordVisible);
    const toggleConfirmPasswordVisibility = () => setIsConfirmPasswordVisible(!isConfirmPasswordVisible);

    const Title = useCallback(
        (props: React.PropsWithChildren<{}>) => (
            <m.h1 animate={{ opacity: 1, x: 0 }} className="text-xl font-medium" exit={{ opacity: 0, x: -10 }} initial={{ opacity: 0, x: -10 }}>
                {props.children}
            </m.h1>
        ),
        [page]
    );

    const titleContent = useMemo(() => {
        return page === 0 ? t('SignUp') : page === 1 ? t('Enter Password') : t('Verify Code');
    }, [page]);

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 50 : -50,
            opacity: 0
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 50 : -50,
            opacity: 0
        })
    };

    const paginate = (newDirection: number) => {
        setPage([page + newDirection, newDirection]);
    };

    const handleUserBaseSubmit = () => {
        if (!userName.length || userName.length > 30) {
            setIsUserNameValid(t('length between', { min: 0, max: 30 }));

            return;
        }
        setIsUserNameValid('');

        if (!spaceName.length || spaceName.length > 30) {
            setIsSpaceNameValid(t('length between', { min: 0, max: 30 }));

            return;
        }
        setIsSpaceNameValid('');

        paginate(1);
    };

    const [isSendVerifyEmail, setIsSendVerifyEmail] = useState();
    const handlePasswordSubmit = async () => {
        if (!email.length) {
            setIsEmailValid(t('InvalidEmail'));

            return;
        }
        setIsEmailValid('');

        if (!password.length) {
            setIsPasswordValid(false);

            return;
        }

        if (!confirmPassword.length || confirmPassword !== password) {
            setIsConfirmPasswordValid(t('Passwords do not match'));

            return;
        }
        setIsConfirmPasswordValid('');
        setIsPasswordValid('');

        // Submit logic or API call here
        if (isSendVerifyEmail) {
            paginate(1);

            return;
        }

        sendVerifyEmail(email)
            .then(res => {
                toast.success(t('Notify'), {
                    description: t('Please check your email for the verification code')
                });
                paginate(1);
            })
            .finally(res => {
                setIsLoading(false);
            });
    };

    const [resendEmailGap, setResendEmailGap] = useImmer(120);

    const sendVerifyEmail = useCallback(
        async (email: string) => {
            if (isSendVerifyEmail) {
                return;
            }
            setIsSendVerifyEmail(true);
            setIsLoading(true);
            try {
                await SendVerifyEmail(email);
                toast.success(t('Notify'), {
                    description: t('Please check your email for the verification code')
                });
                setResendEmailGap(120);
                let resendEmailGap = 120;
                let interval = setInterval(() => {
                    if (resendEmailGap > 1) {
                        resendEmailGap -= 1;
                        setResendEmailGap(resendEmailGap);
                    } else {
                        setIsSendVerifyEmail(false);
                        setResendEmailGap(0);
                        clearInterval(interval);
                    }
                }, 1000);
            } catch (e: any) {
                console.error(e);
            }

            setIsLoading(false);
        },
        [resendEmailGap, isSendVerifyEmail]
    );
    const ResendEmail = useMemo(() => {
        if (isSendVerifyEmail) {
            return <span className="text-sm dark:text-zinc-300 text-zinc-600">{t('ResendEmailAfter', { seconds: resendEmailGap })}</span>;
        } else if (resendEmailGap === 0) {
            return (
                <span
                    className="text-sm text-primary cursor-pointer"
                    onClick={() => {
                        sendVerifyEmail(email);
                    }}
                >
                    {t('ResendEmail')}
                </span>
            );
        }
        return <span></span>;
    }, [isSendVerifyEmail, email, resendEmailGap]);

    const handleSignUpSubmit = async () => {
        if (verifyCode === '') {
            setIsVerifyCodeValid(t('NotEmpty'));
            return;
        }
        setIsVerifyCodeValid('');

        setIsLoading(true);
        try {
            await Signup(email, userName, spaceName, md5(password), verifyCode);
            toast.success(t('Notify'), {
                description: t('Welcome to signup')
            });
            changeMode('login');
        } catch (e: any) {
            if (axios.isAxiosError(e) && (e.status === 400 || e.status === 403)) {
                setIsVerifyCodeValid(t('VerificationCodeError'));
            }
            console.error(e);
        }
        setIsLoading(false);
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        switch (page) {
            case 0:
                handleUserBaseSubmit();
                break;
            case 1:
                handlePasswordSubmit();
                break;
            case 2:
                handleSignUpSubmit();
                break;
            default:
                break;
        }
    };

    return (
        <div className="flex w-full max-w-sm flex-col gap-4 rounded-large bg-content1 p-6 shadow-small">
            <LazyMotion features={domAnimation}>
                <m.div className="flex min-h-[40px] items-center gap-2 pb-2">
                    <AnimatePresence initial={false} mode="popLayout">
                        {page >= 1 && (
                            <m.div animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} initial={{ opacity: 0, x: -10 }}>
                                <Tooltip content="Go back" delay={3000}>
                                    <Button isIconOnly size="sm" variant="flat" onPress={() => paginate(-1)}>
                                        <Icon className="text-default-500" icon="solar:alt-arrow-left-linear" width={16} />
                                    </Button>
                                </Tooltip>
                            </m.div>
                        )}
                    </AnimatePresence>
                    <AnimatePresence custom={direction} initial={false} mode="wait">
                        <Title>{titleContent}</Title>
                    </AnimatePresence>
                </m.div>
                <AnimatePresence custom={direction} initial={false} mode="wait">
                    <m.form
                        key={page}
                        animate="center"
                        className="flex flex-col gap-3"
                        custom={direction}
                        exit="exit"
                        initial="enter"
                        transition={{ duration: 0.2 }}
                        variants={variants}
                        onSubmit={handleSubmit}
                    >
                        {page === 0 && (
                            <>
                                <Input
                                    autoFocus
                                    isRequired
                                    label={t('UserName')}
                                    name="username"
                                    placeholder="Enter your user name"
                                    type="text"
                                    variant="bordered"
                                    isInvalid={isUserNameValid !== ''}
                                    errorMessage={isUserNameValid}
                                    value={userName}
                                    validationBehavior="aria"
                                    onValueChange={value => {
                                        setIsUserNameValid('');
                                        setUserName(value);
                                    }}
                                />

                                <Input
                                    isRequired
                                    label={t('DefaultSpaceName')}
                                    name="username"
                                    placeholder="Enter your first space name"
                                    type="text"
                                    variant="bordered"
                                    isInvalid={isSpaceNameValid !== ''}
                                    errorMessage={isSpaceNameValid}
                                    value={spaceName}
                                    onValueChange={value => {
                                        setIsSpaceNameValid('');
                                        setSpaceName(value);
                                    }}
                                />
                            </>
                        )}
                        {page === 1 && (
                            <>
                                <Input
                                    autoFocus
                                    isRequired
                                    label={t('Email Address')}
                                    name="email"
                                    placeholder="Enter your email"
                                    type="email"
                                    variant="bordered"
                                    isInvalid={isEmailValid !== ''}
                                    errorMessage={isEmailValid}
                                    value={email}
                                    onValueChange={value => {
                                        setIsEmailValid('');
                                        setEmail(value);
                                    }}
                                />
                                <Input
                                    isRequired
                                    endContent={
                                        <button type="button" onClick={togglePasswordVisibility}>
                                            {isPasswordVisible ? (
                                                <Icon className="pointer-events-none text-2xl text-default-400" icon="solar:eye-closed-linear" />
                                            ) : (
                                                <Icon className="pointer-events-none text-2xl text-default-400" icon="solar:eye-bold" />
                                            )}
                                        </button>
                                    }
                                    label={t('Password')}
                                    name="password"
                                    variant="bordered"
                                    type={isPasswordVisible ? 'text' : 'password'}
                                    isInvalid={isPasswordValid !== ''}
                                    errorMessage={isPasswordValid}
                                    value={password}
                                    onValueChange={value => {
                                        setIsPasswordValid('');
                                        setPassword(value);
                                    }}
                                />

                                <Input
                                    isRequired
                                    endContent={
                                        <button type="button" onClick={toggleConfirmPasswordVisibility}>
                                            {isConfirmPasswordVisible ? (
                                                <Icon className="pointer-events-none text-2xl text-default-400" icon="solar:eye-closed-linear" />
                                            ) : (
                                                <Icon className="pointer-events-none text-2xl text-default-400" icon="solar:eye-bold" />
                                            )}
                                        </button>
                                    }
                                    variant="bordered"
                                    label={t('Confirm Password')}
                                    name="confirmPassword"
                                    type={isConfirmPasswordVisible ? 'text' : 'password'}
                                    isInvalid={isConfirmPasswordValid !== ''}
                                    errorMessage={isConfirmPasswordValid}
                                    value={confirmPassword}
                                    onValueChange={value => {
                                        setIsConfirmPasswordValid('');
                                        setConfirmPassword(value);
                                    }}
                                />
                            </>
                        )}
                        {page === 2 && (
                            <>
                                <Input
                                    autoFocus
                                    isRequired
                                    label={t('Verify Code')}
                                    name="verifyCode"
                                    variant="bordered"
                                    type="text"
                                    isInvalid={isVerifyCodeValid !== ''}
                                    errorMessage={isVerifyCodeValid}
                                    value={verifyCode}
                                    onValueChange={value => {
                                        setIsVerifyCodeValid('');
                                        setVerifyCode(value);
                                    }}
                                />
                                <span className="text-sm dark:text-zinc-300 text-zinc-600">{t('Please check your email for the verification code')}</span>
                            </>
                        )}
                        {ResendEmail}
                        <Button fullWidth color="primary" type="submit" className="mt-6" isLoading={isLoading}>
                            {page === 0 ? t('Continue') : page === 1 ? t('Enter Password') : t('SignUp')}
                        </Button>
                    </m.form>
                </AnimatePresence>
            </LazyMotion>
            <p className="text-center text-small">
                {t('Already have an account')}&nbsp;
                <span className="text-blue-500 cursor-pointer" onClick={() => changeMode('login')} onKeyDown={() => changeMode('login')}>
                    {t('LogIn')}
                </span>
            </p>
        </div>
    );
}
