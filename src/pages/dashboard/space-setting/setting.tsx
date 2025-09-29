import { Button, Tab, Tabs } from '@heroui/react';
import { Icon } from '@iconify/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import ProfileSetting from './profile-setting';
import SpaceUserApplications from './user-applications';

import { CreateSpaceShareURL } from '@/apis/share';
import ShareButton from '@/components/share-button';
import { useRole } from '@/hooks/use-role';
//import UserManagement from './user-management';
import SpaceUserSetting from '@/pages/dashboard/space-setting/user-setting';
import spaceStore from '@/stores/space';

export interface SpaceSettingCardProps {
    onClose?: () => void;
}

const Setting = React.forwardRef<HTMLDivElement, SpaceSettingCardProps>(({ onClose, ...props }, ref) => {
    const { t } = useTranslation();
    const { t: tSpaceSetting } = useTranslation('space-setting');
    const { currentSelectedSpace } = useSnapshot(spaceStore);
    const navigate = useNavigate();

    function back() {
        if (window.history.length > 1) {
            navigate(-1);

            return;
        }
        navigate('/dashboard');
    }

    const { isManager } = useRole();

    return (
        <div className="w-full flex flex-col items-center">
            <div className="w-full p-4 box-border flex justify-between items-center">
                <Button startContent={<Icon icon="material-symbols:arrow-back-ios-rounded" />} variant="bordered" onPress={back}>
                    {t('Back')}
                </Button>

                <ShareButton
                    text={tSpaceSetting('ShareButton')}
                    genUrlFunc={async () => {
                        try {
                            const res = await CreateSpaceShareURL(currentSelectedSpace, window.location.origin + '/s/sp/{token}');
                            return res.url;
                        } catch (e: any) {
                            console.error(e);
                            throw e;
                        }
                    }}
                />
            </div>
            <div className="w-full max-w-2xl flex-1 p-4">
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
                        <ProfileSetting onClose={onClose} />
                    </Tab>
                    {isManager && (
                        <>
                            <Tab key="appearance" title={t('UserManage')}>
                                {/* <UserManagement /> */}
                                <SpaceUserSetting />
                            </Tab>
                            <Tab key="invite" title={tSpaceSetting('UserApplication')}>
                                {/* <UserManagement /> */}
                                <SpaceUserApplications />
                            </Tab>
                        </>
                    )}
                </Tabs>
            </div>
        </div>
    );
});

Setting.displayName = 'Setting';

export default Setting;
