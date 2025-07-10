import { Card, CardBody } from '@heroui/react';

export default function Usage() {
    return (
        <div className="space-y-4">
            <Card>
                <CardBody>
                    <h3 className="text-lg font-semibold mb-2">使用配置</h3>
                    <p className="text-default-600">
                        配置各个功能模块使用的AI模型，包括聊天、向量化、视觉等功能的模型选择。
                    </p>
                </CardBody>
            </Card>
            
            <Card>
                <CardBody>
                    <div className="text-center py-12">
                        <p className="text-default-500">使用配置组件开发中...</p>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}