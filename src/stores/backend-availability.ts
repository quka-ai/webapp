import { proxy } from 'valtio';

const backendAvailabilityStore = proxy({ unavailable: false });

export const markBackendUnavailable = () => {
    backendAvailabilityStore.unavailable = true;
};

export const clearBackendUnavailable = () => {
    backendAvailabilityStore.unavailable = false;
};

export default backendAvailabilityStore;
