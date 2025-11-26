import type { OutputData } from '@editorjs/editorjs';
import { Button, Card, Checkbox, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Radio, RadioGroup, Skeleton, useDisclosure } from '@heroui/react';
import { Icon } from '@iconify/react';
import { getLocalTimeZone, today } from '@internationalized/date';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import { GetJournal, Journal, UpsertJournal } from '@/apis/journal';
import { extractTodosFromBlocks, type TodoList, type TodoListItem, updateChecklistItemInBlocks } from '@/lib/journal-todos';
import spaceStore from '@/stores/space';

export default memo(function DailyJournalTodo() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentSelectedSpace } = useSnapshot(spaceStore);
    const [journal, setJournal] = useState<Journal | null>(null);
    const [journalTodos, setJournalTodos] = useState<TodoList[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [newTodoText, setNewTodoText] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<string>('new');
    const [newGroupTitle, setNewGroupTitle] = useState('');

    const todayDate = useMemo(() => {
        return today(getLocalTimeZone()).toString();
    }, []);

    const loadTodayJournal = useCallback(async () => {
        if (!currentSelectedSpace) {
            return;
        }

        setIsLoading(true);
        try {
            const journalData = await GetJournal(currentSelectedSpace, todayDate);
            if (journalData && journalData.content) {
                setJournal(journalData);
                const todos = extractTodosFromBlocks(journalData.content);
                setJournalTodos(todos);
            } else {
                setJournal(null);
                setJournalTodos([]);
            }
        } catch (e: any) {
            console.error('Failed to load today journal', e);
            setJournal(null);
            setJournalTodos([]);
        }
        setIsLoading(false);
    }, [currentSelectedSpace, todayDate]);

    useEffect(() => {
        loadTodayJournal();
    }, [loadTodayJournal]);

    const updateJournalContent = useCallback(
        async (updatedBlocks: OutputData) => {
            if (!currentSelectedSpace || !updatedBlocks.blocks) {
                return;
            }

            setIsUpdating(true);
            try {
                await UpsertJournal(currentSelectedSpace, todayDate, updatedBlocks);
                // 重新提取 todos 以更新状态
                const todos = extractTodosFromBlocks(updatedBlocks);
                setJournalTodos(todos);
            } catch (e: any) {
                console.error('Failed to update journal', e);
            }
            setIsUpdating(false);
        },
        [currentSelectedSpace, todayDate]
    );

    const onTodoToggle = useCallback(
        (targetId: string, index: number[]) => {
            if (!journal || !journal.content || !journal.content.blocks) {
                return;
            }

            const updatedContent = updateChecklistItemInBlocks(journal.content, targetId, index);
            if (!updatedContent) {
                return;
            }

            // 更新本地状态
            setJournal({ ...journal, content: updatedContent });
            // 提交到后端
            updateJournalContent(updatedContent);
        },
        [journal, updateJournalContent]
    );

    const onTodoDelete = useCallback(
        async (targetId: string, index: number[]) => {
            if (!journal || !journal.content || !journal.content.blocks) {
                return;
            }

            // 深拷贝 content
            const updatedContent = JSON.parse(JSON.stringify(journal.content)) as OutputData;
            const block = updatedContent.blocks.find(block => block.id === targetId);

            if (!block) {
                console.error('Target block not found.');
                return;
            }

            // 删除指定的 todo item
            if (index.length === 1) {
                // 直接从 block.data.items 中删除
                block.data.items.splice(index[0], 1);

                // 如果 block 的 items 为空，删除整个 block
                if (block.data.items.length === 0) {
                    const blockIndex = updatedContent.blocks.findIndex(b => b.id === targetId);
                    if (blockIndex >= 0) {
                        updatedContent.blocks.splice(blockIndex, 1);
                    }
                }
            } else {
                // 嵌套 item，需要递归找到并删除
                let currentItem = block.data.items;
                for (let i = 0; i < index.length - 1; i++) {
                    if (!currentItem || !currentItem[index[i]]) {
                        console.error('Invalid index path.');
                        return;
                    }
                    currentItem = currentItem[index[i]].items;
                }
                if (currentItem && currentItem[index[index.length - 1]]) {
                    currentItem.splice(index[index.length - 1], 1);
                }
            }

            // 更新本地状态
            setJournal({ ...journal, content: updatedContent });
            // 提交到后端
            await updateJournalContent(updatedContent);
        },
        [journal, updateJournalContent]
    );

    const handleAddTodo = useCallback(async () => {
        if (!newTodoText.trim() || !currentSelectedSpace) {
            return;
        }

        const currentContent = journal?.content || { blocks: [] };
        let updatedBlocks = [...(currentContent.blocks || [])];

        if (selectedGroup === 'new') {
            // 创建新的 checklist block
            const checklistBlock = {
                id: `todo-${Date.now()}`,
                type: 'listv2',
                data: {
                    style: 'checklist',
                    items: [
                        {
                            content: newTodoText.trim(),
                            items: [],
                            meta: {
                                checked: false
                            }
                        }
                    ]
                }
            };

            // 如果填写了标题，先添加 header block
            if (newGroupTitle.trim()) {
                const headerBlock = {
                    id: `header-${Date.now()}`,
                    type: 'header',
                    data: {
                        text: newGroupTitle.trim(),
                        level: 2
                    }
                };
                updatedBlocks.push(headerBlock, checklistBlock);
            } else {
                // 不填写标题，直接添加 checklist block
                updatedBlocks.push(checklistBlock);
            }
        } else {
            // 添加到现有标题下
            // 找到选中标题对应的最后一个 checklist block 的位置
            let targetIndex = -1;
            let foundHeader = false;

            for (let i = 0; i < updatedBlocks.length; i++) {
                const block = updatedBlocks[i];

                // 找到目标标题
                if (block.type === 'header' && block.data.text === selectedGroup) {
                    foundHeader = true;
                    continue;
                }

                // 找到该标题下的最后一个 checklist
                if (foundHeader && block.type === 'listv2' && block.data.style === 'checklist') {
                    targetIndex = i;
                } else if (foundHeader && block.type === 'header') {
                    // 遇到下一个标题，停止搜索
                    break;
                }
            }

            // 创建新的 todo item
            const newTodoItem = {
                content: newTodoText.trim(),
                items: [],
                meta: {
                    checked: false
                }
            };

            if (targetIndex >= 0) {
                // 在找到的 checklist block 中添加新 item
                const targetBlock = { ...updatedBlocks[targetIndex] };
                targetBlock.data = {
                    ...targetBlock.data,
                    items: [...targetBlock.data.items, newTodoItem]
                };
                updatedBlocks[targetIndex] = targetBlock;
            } else {
                // 没找到现有的 checklist，创建新的
                const checklistBlock = {
                    id: `todo-${Date.now()}`,
                    type: 'listv2',
                    data: {
                        style: 'checklist',
                        items: [newTodoItem]
                    }
                };
                updatedBlocks.push(checklistBlock);
            }
        }

        const updatedContent: OutputData = {
            ...currentContent,
            blocks: updatedBlocks
        };

        setIsUpdating(true);
        try {
            await UpsertJournal(currentSelectedSpace, todayDate, updatedContent);
            // 更新本地状态
            setJournal({ ...journal, content: updatedContent } as Journal);
            // 重新提取 todos
            const todos = extractTodosFromBlocks(updatedContent);
            setJournalTodos(todos);
            // 清空输入并关闭弹窗
            setNewTodoText('');
            setNewGroupTitle('');
            setSelectedGroup('new');
            onClose();
        } catch (e: any) {
            console.error('Failed to add todo', e);
        }
        setIsUpdating(false);
    }, [newTodoText, selectedGroup, newGroupTitle, currentSelectedSpace, journal, todayDate, onClose]);

    const renderTodoListItem = useCallback(
        (list: TodoListItem[]): JSX.Element | null => {
            if (!list || list.length === 0) {
                return null;
            }
            return (
                <ul className="space-y-1">
                    {list.map(v => {
                        return (
                            <li key={v.id + '-' + v.index.join('-')} className="flex flex-col">
                                <div className="flex items-center justify-between group gap-2">
                                    <Checkbox
                                        size="sm"
                                        isSelected={v.checked}
                                        isDisabled={isUpdating}
                                        radius="sm"
                                        classNames={{
                                            label: 'text-sm'
                                        }}
                                        onChange={() => {
                                            onTodoToggle(v.id, v.index);
                                        }}
                                    >
                                        <span className={v.checked ? 'line-through text-default-400' : ''}>{v.content}</span>
                                    </Checkbox>
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        color="danger"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity min-w-6 w-6 h-6"
                                        onPress={() => onTodoDelete(v.id, v.index)}
                                    >
                                        <Icon icon="solar:trash-bin-minimalistic-linear" width={16} />
                                    </Button>
                                </div>
                                {v.items && v.items.length > 0 && <div className="ml-6">{renderTodoListItem(v.items)}</div>}
                            </li>
                        );
                    })}
                </ul>
            );
        },
        [onTodoToggle, isUpdating, onTodoDelete]
    );

    // 计算未完成的 TODO 数量
    const uncompletedCount = useMemo(() => {
        let count = 0;
        const countUncompleted = (list: TodoListItem[]) => {
            for (const item of list) {
                if (!item.checked) {
                    count++;
                }
                if (item.items && item.items.length > 0) {
                    countUncompleted(item.items);
                }
            }
        };
        journalTodos.forEach(group => countUncompleted(group.list));
        return count;
    }, [journalTodos]);

    const dateObj = useMemo(() => {
        const date = new Date(todayDate);
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
        return { month, day, weekday };
    }, [todayDate]);

    const handleDateClick = useCallback(() => {
        if (!currentSelectedSpace) {
            return;
        }
        navigate(`/dashboard/${currentSelectedSpace}/journal/${todayDate}`);
    }, [navigate, currentSelectedSpace, todayDate]);

    // 如果没有 todos，不显示组件
    if (!isLoading && journalTodos.length === 0) {
        return null;
    }

    return (
        <div className="w-full md:px-6 px-3 mb-6">
            <Card className="w-full border-small dark:border-default-100 bg-content2 dark:bg-content1 shadow-sm">
                <div className="flex flex-row gap-4 p-4">
                    {/* 左侧日期卡片 */}
                    <div className="flex-shrink-0">
                        <div
                            role="button"
                            tabIndex={0}
                            className="flex flex-col items-center justify-center bg-primary dark:bg-primary/90 rounded-xl px-6 py-4 min-w-[100px] min-h-[160px] cursor-pointer hover:bg-primary/90 dark:hover:bg-primary transition-colors"
                            onClick={handleDateClick}
                            onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    handleDateClick();
                                }
                            }}
                        >
                            <div className="text-lg font-bold text-white mb-0.5">
                                {dateObj.month} {dateObj.day}
                            </div>
                            <div className="text-xs font-medium text-white/90">{t('Today')}</div>
                            <div className="text-xs text-white/70 mt-0.5">{dateObj.weekday}</div>
                        </div>
                    </div>

                    {/* 右侧待办事项区域 */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-default-600">{t('Today')}</span>
                            </div>
                            {!isLoading && journalTodos.length > 0 && (
                                <div className="text-xs text-default-400">{uncompletedCount > 0 ? `${uncompletedCount} ${t('pending')}` : t('All completed')}</div>
                            )}
                        </div>

                        <Skeleton isLoaded={!isLoading} className="rounded-lg">
                            {journalTodos.length > 0 ? (
                                <div className="space-y-3">
                                    {journalTodos.map((group, idx) => (
                                        <div key={idx} className="space-y-2">
                                            {group.title && <div className="text-xs font-medium text-default-500 uppercase tracking-wide mb-2">{group.title.replace(/&nbsp;/gi, '').trim()}</div>}
                                            {renderTodoListItem(group.list)}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-default-400 py-4">{t('No todos for today')}</div>
                            )}
                        </Skeleton>

                        {/* Add Task Button */}
                        {!isLoading && (
                            <div className="mt-4 pt-3 border-t border-divider">
                                <Button variant="faded" color="primary" startContent={<Icon icon="solar:add-circle-linear" width={18} />} onPress={onOpen} className="w-full justify-start w-auto">
                                    {t('Add Task')}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* Add Task Modal */}
            <Modal isOpen={isOpen} onClose={onClose} size="md">
                <ModalContent>
                    {onClose => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">{t('Add Task')}</ModalHeader>
                            <ModalBody className="gap-4">
                                <Input autoFocus label={t('Task')} placeholder={t('Enter your task')} value={newTodoText} onValueChange={setNewTodoText} />

                                <RadioGroup label={t('Select group')} value={selectedGroup} onValueChange={setSelectedGroup}>
                                    <Radio value="new">{t('New group')}</Radio>
                                    {journalTodos
                                        .filter(group => group.title && group.title.trim() !== '')
                                        .map((group, idx) => (
                                            <Radio key={idx} value={group.title}>
                                                {group.title}
                                            </Radio>
                                        ))}
                                </RadioGroup>

                                {selectedGroup === 'new' && (
                                    <Input
                                        label={t('Group title (optional)')}
                                        placeholder={t('Enter group title')}
                                        value={newGroupTitle}
                                        onValueChange={setNewGroupTitle}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleAddTodo();
                                            }
                                        }}
                                    />
                                )}
                            </ModalBody>
                            <ModalFooter>
                                <Button color="danger" variant="light" onPress={onClose}>
                                    {t('Cancel')}
                                </Button>
                                <Button color="primary" isLoading={isUpdating} isDisabled={!newTodoText.trim()} onPress={handleAddTodo}>
                                    {t('Add')}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
});
