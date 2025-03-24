import { memo } from 'react';
import { useSnapshot } from 'valtio';

import { SpaceApplicationList } from '@/components/space/space-application-list';
import spaceStore from '@/stores/space';

const SpaceUserApplications = memo(function Component() {
    const { currentSelectedSpace } = useSnapshot(spaceStore);

    return (
        <>
            <SpaceApplicationList spaceID={currentSelectedSpace} />
        </>
    );
});

export default SpaceUserApplications;
