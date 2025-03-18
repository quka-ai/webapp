import { proxy } from 'valtio';

const eventStore = proxy<EventStore>({
    themeChange: '',
    taskModify: undefined
});

export const onThemeChange = (theme: string) => {
    eventStore.themeChange = theme;
};

export const notifyTaskProgress = (taskInfo: TaskInfo) => {
    eventStore.taskModify = taskInfo;
};

export default eventStore;
