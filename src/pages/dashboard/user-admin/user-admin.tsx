import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';

import { useRole } from '@/hooks/use-role';

interface UserAdminProps {
    className?: string;
}

const UserAdmin = React.forwardRef<HTMLDivElement, UserAdminProps>(({ className, ...props }, ref) => {
    const { t } = useTranslation('user-admin');
    const { t: tGlobal } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { isManager } = useRole();

    function back() {
        navigate('/dashboard');
    }

    // 权限检查：只有manager（admin或chief）可以访问
    useEffect(() => {
        if (!isManager) {
            navigate('/dashboard', { replace: true });
            return;
        }
    }, [isManager, navigate]);

    // 如果是根路径，重定向到users
    useEffect(() => {
        if (location.pathname === '/dashboard/user-admin' || location.pathname === '/dashboard/user-admin/') {
            navigate('/dashboard/user-admin/users', { replace: true });
        }
    }, [location.pathname, navigate]);

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
                    <h1 className="text-3xl font-bold leading-9 text-default-foreground">{t('User Management')}</h1>
                </div>
                <h2 className="mt-2 text-small text-default-500">{t('Manage user accounts, create new users and regenerate access tokens')}</h2>
                
                {/* Content */}
                <div className="mt-6 w-full">
                    <Outlet />
                </div>
            </div>
        </div>
    );
});

UserAdmin.displayName = 'UserAdmin';

export default UserAdmin;