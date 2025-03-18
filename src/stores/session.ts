import { proxy } from 'valtio';

const sessionStore = proxy<SessionStore>({
    currentSelectedSession: undefined,
    sessionNamedEvent: undefined,
    sessionReload: ''
});

export const setCurrentSelectedSession = (data: Session) => {
    sessionStore.currentSelectedSession = data;
};

export const notifySessionNamedEvent = (data: SessionNamedEvent) => {
    sessionStore.sessionNamedEvent = data;
};

export const notifySessionReload = (sessionID: string) => {
    sessionStore.sessionReload = sessionID;
};

export default sessionStore;
