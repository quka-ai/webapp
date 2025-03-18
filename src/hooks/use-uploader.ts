import { useState } from 'react';
import { toast } from 'sonner';

import { CreateUploadKey, UploadFileToKey } from '@/apis/upload';

export interface UploadResult {
    success: boolean;
    file?: {
        name: string;
        url: string;
    };
}

export function useUploader() {
    const [isUploading, setIsUploading] = useState(false);
    const uploader = async (spaceID: string, file: File, objType: string, objKind: string): Promise<UploadResult> => {
        setIsUploading(true);
        try {
            const resp = await CreateUploadKey(spaceID, objType, objKind, file.name, file.size);

            if (resp.status === 'exist') {
                return {
                    success: true,
                    file: {
                        name: file.name,
                        url: resp.url
                    }
                };
            }

            await UploadFileToKey(resp.key, file.type, file);

            return {
                success: true,
                file: {
                    name: file.name,
                    url: resp.url
                }
            };
        } catch (e: any) {
            toast.error(e.message);
            return {
                success: false
            };
        }
        setIsUploading(false);
    };

    return { uploader, isUploading };
}
