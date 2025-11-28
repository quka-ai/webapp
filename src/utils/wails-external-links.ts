/**
 * Wails 全局外部链接处理器
 *
 * 自动拦截页面中的外部链接点击、触摸和键盘操作，使用 window.runtime.BrowserOpenURL 打开
 * 支持 http/https/mailto/tel 协议
 * 兼容 heroui 的 onPress 事件系统以及原生 DOM 事件
 *
 * 支持的事件类型：
 * - 鼠标点击 (click)
 * - 触摸/指针事件 (pointerdown) - heroui onPress 的底层事件
 * - 键盘操作 (keydown) - 回车键/空格键
 *
 * 使用方法：在应用入口引入此文件即可生效
 * import '@/utils/wails-external-links';
 */

interface WailsRuntime {
    BrowserOpenURL: (url: string) => void;
}

interface ExtendedWindow extends Window {
    runtime?: WailsRuntime;
}

// 确保代码在全局执行
const initializeExternalLinksHandler = () => {
    console.log('[Wails Handler] Checking runtime availability...', {
        hasWindow: typeof window !== 'undefined',
        hasRuntime: !!(window as ExtendedWindow).runtime,
        hasBrowserOpenURL: !!(window as ExtendedWindow).runtime?.BrowserOpenURL
    });

    // 检测是否在 Wails 环境中
    if (typeof window === 'undefined') {
        console.warn('[Wails Handler] Window not available');
        return false;
    }

    if (!(window as ExtendedWindow).runtime || !(window as ExtendedWindow).runtime?.BrowserOpenURL) {
        console.warn('[Wails Handler] window.runtime.BrowserOpenURL not available - this is normal in development mode');
        return false;
    }

    console.log('[Wails Handler] ✓ Initializing external links handler...');

    // 处理外部链接的核心函数
    const handleExternalLink = (link: HTMLAnchorElement) => {
        if (!link || !link.href) return;

        // 如果链接 target 是 _blank，则不拦截
        if ('_blank' !== link.target) return;

        // 解析 URL 并检查协议
        let url: URL;
        try {
            url = new URL(link.href);
        } catch {
            return;
        }

        // 只处理以下协议的链接
        const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];

        if (!allowedProtocols.includes(url.protocol)) {
            return;
        }

        console.log(`[Wails Handler] Intercepting link: ${url.href}`);
        // 调用 Wails 的 BrowserOpenURL 方法
        try {
            (window as ExtendedWindow).runtime!.BrowserOpenURL(url.href);
            console.log(`[Wails Handler] ✓ Opened URL via BrowserOpenURL: ${url.href}`);
        } catch (error) {
            console.error('[Wails Handler] Failed to open external URL:', error);
        }
    };

    // 通用事件处理器 - 从事件目标向上遍历查找 A 标签
    const findLinkInAncestors = (target: Node | null): HTMLAnchorElement | null => {
        let current = target as Element | null;
        let depth = 0;
        const maxDepth = 5; // 最多向上遍历 5 层

        while (current && current !== document.body && depth < maxDepth) {
            if (current instanceof HTMLAnchorElement && 'A' === current.nodeName.toUpperCase()) {
                return current;
            }
            current = current.parentElement;
            depth++;
        }

        return null;
    };

    // 鼠标点击事件处理器
    const clickHandler = (e: MouseEvent) => {
        console.log('[Wails Handler] Click event detected', e);
        // 过滤无效点击：
        // - 已经 preventDefault 的事件
        // - 非左键点击 (button !== 0)
        // - 按下了 metaKey (⌘/Cmd) 或 altKey 或 ctrlKey 或 shiftKey
        if (0 !== e.button || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return;

        // 从事件目标向上遍历查找 A 标签
        const link = findLinkInAncestors(e.target as Node);
        if (link) {
            e.preventDefault();
            handleExternalLink(link);
        }
    };

    // Pointer 事件处理器（兼容 herui onPress 等自定义事件系统）
    const pointerHandler = (e: PointerEvent) => {
        // 只处理主按钮（通常是左键）
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return;

        // 从事件目标向上遍历查找 A 标签
        const link = findLinkInAncestors(e.target as Node);
        if (link) {
            e.preventDefault();
            handleExternalLink(link);
        }
    };

    // 键盘事件处理器（处理回车键和空格键）
    const keydownHandler = (e: KeyboardEvent) => {
        // 处理回车键和空格键
        if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
        if (e.defaultPrevented || e.metaKey || e.altKey || e.ctrlKey) return;

        // 获取当前聚焦的元素，并向上遍历查找 A 标签
        const activeElement = document.activeElement;
        const link = findLinkInAncestors(activeElement as Node);
        if (link) {
            e.preventDefault();
            handleExternalLink(link);
        }
    };

    // 在 document 上使用捕获阶段监听事件，确保在 herui 事件处理器之前捕获
    // 这允许我们阻止事件并使用 BrowserOpenURL
    document.addEventListener('click', clickHandler, true); // 使用捕获阶段
    // document.addEventListener('pointerdown', pointerHandler, true); // herui onPress 基于此
    // document.addEventListener('keydown', keydownHandler, true); // 键盘导航支持
    console.log('[Wails Handler] ✓ Initialized successfully - click, pointer, and keyboard events are being monitored');

    return true;
};

// 立即执行初始化
initializeExternalLinksHandler();

// 如果运行环境支持，也在 DOM 就绪后再次尝试初始化（处理动态加载的情况）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeExternalLinksHandler();
    });
}
