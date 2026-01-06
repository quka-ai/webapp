import type { BlockToolConstructorOptions } from '@editorjs/editorjs';

import ImageTool from '@editorjs/image';

import './resizable-image-tool.css';

// 扩展 ImageToolData 类型以包含宽度信息
interface ResizableImageData {
    caption: string;
    withBorder: boolean;
    withBackground: boolean;
    stretched: boolean;
    file: {
        url: string;
    };
    width?: number; // 图片宽度（百分比）
}

/**
 * 可调整大小的图片工具
 * 通过包装 @editorjs/image 添加交互式大小调整功能
 */
export default class ResizableImageTool extends ImageTool {
    private resizeWrapper: HTMLElement | null = null;
    private resizeHandle: HTMLElement | null = null;
    private isResizing = false;
    private startX = 0;
    private startWidth = 0;
    private currentWidth = 100; // 默认 100%
    private isReadOnly: boolean;
    private savedWidth: number | undefined; // 保存宽度的专用变量

    constructor(options: BlockToolConstructorOptions<ResizableImageData, any>) {
        super(options);
        this.isReadOnly = options.readOnly || false;

        // 从保存的数据中恢复宽度
        if (options.data && options.data.width) {
            this.currentWidth = options.data.width;
            this.savedWidth = options.data.width;
        }
    }

    /**
     * 重写 render 方法以添加调整大小功能
     */
    render(): HTMLDivElement {
        const wrapper = super.render();

        // 延迟创建 resize wrapper，确保图片元素已经渲染
        setTimeout(() => {
            this.wrapWithResizeContainer(wrapper);
        }, 0);

        return wrapper;
    }

    /**
     * 包装原始内容以支持调整大小
     */
    private wrapWithResizeContainer(originalWrapper: HTMLElement): void {
        const parent = originalWrapper.parentElement;
        if (!parent || this.resizeWrapper) return;

        // 创建外层包装器
        this.resizeWrapper = document.createElement('div');
        this.resizeWrapper.classList.add('resizable-image-wrapper');
        this.resizeWrapper.style.width = `${this.currentWidth}%`;
        this.resizeWrapper.setAttribute('data-width', `${Math.round(this.currentWidth)}%`);

        // 如果是只读模式，标记属性
        if (this.isReadOnly) {
            this.resizeWrapper.setAttribute('data-readonly', 'true');
        }

        // 在原始wrapper之前插入resize wrapper
        parent.insertBefore(this.resizeWrapper, originalWrapper);

        // 将原始wrapper移动到resize wrapper中
        this.resizeWrapper.appendChild(originalWrapper);

        // 创建调整大小的手柄
        if (!this.isReadOnly) {
            this.createResizeHandle();
        }
    }

    /**
     * 创建调整大小的手柄
     */
    private createResizeHandle(): void {
        if (!this.resizeWrapper) return;

        this.resizeHandle = document.createElement('div');
        this.resizeHandle.classList.add('resize-handle');
        this.resizeHandle.title = 'Drag to resize';

        // 绑定拖拽事件
        this.resizeHandle.addEventListener('mousedown', this.startResize.bind(this));

        this.resizeWrapper.appendChild(this.resizeHandle);
    }

    /**
     * 开始调整大小
     */
    private startResize(e: MouseEvent): void {
        e.preventDefault();
        e.stopPropagation();

        this.isResizing = true;
        this.startX = e.clientX;
        this.startWidth = this.resizeWrapper?.offsetWidth || 0;

        // 添加全局事件监听
        document.addEventListener('mousemove', this.handleResize);
        document.addEventListener('mouseup', this.stopResize);

        // 改变光标
        document.body.style.cursor = 'nwse-resize';
        document.body.style.userSelect = 'none';
    }

    /**
     * 处理调整大小
     */
    private handleResize = (e: MouseEvent): void => {
        if (!this.isResizing || !this.resizeWrapper) return;

        const deltaX = e.clientX - this.startX;
        const containerWidth = this.resizeWrapper.parentElement?.offsetWidth || 1;
        const newWidth = this.startWidth + deltaX;
        const newWidthPercent = (newWidth / containerWidth) * 100;

        // 限制宽度范围：20% - 100%
        const clampedWidth = Math.max(20, Math.min(100, newWidthPercent));

        this.currentWidth = clampedWidth;
        this.resizeWrapper.style.width = `${clampedWidth}%`;
        this.resizeWrapper.setAttribute('data-width', `${Math.round(clampedWidth)}%`);
        this.resizeWrapper.classList.add('resizing');
    };

    /**
     * 停止调整大小
     */
    private stopResize = (): void => {
        if (!this.isResizing) return;

        this.isResizing = false;

        // 移除全局事件监听
        document.removeEventListener('mousemove', this.handleResize);
        document.removeEventListener('mouseup', this.stopResize);

        // 恢复光标
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        if (this.resizeWrapper) {
            this.resizeWrapper.classList.remove('resizing');
        }

        // 保存宽度数据
        this.savedWidth = this.currentWidth;

        // 通知 EditorJS 数据已更改，触发 onChange 回调
        try {
            const blockApi = (this as any).block;
            if (blockApi && typeof blockApi.dispatchChange === 'function') {
                blockApi.dispatchChange();
            }
        } catch (e) {
            console.error('Failed to trigger change event:', e);
        }
    };

    /**
     * 重写 save 方法以保存宽度信息
     */
    save(): ResizableImageData {
        const data = super.save() as ResizableImageData;

        // 保存当前宽度
        data.width = this.savedWidth !== undefined ? this.savedWidth : this.currentWidth;

        return data;
    }

    /**
     * 重写 validate 方法
     */
    validate(savedData: ResizableImageData): boolean {
        // 恢复宽度
        if (savedData.width) {
            this.currentWidth = savedData.width;
        }

        return super.validate(savedData);
    }
}
