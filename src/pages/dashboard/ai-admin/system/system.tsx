import { Card, CardBody } from '@heroui/react';

export default function System() {
    return (
        <div className="space-y-4">
            <Card>
                <CardBody>
                    <h3 className="text-lg font-semibold mb-2">系统状态</h3>
                    <p className="text-default-600">
                        查看AI系统的运行状态，包括各类模型的加载情况和系统资源使用情况。
                    </p>
                </CardBody>
            </Card>
            
            <Card>
                <CardBody>
                    <div className="text-center py-12">
                        <p className="text-default-500">系统状态组件开发中...</p>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}