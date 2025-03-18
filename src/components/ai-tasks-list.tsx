import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useImmer } from 'use-immer';
import { subscribeKey } from 'valtio/utils';

import ActionCard from '@/components/action-card';
import { useToast } from '@/hooks/use-toast';
import eventStore from '@/stores/event';

const taskMap = new Map<string, TaskInfo>();

export default memo(function KnowledgeAITaskList(props: any) {
    const { t } = useTranslation();
    const [tasks, setTasks] = useImmer<TaskInfo[]>([]);
    const { toast } = useToast();

    useEffect(() => {
        const unSubscribe = subscribeKey(eventStore, 'taskModify', (taskInfo: TaskInfo) => {
            if (taskInfo.status === 'warning') {
                toast({
                    title: t(taskInfo.title),
                    description: t(taskInfo.description)
                });

                return;
            }
            let task = taskMap.get(taskInfo.id);

            if (!task) {
                const task = {
                    id: taskInfo.id,
                    title: t(taskInfo.title),
                    description: t(taskInfo.description),
                    status: taskInfo.status
                };

                taskMap.set(task.id, task);
                setTasks(o => {
                    o.push(task);
                });

                return;
            }

            setTasks(o => {
                const res = o.find(d => d.id === taskInfo.id);

                if (res) {
                    res.title = t(taskInfo.title);
                    res.description = t(taskInfo.description);
                    res.status = taskInfo.status;
                }
            });

            setTimeout(() => {
                setTasks(o => {
                    const i = o.findIndex(d => d.id === taskInfo.id);

                    o.splice(i, 1);
                });
                taskMap.delete(taskInfo.id);
            }, 5000);
        });

        return unSubscribe;
    }, []);

    return (
        <div className="fixed top-20 right-6 z-50">
            <div className="flex w-full md:w-[320px] flex-col gap-3">
                {tasks.map(t => {
                    const color = (() => {
                        switch (t.status) {
                            case 'success':
                                return 'primary';
                            case 'failed':
                                return 'danger';
                            default:
                                return '';
                        }
                    })();

                    const icon = (() => {
                        switch (t.status) {
                            case 'success':
                                return 'icon-park-outline:success';
                            case 'failed':
                                return 'icon-park-outline:file-failed';
                            default:
                                return 'solar:document-add-linear';
                        }
                    })();

                    return <ActionCard key={t.id} inProgress={t.status === 'processing'} description={t.description} color={color} icon={icon} title={t.title} />;
                })}
                {/* <ActionCard description="Done" className="w-full" icon="solar:document-add-linear" title="Edit agreement" /> */}
            </div>
        </div>
    );
});
