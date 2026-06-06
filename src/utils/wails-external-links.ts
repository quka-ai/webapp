/**
 * Wails 全局外部链接处理器
 *
 * 自动拦截页面中的外部链接点击、触摸和键盘操作。
 * http/https/mailto/tel 使用 window.runtime.BrowserOpenURL 打开。
 * file:// 使用 Wails App.OpenLocalPath 打开，避免 WebView 直接处理本地文件协议。
 * 兼容 heroui 的 onPress 事件系统以及原生 DOM 事件
 *
 * 支持的事件类型：
 * - 鼠标点击 (click)
 *
 * 使用方法：在应用入口引入此文件即可生效
 * import '@/utils/wails-external-links';
 */

interface WailsRuntime {
    BrowserOpenURL: (url: string) => void;
}

interface WailsAppBridge {
    OpenLocalPath?: (req: { url: string }) => Promise<void> | void;
}

interface ExtendedWindow extends Window {
    runtime?: WailsRuntime;
    go?: {
        main?: {
            App?: WailsAppBridge;
        };
    };
}

// 确保代码在全局执行
const initializeExternalLinksHandler = () => {
    console.log('[Wails Handler] Checking runtime availability...', {
        hasWindow: typeof window !== 'undefined',
        hasRuntime: !!(window as ExtendedWindow).runtime,
        hasBrowserOpenURL: !!(window as ExtendedWindow).runtime?.BrowserOpenURL,
        hasOpenLocalPath: !!(window as ExtendedWindow).go?.main?.App?.OpenLocalPath
    });

    // 检测是否在 Wails 环境中
    if (typeof window === 'undefined') {
        console.warn('[Wails Handler] Window not available');
        return false;
    }

    if (!(window as ExtendedWindow).runtime?.BrowserOpenURL && !(window as ExtendedWindow).go?.main?.App?.OpenLocalPath) {
        console.warn('[Wails Handler] Wails link APIs are not available - this is normal in development mode');
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

        if (url.protocol === 'file:') {
            const openLocalPath = (window as ExtendedWindow).go?.main?.App?.OpenLocalPath;
            if (!openLocalPath) {
                console.warn('[Wails Handler] OpenLocalPath is not available for file URL:', url.href);
                return;
            }
            console.log(`[Wails Handler] Intercepting local file link: ${url.href}`);
            Promise.resolve(openLocalPath({ url: url.href }))
                .then(() => console.log(`[Wails Handler] ✓ Opened local path: ${url.href}`))
                .catch(error => console.error('[Wails Handler] Failed to open local path:', error));
            return;
        }

        const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
        if (!allowedProtocols.includes(url.protocol)) {
            return;
        }

        const browserOpenURL = (window as ExtendedWindow).runtime?.BrowserOpenURL;
        if (!browserOpenURL) {
            console.warn('[Wails Handler] BrowserOpenURL is not available for external URL:', url.href);
            return;
        }

        console.log(`[Wails Handler] Intercepting link: ${url.href}`);
        // 调用 Wails 的 BrowserOpenURL 方法
        try {
            browserOpenURL(url.href);
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

    const isInsideEditableBlockNote = (link: HTMLAnchorElement): boolean => {
        const editor = link.closest('.blocknote-editor');

        return Boolean(editor && !editor.classList.contains('blocknote-editor--readonly'));
    };

    // 鼠标点击事件处理器
    const clickHandler = (e: MouseEvent) => {
        console.log('[Wails Handler] Click event detected', e);
        // 过滤无效点击：
        // - 已经 preventDefault 的事件
        // - 非左键点击 (button !== 0)
        // - 按下了 metaKey (⌘/Cmd) 或 altKey 或 ctrlKey 或 shiftKey
        if (e.defaultPrevented || 0 !== e.button || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return;

        // 从事件目标向上遍历查找 A 标签
        const link = findLinkInAncestors(e.target as Node);
        if (link) {
            if (isInsideEditableBlockNote(link)) {
                e.preventDefault();
                e.stopPropagation();

                return;
            }

            e.preventDefault();
            handleExternalLink(link);
        }
    };

    // 在 document 上使用捕获阶段监听事件，确保在 herui 事件处理器之前捕获
    // 这允许我们阻止事件并使用 BrowserOpenURL
    document.addEventListener('click', clickHandler, true); // 使用捕获阶段
    console.log('[Wails Handler] ✓ Initialized successfully - click events are being monitored');

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
