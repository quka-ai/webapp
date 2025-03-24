import { spacer } from '@heroui/react';
import { useMemo } from 'react';
import { useSnapshot } from 'valtio';

import spaceStore from '@/stores/space';
import { Role } from '@/types';

export function useRole(): { isSpaceViewer: boolean; isMember: boolean; isEditor: boolean; isChief: boolean; isManager: boolean } {
    const { spaceRole } = useSnapshot(spaceStore);

    const isMember = useMemo(() => {
        return spaceRole === Role.MEMBER;
    }, [spaceRole]);

    const isSpaceViewer = useMemo(() => {
        return spaceRole === Role.VIEWER;
    }, [spaceRole]);

    const isEditor = useMemo(() => {
        return spaceRole === Role.EDITOR || spaceRole === Role.ADMIN || spaceRole === Role.CHIEF;
    }, [spaceRole]);

    const isManager = useMemo(() => {
        console.log(spaceRole, Role.CHIEF);
        return spaceRole === Role.ADMIN || spaceRole === Role.CHIEF;
    }, [spaceRole]);

    const isChief = useMemo(() => {
        return spaceRole === Role.CHIEF;
    }, [spaceRole]);

    return { isSpaceViewer, isMember, isEditor, isChief, isManager };
}
