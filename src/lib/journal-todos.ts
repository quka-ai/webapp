import type { OutputBlockData, OutputData } from '@editorjs/editorjs';

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
export function extractTodosFromBlocks(blocks: OutputData): TodoList[] {
    if (!blocks || !blocks.blocks) {
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
                    todos[todos.length - 1].list.push(parseCheckList(item.id, [i], dataItem));
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
export function updateChecklistItemInBlocks(blocks: OutputData, targetId: string, index: number[]): OutputData | null {
    if (!blocks || !blocks.blocks) {
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
