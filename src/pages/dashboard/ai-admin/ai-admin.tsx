import { Tab, Tabs } from '@heroui/react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

export default function AIAdmin() {
    const navigate = useNavigate();
    const location = useLocation();

    // 从当前路径中提取当前选中的tab
    const getCurrentTab = () => {
        const path = location.pathname;
        if (path.includes('/providers')) return 'providers';
        if (path.includes('/models')) return 'models';
        if (path.includes('/system')) return 'system';
        if (path.includes('/usage')) return 'usage';
        return 'providers'; // 默认选中providers
    };

    const currentTab = getCurrentTab();

    // 如果是根路径，重定向到providers
    useEffect(() => {
        if (location.pathname === '/dashboard/ai-admin' || location.pathname === '/dashboard/ai-admin/') {
            navigate('/dashboard/ai-admin/providers', { replace: true });
        }
    }, [location.pathname, navigate]);

    const handleTabChange = (key: string) => {
        navigate(`/dashboard/ai-admin/${key}`);
    };

    return (
        <div className="flex flex-col h-full">
            {/* 页面标题 */}
            <div className="flex flex-col gap-2 mb-6">
                <h1 className="text-2xl font-bold">AI 模型管理</h1>
                <p className="text-default-500">管理AI模型提供商、模型配置和系统设置</p>
            </div>

            {/* Tab导航 */}
            <div className="flex flex-col flex-1">
                <Tabs
                    selectedKey={currentTab}
                    onSelectionChange={(key) => handleTabChange(key as string)}
                    variant="underlined"
                    classNames={{
                        tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
                        cursor: "w-full bg-primary",
                        tab: "max-w-fit px-0 h-12",
                        tabContent: "group-data-[selected=true]:text-primary"
                    }}
                >
                    <Tab key="providers" title="模型提供商">
                        <div className="py-4">
                            <Outlet />
                        </div>
                    </Tab>
                    <Tab key="models" title="模型配置">
                        <div className="py-4">
                            <Outlet />
                        </div>
                    </Tab>
                    <Tab key="system" title="系统状态">
                        <div className="py-4">
                            <Outlet />
                        </div>
                    </Tab>
                    <Tab key="usage" title="使用配置">
                        <div className="py-4">
                            <Outlet />
                        </div>
                    </Tab>
                </Tabs>
            </div>
        </div>
    );
}