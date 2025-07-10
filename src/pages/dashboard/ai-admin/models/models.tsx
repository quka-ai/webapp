import { Card, CardBody } from '@heroui/react';

export default function Models() {
    return (
        <div className="space-y-4">
            <Card>
                <CardBody>
                    <h3 className="text-lg font-semibold mb-2">模型配置管理</h3>
                    <p className="text-default-600">
                        在这里管理具体的AI模型配置，包括GPT-4、embedding模型等的参数设置。
                    </p>
                </CardBody>
            </Card>
            
            <Card>
                <CardBody>
                    <div className="text-center py-12">
                        <p className="text-default-500">模型配置列表组件开发中...</p>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}