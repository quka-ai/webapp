import { useMemo } from 'react';
import { useSnapshot } from 'valtio';

import spaceStore from '@/stores/space';
import { Role } from '@/types';

export function useRole(): { isSpaceViewer: boolean; isMember: boolean; isEditor: boolean } {
    const { spaceRole } = useSnapshot(spaceStore);

    const isMember = useMemo(() => {
        return spaceRole === Role.MEMBER;
    }, [spaceRole]);

    const isSpaceViewer = useMemo(() => {
        return spaceRole === Role.VIEWER;
    }, [spaceRole]);

    const isEditor = useMemo(() => {
        return spaceRole === Role.EDITOR || spaceRole === Role.ADMIN;
    }, [spaceRole]);

    return { isSpaceViewer, isMember, isEditor };
}
