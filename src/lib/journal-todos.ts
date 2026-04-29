import type { PartialBlock } from '@blocknote/core';
import type { OutputBlockData, OutputData } from '@editorjs/editorjs';

export type JournalTodoContent = OutputData | PartialBlock[] | string | null | undefined;

export interface TodoListItem {
    id: string;
    index: number[];
    checked: boolean;
    content: string;
    items: TodoListItem[];
}

export interface TodoList {
    title: string;
    list: TodoListItem[];
}

export interface EditorCheckListItem {
    content: string;
    items: EditorCheckListItem[];
    meta: {
        checked: boolean;
    };
}

type BlockNoteTodoBlock = PartialBlock & {
    id?: string;
    type: string;
    props?: {
        checked?: boolean;
        [key: string]: any;
    };
    content?: any;
    children?: BlockNoteTodoBlock[];
};

function isEditorJSOutputData(content: JournalTodoContent): content is OutputData {
    return Boolean(content && typeof content === 'object' && !Array.isArray(content) && Array.isArray((content as OutputData).blocks));
}

function isBlockNoteBlocks(content: JournalTodoContent): content is BlockNoteTodoBlock[] {
    return Array.isArray(content);
}

function getInlineContentText(content: any): string {
    if (!content) {
        return '';
    }

    if (typeof content === 'string') {
        return content;
    }

    if (!Array.isArray(content)) {
        return '';
    }

    return content
        .map(item => {
            if (typeof item === 'string') {
                return item;
            }

            if (typeof item?.text === 'string') {
                return item.text;
            }

            return getInlineContentText(item?.content);
        })
        .join('');
}

function createBlockNoteTextContent(text: string) {
    return [
        {
            type: 'text',
            text,
            styles: {}
        }
    ];
}

function createBlockNoteHeading(title: string): BlockNoteTodoBlock {
    return {
        id: `heading-${Date.now()}`,
        type: 'heading',
        props: {
            level: 2
        },
        content: createBlockNoteTextContent(title),
        children: []
    };
}

function createBlockNoteCheckListItem(content: string, children: BlockNoteTodoBlock[] = []): BlockNoteTodoBlock {
    return {
        id: `todo-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        type: 'checkListItem',
        props: {
            checked: false
        },
        content: createBlockNoteTextContent(content),
        children
    };
}

function cloneBlockNoteBlocks(blocks: BlockNoteTodoBlock[]) {
    return JSON.parse(JSON.stringify(blocks)) as BlockNoteTodoBlock[];
}

function findBlockNoteBlock(blocks: BlockNoteTodoBlock[], targetId: string): BlockNoteTodoBlock | null {
    for (const block of blocks) {
        if (block.id && block.id === targetId) {
            return block;
        }

        const child = findBlockNoteBlock((block.children || []) as BlockNoteTodoBlock[], targetId);
        if (child) {
            return child;
        }
    }

    return null;
}

function removeBlockNoteBlock(blocks: BlockNoteTodoBlock[], targetId: string): BlockNoteTodoBlock | null {
    const index = blocks.findIndex(block => block.id && block.id === targetId);

    if (index >= 0) {
        const [removed] = blocks.splice(index, 1);

        return removed || null;
    }

    for (const block of blocks) {
        const removed = removeBlockNoteBlock((block.children || []) as BlockNoteTodoBlock[], targetId);
        if (removed) {
            return removed;
        }
    }

    return null;
}

function parseBlockNoteCheckList(block: BlockNoteTodoBlock, index: number[]): TodoListItem {
    return {
        id: block.id || `todo-${index.join('-')}`,
        index,
        checked: Boolean(block.props?.checked),
        content: getInlineContentText(block.content),
        items: ((block.children || []) as BlockNoteTodoBlock[])
            .filter(child => child.type === 'checkListItem')
            .map((child, i) => parseBlockNoteCheckList(child, [...index, i]))
    };
}

function extractTodosFromBlockNoteBlocks(blocks: BlockNoteTodoBlock[]): TodoList[] {
    const todos: TodoList[] = [];
    let previousBlock: BlockNoteTodoBlock | null = null;
    let isConsecutive = false;

    blocks.forEach((block, index) => {
        if (block.type === 'checkListItem') {
            if (!isConsecutive) {
                const title = previousBlock?.type === 'heading' ? getInlineContentText(previousBlock.content) : '';

                if (todos.length === 0 || todos[todos.length - 1].title !== title) {
                    todos.push({
                        title,
                        list: []
                    });
                }
            }

            todos[todos.length - 1].list.push(parseBlockNoteCheckList(block, [index]));
            isConsecutive = true;
        } else {
            isConsecutive = false;
        }

        if (block.type === 'heading') {
            previousBlock = block;
        }
    });

    return todos;
}

/**
 * 解析 EditorJS checklist 数据为 TodoListItem
 */
export function parseCheckList(id: string, index: number[], data: EditorCheckListItem): TodoListItem {
    const todoItem: TodoListItem = {
        id: id,
        index: index,
        checked: data.meta.checked,
        content: data.content,
        items: []
    };

    if (!data.items || data.items.length === 0) {
        return todoItem;
    }

    data.items.forEach((subItem, i) => {
        const indexCopy = [...index];
        indexCopy.push(i);
        todoItem.items.push(parseCheckList(id, indexCopy, subItem));
    });

    return todoItem;
}

/**
 * 从 EditorJS blocks 中提取所有的 TODO 列表
 */
export function extractTodosFromBlocks(blocks: JournalTodoContent): TodoList[] {
    if (isBlockNoteBlocks(blocks)) {
        return extractTodosFromBlockNoteBlocks(blocks as BlockNoteTodoBlock[]);
    }

    if (typeof blocks === 'string') {
        return [];
    }

    if (!isEditorJSOutputData(blocks)) {
        return [];
    }

    const todos: TodoList[] = [];
    let previousBlock = {} as OutputBlockData;
    let isConsecutive = false;

    for (const item of blocks.blocks) {
        if (item.type === 'listv2' && item.data.style === 'checklist') {
            if (!isConsecutive) {
                // 如果不是连续的checklist
                let title = '';
                if (previousBlock && previousBlock.type === 'header') {
                    title = previousBlock.data.text;
                }
                // 且Title不同，则新增一个todo组
                if (todos.length === 0 || todos[todos.length - 1].title !== title) {
                    todos.push({
                        title: title,
                        list: []
                    });
                }
            }

            item.data.items.forEach((dataItem: EditorCheckListItem, i: number) => {
                if (dataItem) {
                    todos[todos.length - 1].list.push(parseCheckList(item.id || `todo-${i}`, [i], dataItem));
                }
            });

            isConsecutive = true;
        } else {
            isConsecutive = false;
        }

        if (item.type === 'header') {
            previousBlock = item;
        }
    }

    return todos;
}

/**
 * 更新 EditorJS blocks 中指定的 checklist item 的 checked 状态
 */
export function updateChecklistItemInBlocks(blocks: JournalTodoContent, targetId: string, index: number[]): OutputData | PartialBlock[] | null {
    if (isBlockNoteBlocks(blocks)) {
        const updatedBlocks = cloneBlockNoteBlocks(blocks as BlockNoteTodoBlock[]);
        const block = findBlockNoteBlock(updatedBlocks, targetId);

        if (!block) {
            console.error('Target block not found.');
            return null;
        }

        block.props = {
            ...block.props,
            checked: !block.props?.checked
        };

        return updatedBlocks;
    }

    if (!isEditorJSOutputData(blocks)) {
        return null;
    }

    // 深拷贝 content
    const updatedContent = JSON.parse(JSON.stringify(blocks)) as OutputData;
    const block = updatedContent.blocks.find(block => block.id === targetId);

    if (!block) {
        console.error('Target block not found.');
        return null;
    }

    let currentItem = block.data.items;

    for (let i = 0; i < index.length; i++) {
        if (!currentItem || !currentItem[index[i]]) {
            console.error('Invalid index path.');
            return null;
        }
        if (index.length === i + 1) {
            currentItem = currentItem[index[i]];
        } else {
            currentItem = currentItem[index[i]].items;
        }
    }

    const targetItem = currentItem;
    if (targetItem && targetItem.meta) {
        targetItem.meta.checked = !targetItem.meta.checked;
    } else {
        console.error('Target item not found or missing meta.');
        return null;
    }

    return updatedContent;
}

export function deleteChecklistItemInBlocks(blocks: JournalTodoContent, targetId: string, index: number[]): OutputData | PartialBlock[] | null {
    if (isBlockNoteBlocks(blocks)) {
        const updatedBlocks = cloneBlockNoteBlocks(blocks as BlockNoteTodoBlock[]);
        const removed = removeBlockNoteBlock(updatedBlocks, targetId);

        return removed ? updatedBlocks : null;
    }

    if (!isEditorJSOutputData(blocks)) {
        return null;
    }

    const updatedContent = JSON.parse(JSON.stringify(blocks)) as OutputData;
    const block = updatedContent.blocks.find(block => block.id === targetId);

    if (!block) {
        console.error('Target block not found.');
        return null;
    }

    if (index.length === 1) {
        block.data.items.splice(index[0], 1);

        if (block.data.items.length === 0) {
            const blockIndex = updatedContent.blocks.findIndex(b => b.id === targetId);
            if (blockIndex >= 0) {
                updatedContent.blocks.splice(blockIndex, 1);
            }
        }

        return updatedContent;
    }

    let currentItem = block.data.items;
    for (let i = 0; i < index.length - 1; i++) {
        if (!currentItem || !currentItem[index[i]]) {
            console.error('Invalid index path.');
            return null;
        }
        currentItem = currentItem[index[i]].items;
    }

    if (currentItem && currentItem[index[index.length - 1]]) {
        currentItem.splice(index[index.length - 1], 1);
    }

    return updatedContent;
}

export function addChecklistItemToBlocks(blocks: JournalTodoContent, content: string, selectedGroup: string, newGroupTitle = ''): OutputData | PartialBlock[] {
    if (isBlockNoteBlocks(blocks) || !isEditorJSOutputData(blocks)) {
        const updatedBlocks = isBlockNoteBlocks(blocks) ? cloneBlockNoteBlocks(blocks as BlockNoteTodoBlock[]) : [];
        const newTodoItem = createBlockNoteCheckListItem(content);

        if (selectedGroup === 'new') {
            if (newGroupTitle.trim()) {
                updatedBlocks.push(createBlockNoteHeading(newGroupTitle.trim()));
            }
            updatedBlocks.push(newTodoItem);

            return updatedBlocks;
        }

        let insertIndex = updatedBlocks.length;
        let foundHeader = false;

        for (let i = 0; i < updatedBlocks.length; i++) {
            const block = updatedBlocks[i];

            if (block.type === 'heading' && getInlineContentText(block.content) === selectedGroup) {
                foundHeader = true;
                insertIndex = i + 1;
                continue;
            }

            if (foundHeader && block.type === 'checkListItem') {
                insertIndex = i + 1;
            } else if (foundHeader && block.type === 'heading') {
                break;
            }
        }

        updatedBlocks.splice(insertIndex, 0, newTodoItem);

        return updatedBlocks;
    }

    const currentContent = blocks || { blocks: [] };
    const updatedBlocks = [...(currentContent.blocks || [])];

    if (selectedGroup === 'new') {
        const checklistBlock = {
            id: `todo-${Date.now()}`,
            type: 'listv2',
            data: {
                style: 'checklist',
                items: [
                    {
                        content: content.trim(),
                        items: [],
                        meta: {
                            checked: false
                        }
                    }
                ]
            }
        };

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
            updatedBlocks.push(checklistBlock);
        }
    } else {
        let targetIndex = -1;
        let foundHeader = false;

        for (let i = 0; i < updatedBlocks.length; i++) {
            const block = updatedBlocks[i];

            if (block.type === 'header' && block.data.text === selectedGroup) {
                foundHeader = true;
                continue;
            }

            if (foundHeader && block.type === 'listv2' && block.data.style === 'checklist') {
                targetIndex = i;
            } else if (foundHeader && block.type === 'header') {
                break;
            }
        }

        const newTodoItem = {
            content: content.trim(),
            items: [],
            meta: {
                checked: false
            }
        };

        if (targetIndex >= 0) {
            const targetBlock = { ...updatedBlocks[targetIndex] };
            targetBlock.data = {
                ...targetBlock.data,
                items: [...targetBlock.data.items, newTodoItem]
            };
            updatedBlocks[targetIndex] = targetBlock;
        } else {
            updatedBlocks.push({
                id: `todo-${Date.now()}`,
                type: 'listv2',
                data: {
                    style: 'checklist',
                    items: [newTodoItem]
                }
            });
        }
    }

    return {
        ...currentContent,
        blocks: updatedBlocks
    };
}

export function moveChecklistItemInBlocks(blocks: JournalTodoContent, activeId: string, overId: string): OutputData | PartialBlock[] | null {
    const [activeBlockId, activeIndexStr] = activeId.split('-index-');
    const [overBlockId, overIndexStr] = overId.split('-index-');

    if (!activeBlockId || !activeIndexStr || !overBlockId || !overIndexStr) {
        return null;
    }

    const activeIndex = activeIndexStr.split('-').map(Number);
    const overIndex = overIndexStr.split('-').map(Number);

    if (activeIndex.length !== 1 || overIndex.length !== 1) {
        return null;
    }

    if (isBlockNoteBlocks(blocks)) {
        const updatedBlocks = cloneBlockNoteBlocks(blocks as BlockNoteTodoBlock[]);
        const itemToMove = removeBlockNoteBlock(updatedBlocks, activeBlockId);

        if (!itemToMove) {
            return null;
        }

        const targetIndex = updatedBlocks.findIndex(block => block.id === overBlockId);
        updatedBlocks.splice(targetIndex >= 0 ? targetIndex : updatedBlocks.length, 0, itemToMove);

        return updatedBlocks;
    }

    if (!isEditorJSOutputData(blocks)) {
        return null;
    }

    const updatedContent = JSON.parse(JSON.stringify(blocks)) as OutputData;
    const sourceBlock = updatedContent.blocks.find(b => b.id === activeBlockId);

    if (!sourceBlock) {
        return null;
    }

    const itemToMove = sourceBlock.data.items[activeIndex[0]];
    if (!itemToMove) {
        return null;
    }

    if (activeBlockId === overBlockId) {
        sourceBlock.data.items.splice(activeIndex[0], 1);
        sourceBlock.data.items.splice(overIndex[0], 0, itemToMove);

        return updatedContent;
    }

    sourceBlock.data.items.splice(activeIndex[0], 1);

    if (sourceBlock.data.items.length === 0) {
        const blockIndex = updatedContent.blocks.findIndex(b => b.id === activeBlockId);
        if (blockIndex >= 0) {
            updatedContent.blocks.splice(blockIndex, 1);
        }
    }

    const targetBlock = updatedContent.blocks.find(b => b.id === overBlockId);
    if (targetBlock) {
        targetBlock.data.items.splice(overIndex[0], 0, itemToMove);
    }

    return updatedContent;
}
