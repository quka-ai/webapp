import { Button } from '@heroui/react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnapshot } from 'valtio';

import { CreateSpaceShareURL } from '@/apis/share';
import { SpaceUserList } from '@/components/space/space-user';
import spaceStore from '@/stores/space';

const SpaceUserSetting = memo(function Component() {
    const { t } = useTranslation();
    const { currentSelectedSpace } = useSnapshot(spaceStore);

    const [isLoading, setIsLoading] = useState(false);
    const createShareToken = useCallback(async () => {
        setIsLoading(true);
        try {
            await CreateSpaceShareURL(currentSelectedSpace, window.location.origin + '/s/k/{token}');
        } catch (e: any) {
            console.error(e);
        }
    }, [currentSelectedSpace]);

    return (
        <>
            <div className="flex justify-end">
                <Button variant="ghost" isLoading={isLoading} onPress={createShareToken}>
                    {t('space-setting.ShareButton')}
                </Button>
            </div>
            <SpaceUserList spaceID={currentSelectedSpace} />
        </>
    );
});

export default SpaceUserSetting;
