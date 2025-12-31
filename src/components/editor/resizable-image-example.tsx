/**
 * ResizableImageTool 使用示例
 *
 * 这个文件展示了如何在项目中集成和使用 ResizableImageTool
 */
import EditorJS from '@editorjs/editorjs';

/**
 * 示例5：React 组件中使用
 */
import { useEffect, useRef } from 'react';

import ResizableImageTool from './resizable-image-tool';

/**
 * 示例1：基础使用
 */
export function basicExample() {
    const editor = new EditorJS({
        holder: 'editorjs',
        tools: {
            image: {
                class: ResizableImageTool,
                config: {
                    endpoints: {
                        byFile: '/api/upload-image',
                        byUrl: '/api/fetch-url'
                    },
                    field: 'image',
                    types: 'image/*',
                    captionPlaceholder: '输入图片描述...'
                }
            }
        }
    });

    return editor;
}

/**
 * 示例2：使用自定义上传器
 */
export function customUploaderExample() {
    const editor = new EditorJS({
        holder: 'editorjs',
        tools: {
            image: {
                class: ResizableImageTool,
                config: {
                    uploader: {
                        /**
                         * 通过文件上传
                         */
                        uploadByFile(file: File) {
                            const formData = new FormData();
                            formData.append('image', file);

                            return fetch('/your-upload-endpoint', {
                                method: 'POST',
                                body: formData
                            })
                                .then(res => res.json())
                                .then(data => ({
                                    success: 1,
                                    file: {
                                        url: data.url
                                    }
                                }));
                        },

                        /**
                         * 通过 URL 上传
                         */
                        uploadByUrl(url: string) {
                            return fetch('/your-fetch-url-endpoint', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ url })
                            })
                                .then(res => res.json())
                                .then(data => ({
                                    success: 1,
                                    file: {
                                        url: data.url
                                    }
                                }));
                        }
                    }
                }
            }
        }
    });

    return editor;
}

/**
 * 示例3：带所有功能的完整配置
 */
export function fullFeaturedExample() {
    const editor = new EditorJS({
        holder: 'editorjs',
        tools: {
            image: {
                class: ResizableImageTool,
                config: {
                    endpoints: {
                        byFile: '/api/upload-image',
                        byUrl: '/api/fetch-url'
                    },
                    field: 'image',
                    types: 'image/*',
                    captionPlaceholder: '添加图片描述（可选）',

                    // 启用所有功能
                    features: {
                        border: true,
                        caption: 'optional', // 可选的标题
                        stretch: true,
                        background: true
                    },

                    // 自定义按钮内容
                    buttonContent: '上传图片',

                    // 额外的请求数据
                    additionalRequestData: {
                        userId: 'user123',
                        folder: 'images'
                    },

                    // 额外的请求头
                    additionalRequestHeaders: {
                        'X-Custom-Header': 'value'
                    }
                }
            }
        },

        // 其他配置
        placeholder: '开始输入...',
        autofocus: true,

        // 初始数据示例
        data: {
            blocks: [
                {
                    type: 'image',
                    data: {
                        file: {
                            url: 'https://example.com/image.jpg'
                        },
                        caption: '示例图片',
                        withBorder: false,
                        withBackground: false,
                        stretched: false,
                        width: 75 // 初始宽度为 75%
                    }
                }
            ]
        },

        // 保存数据的回调
        onChange: async api => {
            const savedData = await api.saver.save();
            console.log('编辑器数据已更新：', savedData);
        }
    });

    return editor;
}

/**
 * 示例4：如何保存和恢复数据
 */
export async function saveAndRestoreExample() {
    const editor = new EditorJS({
        holder: 'editorjs',
        tools: {
            image: {
                class: ResizableImageTool,
                config: {
                    endpoints: {
                        byFile: '/api/upload-image'
                    }
                }
            }
        }
    });

    // 保存数据
    async function saveData() {
        try {
            const outputData = await editor.save();
            console.log('保存的数据：', outputData);

            // 保存到本地存储
            localStorage.setItem('editorData', JSON.stringify(outputData));

            // 或者发送到服务器
            await fetch('/api/save-article', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(outputData)
            });
        } catch (error) {
            console.error('保存失败：', error);
        }
    }

    // 恢复数据
    async function restoreData() {
        try {
            const savedData = localStorage.getItem('editorData');
            if (savedData) {
                const data = JSON.parse(savedData);
                await editor.render(data);
                console.log('数据已恢复');
            }
        } catch (error) {
            console.error('恢复失败：', error);
        }
    }

    return { editor, saveData, restoreData };
}

export function EditorComponent() {
    const editorRef = useRef<EditorJS | null>(null);
    const holderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!holderRef.current) return;

        const editor = new EditorJS({
            holder: holderRef.current,
            tools: {
                image: {
                    class: ResizableImageTool,
                    config: {
                        uploader: {
                            uploadByFile(file: File) {
                                // 你的上传逻辑
                                return Promise.resolve({
                                    success: 1,
                                    file: {
                                        url: URL.createObjectURL(file)
                                    }
                                });
                            }
                        }
                    }
                }
            }
        });

        editorRef.current = editor;

        // 清理
        return () => {
            if (editorRef.current) {
                editorRef.current.destroy();
                editorRef.current = null;
            }
        };
    }, []);

    const handleSave = async () => {
        if (editorRef.current) {
            const data = await editorRef.current.save();
            console.log('保存的数据：', data);
        }
    };

    return (
        <div>
            <div ref={holderRef} />
            <button onClick={handleSave}>保存</button>
        </div>
    );
}
