import { useMemo } from 'react';
import { useSnapshot } from 'valtio';

import spaceStore from '@/stores/space';
import userStore from '@/stores/user';
import { Role } from '@/types';

export function useSpaceRole(): { isSpaceViewer: boolean; isMember: boolean; isEditor: boolean; isChief: boolean; isManager: boolean } {
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
        return spaceRole === Role.ADMIN || spaceRole === Role.CHIEF;
    }, [spaceRole]);

    const isChief = useMemo(() => {
        return spaceRole === Role.CHIEF;
    }, [spaceRole]);

    return { isSpaceViewer, isMember, isEditor, isChief, isManager };
}

export function useSystemRole(): { isSystemAdmin: boolean; isChief: boolean } {
    const { userInfo } = useSnapshot(userStore);

    const isSystemAdmin = useMemo(() => {
        return userInfo?.systemRole === 'role-chief' || userInfo?.systemRole === 'role-admin';
    }, [userInfo]);

    const isChief = useMemo(() => {
        return userInfo?.systemRole === 'role-chief';
    }, [userInfo]);

    return { isSystemAdmin, isChief };
}
