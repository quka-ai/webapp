import { memo, useCallback, useState } from 'react';
import { useSnapshot } from 'valtio';

import { SpaceUserList } from '@/components/space/space-user';
import spaceStore from '@/stores/space';
import { Button } from '@heroui/react';
import { CreateSpaceShareURL } from '@/apis/share';

const SpaceUserSetting = memo(function Component() {
    const { currentSelectedSpace } = useSnapshot(spaceStore);

    const [isLoading, setIsLoading] = useState(false)
    const createShareToken = useCallback(async () => {
        setIsLoading(true)
        try {
            await CreateSpaceShareURL(currentSelectedSpace, window.location.origin + '/s/k/{token}')
        }catch(e:any) {
            console.error(e)
        }
    }, [currentSelectedSpace])
    return <>
        <div className="flex justify-end">
            <Button variant='ghost' onPress={createShareToken} isLoading={isLoading}>ShareSpace</Button>
        </div>
        <SpaceUserList spaceID={currentSelectedSpace} />;
    </>
});

export default SpaceUserSetting;
