import { type PartialBlock } from '@blocknote/core';
import { Progress, Skeleton } from '@heroui/react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnapshot } from 'valtio';

import { type FixedPinContent, GetFixedPin, UpsertFixedPin } from '@/apis/fixed-pin';
import { BlockNoteEditor, type BlockNoteEditorRefObject } from '@/components/blocknote-editor';
import { toast } from '@/hooks/use-toast';
import spaceStore from '@/stores/space';

const PIN_AUTO_SAVE_INTERVAL = 10000;

function createEmptyPinBlocks(): FixedPinContent {
    return [{ type: 'paragraph', content: '' }];
}

function isEmptyPinContent(content: FixedPinContent | undefined) {
    if (!content || content.length === 0) {
        return true;
    }

    return content.every(block => {
        if (!block.content) {
            return true;
        }

        if (typeof block.content === 'string') {
            return block.content.trim().length === 0;
        }

        if (!Array.isArray(block.content)) {
            return false;
        }

        return block.content.every(item => {
            if (typeof item === 'string') {
                return item.trim().length === 0;
            }

            const textItem = item as { text?: string };

            return !textItem || typeof textItem.text !== 'string' || textItem.text.trim().length === 0;
        });
    });
}

export default memo(function FixedPinHomePanel() {
    const { t } = useTranslation();
    const { currentSelectedSpace } = useSnapshot(spaceStore);
    const editor = useRef<BlockNoteEditorRefObject>(null);
    const updatePinDebounce = useRef<ReturnType<typeof setTimeout>>();
    const canAutoUpdate = useRef(true);
    const latestBlocks = useRef<FixedPinContent>(createEmptyPinBlocks());
    const [blocks, setBlocks] = useState<FixedPinContent>(() => createEmptyPinBlocks());
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    const clearPendingSave = useCallback(() => {
        if (updatePinDebounce.current) {
            clearTimeout(updatePinDebounce.current);
            updatePinDebounce.current = undefined;
        }
    }, []);

    const savePin = useCallback(
        async (nextBlocks: FixedPinContent = latestBlocks.current) => {
            if (!currentSelectedSpace || !nextBlocks) {
                return false;
            }

            clearPendingSave();
            setIsUpdating(true);
            try {
                await UpsertFixedPin(currentSelectedSpace, nextBlocks);

                return true;
            } catch (e: any) {
                console.error('upsert fixed pin error', e);
                toast({
                    title: t('Error'),
                    description: t('Please retry')
                });

                return false;
            } finally {
                setIsUpdating(false);
            }
        },
        [clearPendingSave, currentSelectedSpace, t]
    );

    const onBlocksChanged = useCallback(
        (value: PartialBlock[]) => {
            const nextBlocks = value && value.length > 0 ? value : createEmptyPinBlocks();

            latestBlocks.current = nextBlocks;
            setBlocks(nextBlocks);
            clearPendingSave();

            if (canAutoUpdate.current) {
                canAutoUpdate.current = false;
                setTimeout(() => {
                    canAutoUpdate.current = true;
                }, PIN_AUTO_SAVE_INTERVAL);
                savePin(nextBlocks);

                return;
            }

            updatePinDebounce.current = setTimeout(() => {
                savePin(latestBlocks.current);
            }, PIN_AUTO_SAVE_INTERVAL);
        },
        [clearPendingSave, savePin]
    );

    const loadPin = useCallback(async () => {
        if (!currentSelectedSpace) {
            setIsLoading(false);

            return;
        }

        setIsLoading(true);
        clearPendingSave();
        try {
            const pin = await GetFixedPin(currentSelectedSpace);
            const nextBlocks = pin?.content && pin.content.length > 0 ? pin.content : createEmptyPinBlocks();

            latestBlocks.current = nextBlocks;
            setBlocks(nextBlocks);
            editor.current?.reRender(nextBlocks, 'blocks_v2');
        } catch (e: any) {
            console.error('get fixed pin error', e);
            const emptyBlocks = createEmptyPinBlocks();

            latestBlocks.current = emptyBlocks;
            setBlocks(emptyBlocks);
            toast({
                title: t('Error'),
                description: t('Please retry')
            });
        } finally {
            setIsLoading(false);
        }
    }, [clearPendingSave, currentSelectedSpace, t]);

    useEffect(() => {
        loadPin();

        return clearPendingSave;
    }, [clearPendingSave, loadPin]);

    return (
        <section className="md:px-6 px-3 mb-4">
            <div className="mb-2 flex min-h-8 items-center justify-between gap-3 px-1">
                <div className="text-2xl font-semibold text-default-700">🤔 Pin</div>
                <div className="flex items-center gap-2">{(isUpdating || isLoading) && <Progress isIndeterminate size="sm" aria-label="Loading..." className="w-12" />}</div>
            </div>
            <div className="rounded-lg border border-default-200 bg-content1 px-4 py-3 shadow-sm dark:border-default-100">
                {isLoading ? (
                    <Skeleton className="rounded-lg">
                        <div className="h-14 rounded-lg bg-default-200 dark:bg-default-800" />
                    </Skeleton>
                ) : (
                    <div className="fixed-pin-home-panel__editor px-3 py-2">
                        <BlockNoteEditor
                            ref={editor}
                            readOnly={false}
                            autofocus={isEmptyPinContent(blocks)}
                            className="fixed-pin-home-panel__blocknote mx-0! sm:mx-0!"
                            data={blocks}
                            dataType="blocks_v2"
                            outputFormat="blocks"
                            placeholder={t('knowledgeCreateContentLabelPlaceholder')}
                            onValueChange={value => onBlocksChanged(value as PartialBlock[])}
                        />
                    </div>
                )}
            </div>
        </section>
    );
});
