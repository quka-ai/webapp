import { Outlet } from 'react-router-dom';

import DashboardLayout from '@/layouts/internal/index';

export default function Component() {
    return (
        <DashboardLayout>
            <Outlet />
        </DashboardLayout>
    );
}
