import { proxy } from 'valtio';

import { ListUserSpace } from '@/apis/space';

const spaceStore = proxy<SpaceStore>({
    spaces: [],
    currentSelectedSpace: '',
    spaceRole: 'role-viewer'
});

export const setUserSpaces = (spaces: UserSpace[]) => {
    spaceStore.spaces = spaces;
    if (spaceStore.currentSelectedSpace === '' && spaces && spaces.length > 0) {
        spaceStore.currentSelectedSpace = spaces[0].space_id;
    }
};

export const latestPickedSpace = (): string | undefined => {
    return localStorage.getItem('brew-selected-space');
};

export const setCurrentSelectedSpace = (space: string) => {
    spaceStore.currentSelectedSpace = space;
    if (space) {
        localStorage.setItem('brew-selected-space', space);
        const spaceInfo = spaceStore.spaces.find(v => v.space_id == space);

        spaceInfo && setSpaceRole(spaceInfo?.role);
    }
};

export const setSpaceRole = (role: string) => {
    spaceStore.spaceRole = role;
};

export const loadUserSpaces = async () => {
    try {
        let resp = await ListUserSpace();

        setUserSpaces(resp);
    } catch (e: any) {
        console.error(e);
    }
};

export default spaceStore;
