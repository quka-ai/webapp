import { proxy } from 'valtio';

const eventStore = proxy<EventStore>({
    themeChange: '',
    taskModify: undefined,
    loginRedirect: ''
});

export const onThemeChange = (theme: string) => {
    eventStore.themeChange = theme;
};

export const notifyTaskProgress = (taskInfo: TaskInfo) => {
    eventStore.taskModify = taskInfo;
};

export const setLoginRedirect = (url: string) => {
    eventStore.loginRedirect = url;
};

export default eventStore;
