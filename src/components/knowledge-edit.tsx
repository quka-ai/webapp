import { OutputData } from '@editorjs/editorjs';
import { Button, Input, ScrollShadow, Select, SelectItem, SelectSection, Skeleton, Spacer } from '@heroui/react';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnapshot } from 'valtio';

import { CreateKnowledge, type Knowledge, UpdateKnowledge } from '@/apis/knowledge';
import { ListResources, Resource } from '@/apis/resource';
import KnowledgeAITaskList from '@/components/ai-tasks-list';
import { Editor } from '@/components/editor/index';
import { useGroupedResources } from '@/hooks/use-resource';
import { useToast } from '@/hooks/use-toast';
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
    base: string;
    editor: string;
}

export default memo(
    forwardRef(function KnowledgeEdit({ knowledge, onChange, onCancel, hideSubmit, classNames, enableScrollShadow = true, temporaryStorage }: KnowledgeEditProps, ref: any) {
        const { t } = useTranslation();
        const [title, setTitle] = useState(knowledge ? knowledge.title : '');
        const [content, setContent] = useState<string | OutputData>(knowledge ? (knowledge.blocks ? knowledge.blocks : knowledge.content) : '');
        const [tags, setTags] = useState(knowledge ? knowledge.tags : []);
        const [isInvalid, setInvalid] = useState(false);
        const [errorMessage, setErrorMessage] = useState('');
        const [isLoading, setLoading] = useState(false);
        const [resource, setResource] = useState(knowledge ? knowledge.resource : '');
        const { currentSpaceResources, currentSelectedResource } = useSnapshot(resourceStore);
        const { currentSelectedSpace } = useSnapshot(spaceStore);

        if (!knowledge?.blocks && !knowledge?.content && temporaryStorage) {
            const cached = JSON.parse(sessionStorage.getItem(temporaryStorage) || '{}');
            if (cached.blocks) {
                knowledge.blocks = cached;
                knowledge.content_type = 'blocks';
            }
        }

        const reloadSpaceResource = useCallback(async (spaceID: string) => {
            try {
                await loadSpaceResource(spaceID);
            } catch (e: any) {
                console.error(e);
            }
        }, []);

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

        const onKnowledgeContentChanged = useCallback((value: string | OutputData) => {
            if (isInvalid) {
                setErrorMessage('');
                setInvalid(false);
            }
            setContent(value);
            temporaryStorage && sessionStorage.setItem(temporaryStorage, JSON.stringify(value));
        }, []);

        const setStringTags = useCallback((strTags: string) => {
            setTags(strTags.split('|'));
        }, []);

        const { toast } = useToast();

        async function submit() {
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
                        content_type: 'blocks',
                        tags: tags
                    });
                    toast({
                        title: t('Success'),
                        description: 'Updated knowledge ' + knowledge.id
                    });
                } else {
                    await CreateKnowledge(knowledge.space_id, resource || defaultResource, content, 'blocks');
                    toast({
                        title: t('Success'),
                        description: 'Create new knowledge'
                    });
                }

                if (onChange) {
                    onChange();
                }
            } catch (e: any) {
                console.error(e);
            }
            setLoading(false);
        }

        const editor = useRef<any>();

        function reset() {
            if (editor.current) {
                editor.current.reRender({ blocks: [] });
            }
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
                        <div className="w-full h-full md:max-w-[650px]">
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
                                <Skeleton isLoaded={defaultResource} className="min-h-10">
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
                                                    <SelectSection showDivider key={item.title} title={t(item.title)}>
                                                        {item.items.map(v => {
                                                            return <SelectItem key={v.id}>{v.title}</SelectItem>;
                                                        })}
                                                    </SelectSection>
                                                );
                                            })}
                                        </Select>
                                    )}
                                </Skeleton>

                                <div className="w-full relative mt-2">
                                    <Spacer y={2} />
                                    <div className="text-small font-bold">{t('knowledgeCreateContentLabel')}</div>
                                    <Spacer y={2} />
                                    <Editor
                                        ref={editor}
                                        autofocus
                                        className={classNames?.editor ? classNames.editor : ''}
                                        data={(() => {
                                            return knowledge.blocks || knowledge.content;
                                        })()}
                                        dataType={knowledge.content_type}
                                        placeholder={t('knowledgeCreateContentLabelPlaceholder')}
                                        onValueChange={onKnowledgeContentChanged}
                                    />
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
                                        className="mt-6 float-right w-32 text-white bg-gradient-to-br from-pink-400 to-indigo-400 dark:from-indigo-500 dark:to-pink-500"
                                        isLoading={isLoading}
                                        onPress={submit}
                                    >
                                        {t('Submit')}
                                    </Button>
                                </div>
                            )}

                            <div className="pb-20" />
                        </div>
                        {/* </ScrollShadow> */}
                    </>
                )}
            </>
        );
    })
);
