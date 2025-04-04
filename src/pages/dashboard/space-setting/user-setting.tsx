import { memo } from 'react';
import { useSnapshot } from 'valtio';

import { SpaceUserList } from '@/components/space/space-user';
import spaceStore from '@/stores/space';

const SpaceUserSetting = memo(function Component() {
    const { currentSelectedSpace } = useSnapshot(spaceStore);

    return (
        <div className="relative">
            <SpaceUserList spaceID={currentSelectedSpace} />
        </div>
    );
});

export default SpaceUserSetting;
