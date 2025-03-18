import { Button, Tab, Tabs } from '@heroui/react';
import { Icon } from '@iconify/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import AppearanceSetting from './appearance-setting';
import BillingSetting from './billing-setting';
import ProfileSetting from './profile-setting';
import SecretSetting from './secret-setting';

import { usePlan } from '@/hooks/use-plan';

const Setting = React.forwardRef<HTMLDivElement, ProfileSettingCardProps>(({ className, ...props }, ref) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    function back() {
        if (window.history.length > 1) {
            navigate(-1);

            return;
        }
        navigate('/dashboard');
    }

    const { isPlatform } = usePlan();

    return (
        <div className="w-full flex flex-col items-center">
            <div className="w-full p-4 box-border">
                <Button startContent={<Icon icon="material-symbols:arrow-back-ios-rounded" />} variant="bordered" onPress={back}>
                    {t('Back')}
                </Button>
            </div>
            <div className="w-full max-w-2xl flex-1 p-4">
                {/* Title */}
                <div className="flex items-center gap-x-3">
                    <h1 className="text-3xl font-bold leading-9 text-default-foreground">{t('Setting')}</h1>
                </div>
                <h2 className="mt-2 text-small text-default-500">Customize settings, email preferences, and web appearance.</h2>
                {/*  Tabs */}
                <Tabs
                    fullWidth
                    classNames={{
                        base: 'mt-6',
                        cursor: 'bg-content1 dark:bg-content1',
                        panel: 'w-full p-0 pt-4'
                    }}
                >
                    <Tab key="profile" title={t('Profile')}>
                        <ProfileSetting />
                    </Tab>
                    <Tab key="appearance" title={t('Appearance')}>
                        <AppearanceSetting />
                    </Tab>
                    {isPlatform && (
                        <Tab key="billing" title={t('Billing')}>
                            <BillingSetting />
                        </Tab>
                    )}
                    <Tab key="secret" title={t('Secret')}>
                        <SecretSetting />
                    </Tab>
                </Tabs>
            </div>
        </div>
    );
});

Setting.displayName = 'Setting';

export default Setting;
