import { Skeleton } from '@heroui/react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSnapshot } from 'valtio';

// 导入 DailyJournalTodo 组件
import DailyJournalTodo from './daily-journal-todo';

import { Journal, ListJournals } from '@/apis/journal';
import { extractTodosFromBlocks, type TodoList } from '@/lib/journal-todos';
import spaceStore from '@/stores/space';

interface MultiDayJournalTodosProps {
    className?: string;
}

export default memo(function MultiDayJournalTodos({ className = '' }: MultiDayJournalTodosProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentSelectedSpace } = useSnapshot(spaceStore);
    const [journals, setJournals] = useState<Array<{ journal: Journal; todos: TodoList[]; dateStr: string }>>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadJournals = useCallback(async () => {
        if (!currentSelectedSpace) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            // 从明天开始往前数7天（包括明天）
            // 使用本地时间获取今天的日期字符串，避免时区问题
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

            // 计算查询范围：从今天往前6天到明天
            const endDate = new Date(now);
            endDate.setDate(endDate.getDate() + 1);

            const startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 6);

            const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
            const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

            const journals = await ListJournals(currentSelectedSpace, startDateStr, endDateStr);

            // 检查是否已经有今天和明天的日记
            const hasTodayJournal = journals.some(j => j.date === todayStr);
            const hasTomorrowJournal = journals.some(j => j.date === tomorrowStr);

            // 如果没有，创建空的占位日记
            const allJournals = [...journals];
            if (!hasTodayJournal) {
                allJournals.push({
                    id: `placeholder-${todayStr}`,
                    date: todayStr,
                    content: { blocks: [] },
                    space_id: currentSelectedSpace,
                    user_id: '',
                    title: '',
                    created_at: 0,
                    updated_at: 0
                } as Journal);
            }
            if (!hasTomorrowJournal) {
                allJournals.push({
                    id: `placeholder-${tomorrowStr}`,
                    date: tomorrowStr,
                    content: { blocks: [] },
                    space_id: currentSelectedSpace,
                    user_id: '',
                    title: '',
                    created_at: 0,
                    updated_at: 0
                } as Journal);
            }

            // 过滤出有 TODO 内容的 journal，并获取日期，按日期降序排序（从明天往前）
            // 特殊处理：今天和明天即使没有 todos 也显示
            const todayDate = new Date(now);
            todayDate.setHours(0, 0, 0, 0);

            const journalsWithTodos = allJournals
                .map(journal => {
                    const todos = extractTodosFromBlocks(journal.content);
                    const dateStr = journal.date;
                    return { journal, todos, dateStr };
                })
                .filter(item => {
                    // 计算日期差异
                    const itemDate = new Date(item.dateStr);
                    itemDate.setHours(0, 0, 0, 0);
                    const diffTime = itemDate.getTime() - todayDate.getTime();
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                    // 今天或明天，或者有 todos 的日期都保留
                    return diffDays === 0 || diffDays === 1 || item.todos.length > 0;
                })
                .sort((a, b) => b.dateStr.localeCompare(a.dateStr));

            setJournals(journalsWithTodos);
        } catch (e) {
            console.error('Failed to load journals', e);
            setJournals([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentSelectedSpace]);

    useEffect(() => {
        loadJournals();
    }, [loadJournals]);

    const handleDateClick = useCallback(
        (spaceId: string, date: string) => {
            navigate(`/dashboard/${spaceId}/journal/${date}`);
        },
        [navigate]
    );

    if (!isLoading && journals.length === 0) {
        return null;
    }

    return (
        <>
            {isLoading ? (
                // Loading skeleton
                <div className="space-y-4 md:px-6 px-3 mb-6">
                    {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="rounded-lg">
                            <div className="h-24 rounded-lg bg-default-200 dark:bg-default-800" />
                        </Skeleton>
                    ))}
                </div>
            ) : (
                journals.map(({ journal }) => {
                    return <DailyJournalTodo key={journal.id} journalData={journal} />;
                })
            )}
        </>
    );
});
