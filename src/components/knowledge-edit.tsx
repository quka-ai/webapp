import { Button, Input, Select, SelectItem, SelectSection, Skeleton, Spacer } from '@heroui/react';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSnapshot } from 'valtio';

import { CreateKnowledge, type Knowledge, type KnowledgeContent, UpdateKnowledge } from '@/apis/knowledge';
import KnowledgeAITaskList from '@/components/ai-tasks-list';
import { BlockNoteEditor, BlockNoteEditorRefObject, type BlockNoteEditorValue } from '@/components/blocknote-editor';
import { useGroupedResources } from '@/hooks/use-resource';
import { cn } from '@/lib/utils';
import resourceStore, { loadSpaceResource } from '@/stores/resource';
import spaceStore from '@/stores/space';

export interface KnowledgeEditProps {
    knowledge?: Knowledge;
    onChange?: () => void;
    onCancel?: () => void;
    hideSubmit?: boolean;
    classNames?: ClassNames;
    enableScrollShadow?: boolean;
    temporaryStorage?: string; // temporary storage id
}

export interface ClassNames {
    base?: string;
    editor?: string;
    editorWrapper?: string;
}

export interface KnwoledgeEditorRefObject {
    submit: () => void;
    reset: () => void;
}

function getKnowledgeContent(knowledge?: Knowledge): KnowledgeContent {
    if (!knowledge) {
        return '';
    }

    return knowledge.blocks ? knowledge.blocks : knowledge.content;
}

function getKnowledgeEditorState(knowledge?: Knowledge, temporaryStorage?: string) {
    const state = {
        content: getKnowledgeContent(knowledge),
        contentType: knowledge ? knowledge.content_type : 'markdown'
    };

    if (!knowledge?.blocks && !knowledge?.content && temporaryStorage) {
        const cached = JSON.parse(sessionStorage.getItem(temporaryStorage) || 'null');

        if (Array.isArray(cached)) {
            return {
                content: cached,
                contentType: 'blocks_v2'
            };
        }

        if (cached?.blocks) {
            return {
                content: cached,
                contentType: 'blocks'
            };
        }
    }

    return state;
}

export default memo(
    forwardRef(function KnowledgeEdit({ knowledge, onChange, onCancel, hideSubmit, classNames, temporaryStorage }: KnowledgeEditProps, ref: any) {
        const { t } = useTranslation();
        const initialEditorState = useMemo(() => getKnowledgeEditorState(knowledge, temporaryStorage), [knowledge?.id, temporaryStorage]);
        const [title, setTitle] = useState(knowledge ? knowledge.title : '');
        const [tags, setTags] = useState(knowledge ? knowledge.tags : []);
        const [isInvalid, setInvalid] = useState(false);
        const [, setErrorMessage] = useState('');
        const [isLoading, setLoading] = useState(false);
        const [isEditorLoading, setEditorLoading] = useState(true);
        const [resource, setResource] = useState(knowledge ? knowledge.resource : '');
        const [blocks, setBlocks] = useState<KnowledgeContent>(initialEditorState.content);
        const [blocksType, setBlocksType] = useState(initialEditorState.contentType);
        const blocksRef = useRef<KnowledgeContent>(initialEditorState.content);
        const blocksTypeRef = useRef(initialEditorState.contentType); // text | blocks | json
        const { currentSelectedResource } = useSnapshot(resourceStore);
        const { currentSelectedSpace } = useSnapshot(spaceStore);

        // const reloadSpaceResource = useCallback(async (spaceID: string) => {
        //     try {
        //         await loadSpaceResource(spaceID);
        //     } catch (e: any) {
        //         console.error(e);
        //     }
        // }, []);

        useEffect(() => {
            if (!currentSelectedSpace || (currentSelectedResource && currentSelectedResource.id)) {
                return;
            }
            loadSpaceResource(currentSelectedSpace);
        }, [currentSelectedResource, currentSelectedSpace]);

        const { groupedResources } = useGroupedResources();
        const defaultResource = useMemo(() => {
            if (knowledge && knowledge.resource) {
                return knowledge.resource;
            }
            if (currentSelectedResource && currentSelectedResource.id) {
                return currentSelectedResource.id;
            }

            // if (groupedResources.length > 0 && groupedResources[0].items.length > 0) {
            //     return groupedResources[0].items[0].id;
            // }

            return 'knowledge';
        }, [currentSelectedResource, groupedResources, knowledge]);

        const editor = useRef<BlockNoteEditorRefObject>(null);

        useEffect(() => {
            const nextEditorState = getKnowledgeEditorState(knowledge, temporaryStorage);

            setEditorLoading(true);
            blocksRef.current = nextEditorState.content;
            blocksTypeRef.current = nextEditorState.contentType;
            setBlocks(nextEditorState.content);
            setBlocksType(nextEditorState.contentType);

            if (editor.current) {
                editor.current.reRender(nextEditorState.content, nextEditorState.contentType);
            }

            setEditorLoading(false);
        }, [knowledge?.id, temporaryStorage]);

        const onBlocksChanged = useCallback((value: BlockNoteEditorValue) => {
            if (isInvalid) {
                setErrorMessage('');
                setInvalid(false);
            }

            blocksRef.current = value;
            blocksTypeRef.current = 'blocks_v2';
            setBlocks(value);
            setBlocksType('blocks_v2');
            temporaryStorage && sessionStorage.setItem(temporaryStorage, JSON.stringify(value));
        }, []);

        const editorRender = useMemo(() => {
            return (
                <>
                    {isEditorLoading || (
                        <BlockNoteEditor
                            ref={editor}
                            autofocus
                            readOnly={false}
                            data={blocks ?? undefined}
                            dataType={Array.isArray(blocks) ? 'blocks_v2' : blocksType}
                            outputFormat="blocks"
                            placeholder={t('knowledgeCreateContentLabelPlaceholder')}
                            className={classNames?.editor}
                            onValueChange={value => onBlocksChanged(value)}
                        />
                    )}
                </>
            );
        }, [classNames?.editor, isEditorLoading]);

        const setStringTags = useCallback((strTags: string) => {
            setTags(strTags.split('|'));
        }, []);

        async function submit() {
            const content = blocksRef.current;

            if (content === '') {
                setErrorMessage('knowledge content is empty');
                setInvalid(true);

                return;
            }

            if (!knowledge) {
                return;
            }

            setLoading(true);
            try {
                if (knowledge.id) {
                    await UpdateKnowledge(knowledge.space_id, knowledge.id, {
                        resource: resource || defaultResource,
                        title: title,
                        content: content,
                        content_type: blocksTypeRef.current,
                        tags: tags
                    });
                } else {
                    await CreateKnowledge(knowledge.space_id, resource || defaultResource, content, blocksTypeRef.current);
                }

                toast.success(t('Success'));

                if (onChange) {
                    onChange();
                }
            } catch (e: any) {
                console.error(e);
            }
            setLoading(false);
        }

        function reset() {
            if (editor.current) {
                editor.current.reRender('');
            }
            blocksRef.current = '';
            blocksTypeRef.current = 'markdown';
            setBlocks('');
            setBlocksType('markdown');
        }

        useImperativeHandle(ref, () => {
            return {
                submit,
                reset
            };
        });

        return (
            <>
                {knowledge && (
                    <>
                        {/* <ScrollShadow hideScrollBar isEnabled={enableScrollShadow} className="w-full flex-grow box-border  flex justify-center"> */}
                        <KnowledgeAITaskList />
                        <div className={cn('w-full h-full md:max-w-[650px]', classNames?.base)}>
                            {knowledge.id && (
                                <>
                                    <div className="w-full mt-10 mb-5 dark:text-gray-100 text-gray-800 text-lg overflow-hidden">
                                        <Input
                                            label={t('Title')}
                                            placeholder="Your knowledge title, empty to use ai genenrate"
                                            className="text-xl text-gray-800 dark:text-gray-100"
                                            labelPlacement="outside"
                                            defaultValue={knowledge.title}
                                            classNames={{ label: 'text-white font-bold' }}
                                            variant="faded"
                                            onValueChange={setTitle}
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-1 mb-5">
                                        <Input
                                            label={t('Tags') + "(each tag splited with '|')"}
                                            placeholder="Your knowledge title, empty to use ai genenrate"
                                            className="text-xl text-gray-800 dark:text-gray-100"
                                            labelPlacement="outside"
                                            defaultValue={knowledge.tags ? knowledge.tags.join('|') : ''}
                                            classNames={{ label: 'text-white font-bold' }}
                                            variant="faded"
                                            onValueChange={setStringTags}
                                        />
                                    </div>
                                </>
                            )}

                            <div className="w-full flex-wrap flex flex-col gap-3">
                                <Skeleton isLoaded={defaultResource != ''} className="min-h-10">
                                    {defaultResource && (
                                        <Select
                                            isRequired
                                            label={t('knowledgeCreateResourceLable')}
                                            defaultSelectedKeys={[defaultResource]}
                                            labelPlacement="outside"
                                            placeholder="Select an resource"
                                            className="text-xl text-gray-800 dark:text-gray-100"
                                            classNames={{ label: 'text-white font-bold' }}
                                            variant="faded"
                                            onSelectionChange={item => {
                                                if (item) {
                                                    setResource(item.currentKey || '');
                                                }
                                            }}
                                        >
                                            {groupedResources.map(item => {
                                                return (
                                                    <SelectSection key={item.title} showDivider title={t(item.title)}>
                                                        {item.items.map(v => {
                                                            return <SelectItem key={v.id}>{v.title}</SelectItem>;
                                                        })}
                                                    </SelectSection>
                                                );
                                            })}
                                        </Select>
                                    )}
                                </Skeleton>

                                <div className={cn('w-full relative mt-2', classNames?.editorWrapper)}>
                                    <Spacer y={2} />
                                    <div className="text-small font-bold">{t('knowledgeCreateContentLabel')}</div>
                                    <Spacer y={2} />
                                    {editorRender}
                                    {/* <Textarea
                                    minRows={12}
                                    maxRows={100}
                                    name="knowledge"
                                    placeholder={t('knowledgeCreateContentLabelPlaceholder')}
                                    variant="bordered"
                                    labelPlacement="outside"
                                    label={t('knowledgeCreateContentLabel')}
                                    isInvalid={isInvalid}
                                    errorMessage={errorMessage}
                                    defaultValue={knowledge.content}
                                    autoFocus={!knowledge.id}
                                    onValueChange={onKnowledgeContentChanged}
                                />
                                <div className="mt-1 flex w-full items-center justify-end gap-2 px-1">
                                    <Icon className="text-default-400 dark:text-default-300" icon="la:markdown" width={20} />
                                    <p className="text-tiny text-default-400 dark:text-default-300">
                                        <Link className="text-tiny text-default-500" color="foreground" href="https://guides.github.com/features/mastering-markdown/" rel="noreferrer" target="_blank">
                                            Markdown
                                            <Icon className="[&>path]:stroke-[2px]" icon="solar:arrow-right-up-linear" />
                                        </Link>
                                        &nbsp;supported.
                                    </p>
                                </div> */}
                                </div>

                                {/* <Input
                                label={t('knowledgeCreateResourceLable')}
                                variant="bordered"
                                placeholder={t('knowledgeCreateResourceLablePlaceholder')}
                                className="text-xl text-gray-800 dark:text-gray-100 !mt-12"
                                labelPlacement="outside"
                                defaultValue={knowledge.resource || 'knowledge'}
                                onValueChange={setResource}
                            /> */}
                            </div>

                            {hideSubmit || (
                                <div className="flex gap-4 justify-end">
                                    {onCancel && (
                                        <Button className="mt-6 float-right w-32 text-white bg-zinc-400 dark:bg-zinc-500" onPress={onCancel}>
                                            {t('Cancel')}
                                        </Button>
                                    )}

                                    <Button
                                        className="mt-6 float-right w-32 text-white bg-linear-to-br from-pink-400 to-indigo-400 dark:from-indigo-500 dark:to-pink-500"
                                        isLoading={isLoading}
                                        onPress={submit}
                                    >
                                        {t('Submit')}
                                    </Button>
                                </div>
                            )}

                            <div className="pb-6" />
                        </div>
                        {/* </ScrollShadow> */}
                    </>
                )}
            </>
        );
    })
);
