import { proxy } from 'valtio';

import { ListResources, Resource } from '@/apis/resource';

const resourceStore = proxy<ResourceStore>({
    currentSelectedResource: undefined,
    currentSpaceResources: undefined,
    onResourceUpdate: false,
    resourceTags: ['projects', 'areas', 'resources', 'archives']
});

export const setCurrentSelectedResource = (data: Resource) => {
    resourceStore.currentSelectedResource = data;
};

export const setSpaceResource = (list: Resource[]) => {
    resourceStore.currentSpaceResources = list;
};

export const onResourceUpdate = () => {
    resourceStore.onResourceUpdate = !resourceStore.onResourceUpdate;
};

export const loadSpaceResource = async (spaceID: string): Promis<Resource[]> => {
    try {
        let list = await ListResources(spaceID);
        setSpaceResource(list);
        return list;
    } catch (e: any) {
        console.error(e);
    }
};

export default resourceStore;
