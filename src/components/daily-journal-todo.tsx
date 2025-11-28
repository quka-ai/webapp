import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { OutputData } from '@editorjs/editorjs';
import { Button, Card, Checkbox, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Radio, RadioGroup, Skeleton, useDisclosure } from '@heroui/react';
import { Icon } from '@iconify/react';
import { getLocalTimeZone, today } from '@internationalized/date';
import clsx from 'clsx';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import { GetJournal, Journal, UpsertJournal } from '@/apis/journal';
import { extractTodosFromBlocks, type TodoList, type TodoListItem, updateChecklistItemInBlocks } from '@/lib/journal-todos';
import spaceStore from '@/stores/space';

// 可拖拽的 TODO 项组件
interface SortableTodoItemProps {
    item: TodoListItem;
    isUpdating: boolean;
    onToggle: (id: string, index: number[]) => void;
    onDelete: (id: string, index: number[]) => void;
    renderChildren: (items: TodoListItem[]) => JSX.Element | null;
}

const SortableTodoItem = memo(function SortableTodoItem({ item, isUpdating, onToggle, onDelete, renderChildren }: SortableTodoItemProps) {
    const dragId = `${item.id}-index-${item.index.join('-')}`;
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: dragId,
        disabled: item.index.length > 1 // 只允许顶层拖拽
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    };

    return (
        <li ref={setNodeRef} style={style} className="flex flex-col">
            <div className="flex items-center justify-between group gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {item.index.length === 1 && (
                        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing flex-shrink-0">
                            <Icon icon="solar:hamburger-menu-linear" width={16} className="text-default-400" />
                        </div>
                    )}
                    <Checkbox
                        size="sm"
                        isSelected={item.checked}
                        isDisabled={isUpdating}
                        radius="sm"
                        classNames={{
                            label: 'text-sm'
                        }}
                        onChange={() => onToggle(item.id, item.index)}
                    >
                        <span className={item.checked ? 'line-through text-default-400' : ''}>{item.content}</span>
                    </Checkbox>
                </div>
                <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="danger"
                    className="opacity-0 group-hover:opacity-100 transition-opacity min-w-6 w-6 h-6"
                    onPress={() => onDelete(item.id, item.index)}
                >
                    <Icon icon="solar:trash-bin-minimalistic-linear" width={16} />
                </Button>
            </div>
            {item.items && item.items.length > 0 && <div className="ml-6">{renderChildren(item.items)}</div>}
        </li>
    );
});

interface DailyJournalTodoProps {
    journalData?: Journal;
    customDate?: string;
}

export default memo(function DailyJournalTodo({ journalData, customDate }: DailyJournalTodoProps = {}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentSelectedSpace } = useSnapshot(spaceStore);
    const [journal, setJournal] = useState<Journal | null>(journalData || null);
    const [journalTodos, setJournalTodos] = useState<TodoList[]>([]);
    const [isLoading, setIsLoading] = useState(!journalData);
    const [isUpdating, setIsUpdating] = useState(false);
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [newTodoText, setNewTodoText] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<string>('new');
    const [newGroupTitle, setNewGroupTitle] = useState('');
    const [activeDragId, setActiveDragId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8
            }
        })
    );

    const effectiveDate = useMemo(() => {
        if (journalData) {
            return journalData.date;
        }
        return customDate || today(getLocalTimeZone()).toString();
    }, [journalData, customDate]);

    const loadJournal = useCallback(async () => {
        if (!currentSelectedSpace || journalData) {
            return;
        }

        setIsLoading(true);
        try {
            const journalData = await GetJournal(currentSelectedSpace, effectiveDate);
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
    }, [currentSelectedSpace, effectiveDate]);

    // 初始化时处理传入的数据
    useEffect(() => {
        if (journalData) {
            setJournal(journalData);
            const todos = extractTodosFromBlocks(journalData.content);
            setJournalTodos(todos);
            setIsLoading(false);
        } else {
            loadJournal();
        }
    }, [journalData, loadJournal]);

    const updateJournalContent = useCallback(
        async (updatedBlocks: OutputData) => {
            if (!currentSelectedSpace || !updatedBlocks.blocks) {
                return;
            }

            setIsUpdating(true);
            try {
                await UpsertJournal(currentSelectedSpace, effectiveDate, updatedBlocks);
                // 重新提取 todos 以更新状态
                const todos = extractTodosFromBlocks(updatedBlocks);
                setJournalTodos(todos);
            } catch (e: any) {
                console.error('Failed to update journal', e);
            }
            setIsUpdating(false);
        },
        [currentSelectedSpace, effectiveDate]
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
            await UpsertJournal(currentSelectedSpace, effectiveDate, updatedContent);
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
    }, [newTodoText, selectedGroup, newGroupTitle, currentSelectedSpace, journal, effectiveDate, onClose]);

    const renderTodoListItem = useCallback(
        (list: TodoListItem[]): JSX.Element | null => {
            if (!list || list.length === 0) {
                return null;
            }

            // 只对顶层项目启用排序
            const isTopLevel = list.length > 0 && list[0].index.length === 1;
            const sortableIds = isTopLevel ? list.map(v => `${v.id}-index-${v.index.join('-')}`) : [];

            if (isTopLevel) {
                return (
                    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                        <ul className="space-y-1">
                            {list.map(v => (
                                <SortableTodoItem
                                    key={v.id + '-' + v.index.join('-')}
                                    item={v}
                                    isUpdating={isUpdating}
                                    renderChildren={renderTodoListItem}
                                    onToggle={onTodoToggle}
                                    onDelete={onTodoDelete}
                                />
                            ))}
                        </ul>
                    </SortableContext>
                );
            }

            // 嵌套项不支持拖拽
            return (
                <ul className="space-y-1">
                    {list.map(v => (
                        <SortableTodoItem key={v.id + '-' + v.index.join('-')} item={v} isUpdating={isUpdating} renderChildren={renderTodoListItem} onToggle={onTodoToggle} onDelete={onTodoDelete} />
                    ))}
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
        const date = new Date(effectiveDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);

        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });

        // 计算日期关系
        const diffTime = date.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        let dateLabel = '';
        if (diffDays === 0) {
            dateLabel = t('Today');
        } else if (diffDays === 1) {
            dateLabel = t('Tomorrow');
        } else if (diffDays === -1) {
            dateLabel = t('Yesterday');
        }

        return { month, day, weekday, dateLabel, dateString: effectiveDate, isToday: diffDays === 0, isTomorrow: diffDays === 1 };
    }, [effectiveDate, t]);

    const handleDateClick = useCallback(() => {
        if (!currentSelectedSpace) {
            return;
        }
        navigate(`/dashboard/${currentSelectedSpace}/journal/${effectiveDate}`);
    }, [navigate, currentSelectedSpace, effectiveDate]);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveDragId(event.active.id as string);
    }, []);

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            setActiveDragId(null);

            if (!over || !journal || !journal.content || !journal.content.blocks) {
                return;
            }

            // Parse drag IDs: format is "blockId-indexPath"
            const activeId = active.id as string;
            const overId = over.id as string;

            if (activeId === overId) {
                return;
            }

            // 深拷贝 content
            const updatedContent = JSON.parse(JSON.stringify(journal.content)) as OutputData;

            // 解析 activeId 和 overId
            const [activeBlockId, activeIndexStr] = activeId.split('-index-');
            const [overBlockId, overIndexStr] = overId.split('-index-');

            if (!activeBlockId || !activeIndexStr) {
                return;
            }

            const activeIndex = activeIndexStr.split('-').map(Number);
            const overIndex = overIndexStr ? overIndexStr.split('-').map(Number) : [];

            // 找到源 block
            const sourceBlock = updatedContent.blocks.find(b => b.id === activeBlockId);
            if (!sourceBlock || activeIndex.length !== 1) {
                // 只支持顶层拖拽
                return;
            }

            // 获取要移动的 item（包括所有子项）
            const itemToMove = sourceBlock.data.items[activeIndex[0]];
            if (!itemToMove) {
                return;
            }

            // 处理同一 block 内的排序
            if (activeBlockId === overBlockId && overIndex.length === 1) {
                const oldIndex = activeIndex[0];
                const newIndex = overIndex[0];

                // 同一个 block 内移动
                sourceBlock.data.items.splice(oldIndex, 1);
                sourceBlock.data.items.splice(newIndex, 0, itemToMove);
            } else {
                // 跨 block 移动
                // 从源位置删除
                sourceBlock.data.items.splice(activeIndex[0], 1);

                // 如果源 block 为空，删除它
                if (sourceBlock.data.items.length === 0) {
                    const blockIndex = updatedContent.blocks.findIndex(b => b.id === activeBlockId);
                    if (blockIndex >= 0) {
                        updatedContent.blocks.splice(blockIndex, 1);
                    }
                }

                // 找到目标位置并插入
                if (overBlockId && overIndex.length === 1) {
                    // 拖到另一个 TODO 项上
                    const targetBlock = updatedContent.blocks.find(b => b.id === overBlockId);
                    if (targetBlock) {
                        // 插入到目标位置
                        targetBlock.data.items.splice(overIndex[0], 0, itemToMove);
                    }
                } else if (overBlockId === 'drop-zone') {
                    // 拖到某个分组的 drop zone
                    const groupTitle = over.data.current?.groupTitle;

                    if (groupTitle) {
                        // 找到该标题下的最后一个 checklist block
                        let targetIndex = -1;
                        let foundHeader = false;

                        for (let i = 0; i < updatedContent.blocks.length; i++) {
                            const block = updatedContent.blocks[i];
                            if (block.type === 'header' && block.data.text === groupTitle) {
                                foundHeader = true;
                                continue;
                            }
                            if (foundHeader && block.type === 'listv2' && block.data.style === 'checklist') {
                                targetIndex = i;
                            } else if (foundHeader && block.type === 'header') {
                                break;
                            }
                        }

                        if (targetIndex >= 0) {
                            // 添加到现有 checklist
                            updatedContent.blocks[targetIndex].data.items.push(itemToMove);
                        } else {
                            // 创建新的 checklist block
                            const newChecklistBlock = {
                                id: `todo-${Date.now()}`,
                                type: 'listv2',
                                data: {
                                    style: 'checklist',
                                    items: [itemToMove]
                                }
                            };

                            // 找到 header 的位置，插入到其后
                            const headerIndex = updatedContent.blocks.findIndex(b => b.type === 'header' && b.data.text === groupTitle);
                            if (headerIndex >= 0) {
                                updatedContent.blocks.splice(headerIndex + 1, 0, newChecklistBlock);
                            }
                        }
                    } else {
                        // 拖到"无标题"区域，创建独立的 checklist block
                        const newChecklistBlock = {
                            id: `todo-${Date.now()}`,
                            type: 'listv2',
                            data: {
                                style: 'checklist',
                                items: [itemToMove]
                            }
                        };
                        updatedContent.blocks.push(newChecklistBlock);
                    }
                }
            }

            // 更新状态和后端
            setJournal({ ...journal, content: updatedContent });
            updateJournalContent(updatedContent);
        },
        [journal, updateJournalContent]
    );

    // 如果没有 todos，且不是今天或明天，不显示组件
    if (!isLoading && journalTodos.length === 0 && !dateObj.isToday && !dateObj.isTomorrow) {
        return null;
    }

    return (
        <div className="w-full md:px-6 px-3 mb-6">
            <Card className={clsx('w-full dark:border-default-100 bg-content2 dark:bg-content1 shadow-sm', dateObj.isToday && 'border-small')}>
                <div className="flex flex-row gap-4 p-4 bg-gradient-to-br from-default-400/30 to-default-400 dark:from-default-100/30 dark:to-default-50/50">
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
                            {dateObj.dateLabel && <div className="text-xs font-medium text-white/90">{dateObj.dateLabel}</div>}
                            <div className="text-xs text-white/70 mt-0.5">{dateObj.weekday}</div>
                        </div>
                    </div>

                    {/* 右侧待办事项区域 */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-default-600">{dateObj.dateLabel || dateObj.dateString}</span>
                            </div>
                            {!isLoading && journalTodos.length > 0 && (
                                <div className="text-xs text-default-400">{uncompletedCount > 0 ? `${uncompletedCount} ${t('pending')}` : t('All completed')}</div>
                            )}
                        </div>

                        <Skeleton isLoaded={!isLoading} className="rounded-lg">
                            {journalTodos.length > 0 ? (
                                <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                                    <div className="space-y-3">
                                        {journalTodos.map((group, idx) => (
                                            <div key={idx} className="space-y-2">
                                                {group.title && <div className="text-xs font-medium text-default-500 uppercase tracking-wide mb-2">{group.title.replace(/&nbsp;/gi, '').trim()}</div>}
                                                {renderTodoListItem(group.list)}
                                            </div>
                                        ))}
                                    </div>
                                    <DragOverlay>
                                        {activeDragId ? (
                                            <div className="bg-content1 border border-default-200 rounded-lg p-2 shadow-lg">
                                                <Icon icon="solar:hamburger-menu-linear" width={16} className="text-default-400 inline mr-2" />
                                                <span className="text-sm">Dragging...</span>
                                            </div>
                                        ) : null}
                                    </DragOverlay>
                                </DndContext>
                            ) : (
                                <div className="text-sm text-default-400 py-4">{t('No todos for this day')}</div>
                            )}
                        </Skeleton>

                        {/* Add Task Button */}
                        {!isLoading && (
                            <div className="mt-4 pt-3">
                                <Button variant="faded" color="primary" startContent={<Icon icon="solar:add-circle-linear" width={18} />} className="justify-start w-auto" onPress={onOpen}>
                                    {t('Add Task')}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* Add Task Modal */}
            <Modal isOpen={isOpen} size="md" onClose={onClose}>
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
