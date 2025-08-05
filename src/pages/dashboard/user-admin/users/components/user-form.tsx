import {
    ModalBody,
    ModalFooter,
    Input,
    Button,
    Modal,
    ModalContent,
    ModalHeader
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { UserFormData, FormErrors, CreateUserResponse } from '@/types/user-admin';

interface UserFormProps {
    isLoading: boolean;
    createdUser: CreateUserResponse | null;
    onSubmit: (data: UserFormData) => Promise<boolean>;
    onClose: () => void;
}

export default function UserForm({ isLoading, createdUser, onSubmit, onClose }: UserFormProps) {
    const { t } = useTranslation('user-admin');
    
    const [formData, setFormData] = useState<UserFormData>({
        name: '',
        email: '',
    });
    
    const [errors, setErrors] = useState<FormErrors>({});
    const [showToken, setShowToken] = useState(false);
    
    // 当用户创建成功时，显示Token
    useEffect(() => {
        if (createdUser) {
            setShowToken(true);
        }
    }, [createdUser]);
    
    // 表单验证
    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};
        
        // 验证用户名
        if (!formData.name || !formData.name.trim()) {
            newErrors.name = t('Name is required');
        } else if (formData.name.trim().length < 2) {
            newErrors.name = t('Name must be at least 2 characters');
        } else if (formData.name.trim().length > 50) {
            newErrors.name = t('Name must be less than 50 characters');
        }
        
        // 验证邮箱
        if (!formData.email || !formData.email.trim()) {
            newErrors.email = t('Email is required');
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email.trim())) {
                newErrors.email = t('Please enter a valid email address');
            }
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    
    // 处理表单提交
    const handleSubmit = async () => {
        if (!validateForm()) {
            return;
        }
        
        const trimmedData = {
            name: formData.name.trim(),
            email: formData.email.trim().toLowerCase(),
        };
        
        const success = await onSubmit(trimmedData);
        if (success) {
            // 成功创建用户后，不要关闭模态框，让组件显示token
            // 父组件会设置 createdUser，触发token显示
        }
    };
    
    // 处理输入变化
    const handleInputChange = (field: keyof UserFormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // 清除相关错误
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };
    
    // 复制到剪贴板
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success(t('Copied to clipboard'));
    };
    
    // 处理关闭
    const handleClose = () => {
        setFormData({ name: '', email: '' });
        setErrors({});
        setShowToken(false);
        onClose();
    };
    
    // 如果显示Token，渲染Token显示界面
    if (showToken && createdUser) {
        return (
            <>
                <ModalBody>
                    <div className="space-y-4">
                        <div className="text-center">
                            <h3 className="text-lg font-semibold text-default-900 mb-2">{t('Access Token Created')}</h3>
                            <p className="text-sm text-default-600">{t('Please save this token securely. It will not be shown again.')}</p>
                        </div>
                        
                        <div className="bg-default-50 border border-default-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-default-700">{t('Access Token')}</span>
                                <Button
                                    size="sm"
                                    variant="light"
                                    onPress={() => copyToClipboard(createdUser.access_token)}
                                    startContent={<Icon icon="tabler:copy" className="h-4 w-4" />}
                                >
                                    {t('Copy')}
                                </Button>
                            </div>
                            <code className="text-xs font-mono text-default-700 break-all block bg-default-100 px-3 py-2 rounded">
                                {createdUser.access_token}
                            </code>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button color="primary" onPress={handleClose} className="w-full">
                        {t('Close')}
                    </Button>
                </ModalFooter>
            </>
        );
    }
    
    // 渲染表单
    return (
        <>
            <ModalBody>
                <div className="space-y-4">
                    <p className="text-default-600">
                        {t('Create a new user account. An access token will be automatically generated.')}
                    </p>
                    
                    <Input
                        label={t('Name')}
                        placeholder={t('Enter user name')}
                        value={formData.name}
                        onValueChange={(value) => handleInputChange('name', value)}
                        isInvalid={!!errors.name}
                        errorMessage={errors.name}
                        isRequired
                        startContent={<Icon icon="solar:user-linear" className="h-4 w-4 text-default-400" />}
                    />
                    
                    <Input
                        label={t('Email')}
                        placeholder={t('Enter email address')}
                        type="email"
                        value={formData.email}
                        onValueChange={(value) => handleInputChange('email', value)}
                        isInvalid={!!errors.email}
                        errorMessage={errors.email}
                        isRequired
                        startContent={<Icon icon="solar:letter-linear" className="h-4 w-4 text-default-400" />}
                    />
                    
                    <div className="bg-default-50 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                            <Icon icon="solar:info-circle-linear" className="h-5 w-5 text-default-400 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-default-600">
                                <p className="font-medium mb-1">{t('What happens next')}:</p>
                                <ul className="space-y-1 text-xs">
                                    <li>• {t('A user account will be created with the provided information')}</li>
                                    <li>• {t('An access token will be automatically generated')}</li>
                                    <li>• {t('The user can use this token to access the API')}</li>
                                    <li>• {t('You can regenerate the token later if needed')}</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </ModalBody>
            <ModalFooter>
                <Button variant="light" onPress={handleClose}>
                    {t('Cancel')}
                </Button>
                <Button 
                    color="primary" 
                    onPress={handleSubmit}
                    isLoading={isLoading}
                    isDisabled={!formData.name.trim() || !formData.email.trim()}
                >
                    {t('Create User')}
                </Button>
            </ModalFooter>
        </>
    );
}