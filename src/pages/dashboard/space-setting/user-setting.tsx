import { Button, Input, Kbd } from '@heroui/react';
import { Icon } from '@iconify/react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnapshot } from 'valtio';

import { SpaceUserList } from '@/components/space/space-user';
import spaceStore from '@/stores/space';

const SpaceUserSetting = memo(function Component() {
    const { t } = useTranslation();
    const { currentSelectedSpace } = useSnapshot(spaceStore);

    return (
        <>
            <SpaceUserList spaceID={currentSelectedSpace} />
        </>
    );
});

export default SpaceUserSetting;
