import { Button, Tab, Tabs } from '@heroui/react';
import { Icon } from '@iconify/react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import ProfileSetting from './profile-setting';

//import UserManagement from './user-management';
import { usePlan } from '@/hooks/use-plan';
import SpaceUserSetting from '@/pages/dashboard/space-setting/user-setting';
import spaceStore from '@/stores/space';

const Setting = React.forwardRef<HTMLDivElement, ProfileSettingCardProps>(({ className, space, onClose, ...props }, ref) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const { isPlatform } = usePlan();

    return (
        <div className="w-full flex flex-col items-center">
            <div className="w-full flex-1 p-4">
                {/* Title */}
                <div className="flex items-center gap-x-3">
                    <h1 className="text-2xl font-bold leading-9 text-default-foreground">{t('Space Setting')}</h1>
                </div>
                <h2 className="mt-2 text-small text-default-500">Space Setting.</h2>
                {/*  Tabs */}
                <Tabs
                    fullWidth
                    classNames={{
                        base: 'mt-6',
                        cursor: 'bg-content1 dark:bg-content1',
                        panel: 'w-full p-0 pt-4'
                    }}
                >
                    <Tab key="profile" title={t('Setting')}>
                        {space && <ProfileSetting space={space} onClose={onClose} />}
                    </Tab>
                    <Tab key="appearance" title={t('UserManage')}>
                        {/* <UserManagement /> */}
                        <SpaceUserSetting />
                    </Tab>
                </Tabs>
            </div>
        </div>
    );
});

Setting.displayName = 'Setting';

export default Setting;
