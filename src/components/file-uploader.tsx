import { Button, Chip, Image, Progress } from '@heroui/react';
import { Icon } from '@iconify/react';
import * as React from 'react';
import Dropzone, { type DropzoneProps, type FileRejection } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { useControllableState } from '@/hooks/use-controllable-state';
import { cn, formatBytes } from '@/lib/utils';

interface FileUploaderProps extends React.HTMLAttributes<HTMLDivElement> {
    /**
     * Value of the uploader.
     * @type File[]
     * @default undefined
     * @example value={files}
     */
    value?: File[];

    /**
     * Function to be called when the value changes.
     * @type (files: File[]) => void
     * @default undefined
     * @example onValueChange={(files) => setFiles(files)}
     */
    onValueChange?: (files: File[]) => void;

    /**
     * Function to be called when files are uploaded.
     * @type (files: File[]) => Promise<void>
     * @default undefined
     * @example onUpload={(files) => uploadFiles(files)}
     */
    onUpload?: (files: File[]) => Promise<void>;

    /**
     * Progress of the uploaded files.
     * @type Record<string, number> | undefined
     * @default undefined
     * @example progresses={{ "file1.png": 50 }}
     */
    progresses?: Record<string, number>;

    /**
     * Accepted file types for the uploader.
     * @type { [key: string]: string[]}
     * @default
     * ```ts
     * { "image/*": [] }
     * ```
     * @example accept={["image/png", "image/jpeg"]}
     */
    accept?: DropzoneProps['accept'];

    /**
     * Maximum file size for the uploader.
     * @type number | undefined
     * @default 1024 * 1024 * 2 // 2MB
     * @example maxSize={1024 * 1024 * 2} // 2MB
     */
    maxSize?: DropzoneProps['maxSize'];

    /**
     * Maximum number of files for the uploader.
     * @type number | undefined
     * @default 1
     * @example maxFileCount={4}
     */
    maxFileCount?: DropzoneProps['maxFiles'];

    /**
     * Whether the uploader should accept multiple files.
     * @type boolean
     * @default false
     * @example multiple
     */
    multiple?: boolean;

    /**
     * Whether the uploader is disabled.
     * @type boolean
     * @default false
     * @example disabled
     */
    disabled?: boolean;

    /**
     * Whether interactions should be blocked while still showing a custom prompt.
     * @type boolean
     * @default false
     */
    blocked?: boolean;

    /**
     * Function to be called when a blocked uploader is clicked or dragged over.
     * @type () => void
     * @default undefined
     */
    onBlockedInteract?: () => void;
}

export function FileUploader(props: FileUploaderProps) {
    const {
        value: valueProp,
        onValueChange,
        onUpload,
        progresses,
        accept = {
            'image/*': []
        },
        maxSize = 1024 * 1024 * 5,
        maxFileCount = 1,
        multiple = false,
        disabled = false,
        blocked = false,
        onBlockedInteract,
        className,
        ...dropzoneProps
    } = props;

    const [files, setFiles] = useControllableState({
        prop: valueProp,
        onChange: onValueChange
    });

    const { t } = useTranslation();

    const acceptLabels = React.useMemo(() => {
        const entries = Object.entries(accept ?? {});

        if (entries.length === 0) {
            return [];
        }

        return entries
            .flatMap(([mimeType, extensions]) => {
                if (extensions && extensions.length > 0) {
                    return extensions.map(extension => extension.replace(/^\./, '').toLowerCase());
                }

                if (mimeType.endsWith('/*')) {
                    return [mimeType.replace('/*', '')];
                }

                const subtype = mimeType.split('/')[1];
                if (!subtype) {
                    return [];
                }

                return [
                    subtype
                        .replace('vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx')
                        .replace('vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx')
                        .replace('plain', 'txt')
                        .replace('markdown', 'md')
                ];
            })
            .filter((label, index, list) => label && list.indexOf(label) === index);
    }, [accept]);

    const onDrop = React.useCallback(
        (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
            if (!multiple && maxFileCount === 1 && acceptedFiles.length > 1) {
                toast.error(t('MemoryUploadLimit', { times: maxFileCount }));
                return;
            }

            if ((files?.length ?? 0) + acceptedFiles.length > maxFileCount) {
                toast.error(t('MemoryUploadLimit', { times: maxFileCount }));
                return;
            }

            const newFiles = acceptedFiles.map(file =>
                Object.assign(file, {
                    preview: URL.createObjectURL(file)
                })
            );

            const updatedFiles = files ? [...files, ...newFiles] : newFiles;

            setFiles(updatedFiles);

            if (rejectedFiles.length > 0) {
                rejectedFiles.forEach(({ file, errors }) => {
                    toast.error(t('FileRejected', { title: file.name }), {
                        description: errors.map(error => error.message).join('\n')
                    });
                });
            }

            if (onUpload && updatedFiles.length > 0 && updatedFiles.length <= maxFileCount) {
                const target = updatedFiles.length > 0 ? t('Files', { count: updatedFiles.length }) : t('File');

                toast.promise(onUpload(updatedFiles), {
                    loading: t(`Uploading`, { target: target }),
                    success: () => {
                        setFiles([]);
                        return t('Uploaded', { target: target });
                    },
                    error: t(`FailedToUpload`, { target: target })
                });
            }
        },

        [files, maxFileCount, multiple, onUpload, setFiles]
    );

    function onRemove(index: number) {
        if (!files) return;
        const newFiles = files.filter((_, i) => i !== index);
        setFiles(newFiles);
        onValueChange?.(newFiles);
    }

    // Revoke preview url when component unmounts
    React.useEffect(() => {
        return () => {
            if (!files) return;
            files.forEach(file => {
                if (isFileWithPreview(file)) {
                    URL.revokeObjectURL(file.preview);
                }
            });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const isDisabled = disabled || (files?.length ?? 0) >= maxFileCount;
    const isBlocked = blocked && !isDisabled;

    const handleBlockedInteract = React.useCallback(
        (event: React.SyntheticEvent<HTMLDivElement>) => {
            if (!isBlocked) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            onBlockedInteract?.();
        },
        [isBlocked, onBlockedInteract]
    );

    return (
        <div className="relative flex flex-col gap-6 overflow-hidden inset-0 h-[200px] rounded-xl border-small  border-default-200 hover:border-default-400 px-5 text-center transition bg-gradient-to-br from-default-400/30 to-default-400 dark:from-default-100/50 dark:to-default-50/50">
            <Dropzone
                accept={accept}
                maxSize={maxSize}
                maxFiles={maxFileCount}
                multiple={maxFileCount > 1 || multiple}
                disabled={isDisabled}
                noClick={isBlocked}
                noDrag={isBlocked}
                noKeyboard={isBlocked}
                onDrop={onDrop}
            >
                {({ getRootProps, getInputProps, isDragActive }) => (
                    <div
                        {...getRootProps()}
                        onClickCapture={handleBlockedInteract}
                        onDragEnterCapture={handleBlockedInteract}
                        onDragOverCapture={handleBlockedInteract}
                        onDropCapture={handleBlockedInteract}
                        className={cn(
                            'group relative grid h-[200px] w-full cursor-pointer place-items-center py-2.5',
                            'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                            isDragActive && 'border-muted-foreground/50',
                            isDisabled && 'pointer-events-none opacity-60',
                            isBlocked && 'cursor-not-allowed',
                            className
                        )}
                        {...dropzoneProps}
                    >
                        <input {...getInputProps()} />
                        {isDragActive ? (
                            <div className="flex flex-col items-center justify-center gap-4 sm:px-5">
                                <div className="rounded-full border border-dashed p-3 border-primary">
                                    <Icon icon="line-md:uploading-loop" className="size-7 text-primary" aria-hidden="true" />
                                </div>
                                <p className="font-medium text-primary">{t('DropHere')}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center gap-4 sm:px-5">
                                <div className="rounded-full p-2">
                                    <Icon icon="mdi:file-document-outline" className="size-8 text-muted-foreground" aria-hidden="true" />
                                </div>
                                <div className="flex flex-col gap-2 items-center">
                                    {acceptLabels.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 justify-center">
                                            {acceptLabels.map(label => (
                                                <Chip key={label} size="sm" radius="sm" variant="flat" className="text-xs">
                                                    {label}
                                                </Chip>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-xs text-muted-foreground/70">
                                        {t('MemoryUploadLimit', { times: maxFileCount })}
                                        {' · '}
                                        {t('MemoryUploadSize', { size: formatBytes(maxSize) })}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Dropzone>
            {/* {files?.length ? (
                <ScrollShadow className="h-fit w-full px-3">
                    <div className="flex max-h-48 flex-col gap-4">
                        {files?.map((file, index) => <FileCard key={index} file={file} onRemove={() => onRemove(index)} progress={progresses?.[file.name]} />)}
                    </div>
                </ScrollShadow>
            ) : null} */}
        </div>
    );
}

interface FileCardProps {
    file: File;
    onRemove: () => void;
    progress?: number;
}

function FileCard({ file, progress, onRemove }: FileCardProps) {
    return (
        <div className="relative flex items-center gap-2.5">
            <div className="flex flex-1 gap-2.5">
                {isFileWithPreview(file) ? <FilePreview file={file} /> : null}
                <div className="flex w-full flex-col gap-2">
                    <div className="flex flex-col gap-px">
                        <p className="line-clamp-1 text-sm font-medium text-foreground/80">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                    </div>
                    {progress ? <Progress value={progress} /> : null}
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button isIconOnly type="button" variant="faded" className="size-7" onPress={onRemove}>
                    <Icon icon="mingcute:close-fill" className="size-7" aria-hidden="true" />
                </Button>
            </div>
        </div>
    );
}

function isFileWithPreview(file: File): file is File & { preview: string } {
    return 'preview' in file && typeof file.preview === 'string';
}

export interface FilePreviewProps {
    file: File & { preview: string };
    onRemove?: (file: File) => void;
}

export function FilePreview({ file, onRemove }: FilePreviewProps) {
    if (file.type.startsWith('image/')) {
        return <Image src={file.preview} alt={file.name} width={48} height={48} loading="lazy" className="aspect-square shrink-0 rounded-md object-cover" />;
    }

    return (
        <div className="w-full">
            <Chip variant="light" radius="sm" color="warning" className="w-full overflow-hidden" onClose={() => onRemove && onRemove(file)}>
                {file.name}
            </Chip>
        </div>
    );
}
