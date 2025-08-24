import { Button, Tab, Tabs } from '@heroui/react';
import { Icon } from '@iconify/react';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';

import { useRole } from '@/hooks/use-role';

interface AIAdminProps {
    className?: string;
}

const AIAdmin = React.forwardRef<HTMLDivElement, AIAdminProps>(({ className, ...props }, ref) => {
    const { t } = useTranslation('ai-admin');
    const { t: tGlobal } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { isManager } = useRole();

    function back() {
        // 直接返回仪表板，因为AI管理是全局功能
        navigate('/dashboard');
    }

    // 从当前路径中提取当前选中的tab
    const getCurrentTab = () => {
        const path = location.pathname;
        if (path.includes('/providers')) return 'providers';
        if (path.includes('/models')) return 'models';
        if (path.includes('/usage')) return 'usage';
        return 'providers'; // 默认选中providers
    };

    const currentTab = getCurrentTab();

    // 权限检查：只有manager（admin或chief）可以访问
    useEffect(() => {
        if (!isManager) {
            navigate('/dashboard', { replace: true });
            return;
        }
    }, [isManager, navigate]);

    // 如果是根路径，重定向到providers
    useEffect(() => {
        if (location.pathname === '/dashboard/ai-admin' || location.pathname === '/dashboard/ai-admin/') {
            navigate('/dashboard/ai-admin/providers', { replace: true });
        }
    }, [location.pathname, navigate]);

    const handleTabChange = (key: string) => {
        navigate(`/dashboard/ai-admin/${key}`);
    };

    // 如果用户没有管理权限，不渲染内容
    if (!isManager) {
        return null;
    }

    return (
        <div className="w-full flex flex-col items-center">
            <div className="w-full p-4 box-border">
                <Button startContent={<Icon icon="material-symbols:arrow-back-ios-rounded" />} variant="bordered" onPress={back}>
                    {tGlobal('Back')}
                </Button>
            </div>
            <div className="w-full max-w-2xl flex-1 p-4">
                {/* Title */}
                <div className="flex items-center gap-x-3">
                    <h1 className="text-3xl font-bold leading-9 text-default-foreground">{tGlobal('AI Model Management')}</h1>
                </div>
                <h2 className="mt-2 text-small text-default-500">{t('Manage AI model providers, model configurations and usage settings')}</h2>
                {/*  Tabs */}
                <Tabs
                    fullWidth
                    selectedKey={currentTab}
                    onSelectionChange={(key) => handleTabChange(key as string)}
                    classNames={{
                        base: 'mt-6',
                        cursor: 'bg-content1 dark:bg-content1',
                        panel: 'w-full p-0 pt-4'
                    }}
                >
                    <Tab key="providers" title={t('Model Providers')}>
                        <Outlet />
                    </Tab>
                    <Tab key="models" title={t('Model Configuration')}>
                        <Outlet />
                    </Tab>
                    <Tab key="usage" title={t('Usage Configuration')}>
                        <Outlet />
                    </Tab>
                </Tabs>
            </div>
        </div>
    );
});

AIAdmin.displayName = 'AIAdmin';

export default AIAdmin;