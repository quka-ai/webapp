import { Card, CardBody } from '@heroui/react';

export default function Providers() {
    return (
        <div className="space-y-4">
            <Card>
                <CardBody>
                    <h3 className="text-lg font-semibold mb-2">模型提供商管理</h3>
                    <p className="text-default-600">
                        在这里管理AI模型提供商，包括OpenAI、Azure OpenAI等服务商的配置。
                    </p>
                </CardBody>
            </Card>
            
            <Card>
                <CardBody>
                    <div className="text-center py-12">
                        <p className="text-default-500">提供商列表组件开发中...</p>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}