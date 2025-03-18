import { Button, User } from '@heroui/react';
import axios from 'axios';
import React, { useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ref } from 'valtio';

import { CreateUploadKey, UploadFileToKey } from '@/apis/upload';
import { compressImage } from '@/lib/compress';

export interface AvatarUploadProps {
    src: string;
    currentSelectedSpace: string;
    onChange: (file: File) => void;
}

const AvatarUpload = React.forwardRef(({ src, currentSelectedSpace, onChange }: AvatarUploadProps, ref: React.ForwardedRef<React.ReactNode>) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(src);
    const { t } = useTranslation();

    useEffect(() => {
        setPreviewUrl(src);
    }, [src]);
    // 当用户选择文件时触发
    const handleFileChange = event => {
        const file = event.target.files[0];
        // 创建预览图片
        if (file) {
            try {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPreviewUrl(reader.result);
                };
                reader.readAsDataURL(file);
                setSelectedFile(file);
                onChange && onChange(file);
            } catch (e: any) {
                console.error(e);
            }
        }
    };

    useImperativeHandle(ref, () => ({
        handleSubmit
    }));

    // 提交表单时触发
    const handleSubmit = async event => {
        event && event.preventDefault();

        try {
            let result: CompressResult = {};
            let fileKind = '';
            let file = selectedFile;
            if (file && file.type.startsWith('image')) {
                result = await compressImage(selectedFile, 0.7, 0.3);
                if (result.success) {
                    file = result.file;
                }
                fileKind = 'image';
            } else {
                toast.error('Wrong image type');
                return;
            }

            if (result.error) {
                toast.error(result.error);

                return {
                    success: 0
                };
            }

            const resp = await CreateUploadKey(currentSelectedSpace, 'user-profile', fileKind, file.name, file.size);

            if (resp.status === 'exist') {
                setSelectedFile(null);
                return {
                    success: true,
                    file: {
                        url: resp.url
                    }
                };
            } else {
                await UploadFileToKey(resp.key, file.type, result.file || file);
            }
            setSelectedFile(null);
            return {
                success: true,
                file: {
                    type: fileKind,
                    url: resp.url
                }
            };
        } catch (e: Error) {
            throw {
                success: false,
                error: e.message
            };
        }
    };

    function cancelUpdate() {
        setSelectedFile(null);
        setPreviewUrl(src);
        uploadInput.current.value = '';
        onChange(undefined);
    }

    const uploadInput = React.useRef();

    function handleClick() {
        uploadInput.current.click();
    }

    return (
        <div className="flex flex-col gap-2">
            <form onSubmit={handleSubmit} className=" hidden">
                <input ref={uploadInput} type="file" accept="image/*" onChange={handleFileChange} />
            </form>
            {previewUrl && <img src={previewUrl} alt="avatar" className="object-cover my-2 w-16 h-16 cursor-pointer rounded-full" onClick={handleClick} />}
            {selectedFile && (
                <Button onPress={cancelUpdate} color="warning" className="w-20" size="sm">
                    {t('Cancel')}
                </Button>
            )}
        </div>
    );
});

export default AvatarUpload;
