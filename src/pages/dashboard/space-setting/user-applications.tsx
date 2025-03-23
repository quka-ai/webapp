import { Button } from '@heroui/react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnapshot } from 'valtio';

import { CreateSpaceShareURL } from '@/apis/share';
import ShareButton from '@/components/share-button';
import { SpaceUserList } from '@/components/space/space-user';
import spaceStore from '@/stores/space';

const SpaceUserApplications = memo(function Component() {
    const { t } = useTranslation();
    const { currentSelectedSpace } = useSnapshot(spaceStore);

    return (
        <>
            <div className="flex justify-end">
                <ShareButton
                    text={t('space-setting.ShareButton')}
                    genUrlFunc={async () => {
                        try {
                            const res = await CreateSpaceShareURL(currentSelectedSpace, window.location.origin + '/s/sp/{token}');
                            return res.url;
                        } catch (e: any) {
                            console.error(e);
                        }
                    }}
                />
            </div>
            <SpaceUserList spaceID={currentSelectedSpace} />
        </>
    );
});

export default SpaceUserApplications;
