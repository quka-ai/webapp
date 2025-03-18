import { Icon } from '@iconify/react';
import { Button, Select, SelectItem, SelectSection, Skeleton } from "@heroui/react";
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useSnapshot } from 'valtio';
import { subscribeKey } from 'valtio/utils';

import { UserSpace } from '@/apis/space';
import CreateSpace from '@/components/space/create-space';
import { useChatPageCondition } from '@/hooks/use-chat-page';
import spaceStore, { latestPickedSpace, loadUserSpaces, setCurrentSelectedSpace } from '@/stores/space';

interface WorkSpace {
    value: string;
    label: string;
    items: WorkSpaceItem[];
}

interface WorkSpaceItem {
    value: string;
    label: string;
}
export default function Component() {
    const { t } = useTranslation();
    const { spaceID } = useParams();

    const [workspaces, setWorkspaces] = useState<WorkSpace[]>([
        {
            value: '0',
            label: t('Workspace'),
            items: []
        }
    ]);
    const { isChat } = useChatPageCondition();

    const { spaces } = useSnapshot(spaceStore);

    const [isLoaded, setLoaded] = useState(false);
    const [selected, setSelected] = useState('');
    const navigate = useNavigate();

    function onSelected(key: string, redirect: boolean = false) {
        if (redirect) {
            if (isChat) {
                navigate(`/dashboard/${key}/chat`);
            } else {
                navigate(`/dashboard/${key}/knowledge`);
            }
        }

        setSelected(key); // 设置selection
        setCurrentSelectedSpace(key); // 设置valtio，通知上层组件开始加载spaceid下的resource
    }

    function spacesToSelector(datas: UserSpace[]) {
        let selected = '';

        const spacesSelector = [
            {
                value: '0',
                label: t('Workspace'),
                items: datas.map((val: UserSpace, _: number) => {
                    if (val.space_id === spaceID) {
                        // default
                        onSelected(val.space_id);
                        selected = val.space_id;
                    }

                    return {
                        value: val.space_id,
                        label: val.title
                    };
                })
            }
        ];

        setWorkspaces(spacesSelector);

        if (!selected && spacesSelector[0].items) {
            const latestPicked = latestPickedSpace();

            if (spacesSelector[0].items.find(v => v.value === latestPicked)) {
                onSelected(latestPicked, true);
            } else {
                onSelected(spacesSelector[0].items[0].value, true);
            }
        }
    }

    useEffect(() => {
        const unSubscribe = subscribeKey(spaceStore, 'spaces', datas => {
            spacesToSelector(datas);
        });

        return unSubscribe;
    }, [workspaces, spaceID]);

    async function loadData() {
        try {
            setLoaded(false);

            await loadUserSpaces();

            setLoaded(true);
        } catch (e: any) {
            console.error(e);
        }
    }

    useEffect(() => {
        if (spaces && spaces.length > 0) {
            spacesToSelector(spaces);
            setLoaded(true);

            return;
        }

        loadData();
    }, [spaces]);

    // @ts-ignore
    function handleSelectionChange(e) {
        if (e.currentKey) {
            onSelected(e.currentKey, true);
        }
    }

    // @ts-ignore
    const createSpaceBox = useRef();

    function openCreateWorkSpaceBox() {
        if (createSpaceBox && createSpaceBox.current) {
            // @ts-ignore
            createSpaceBox.current.trigger();
            setIsOpen(false);
        }
    }

    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <CreateSpace ref={createSpaceBox} />
            <Skeleton isLoaded={isLoaded} className="rounded-lg">
                <Select
                    disableSelectorIconRotation
                    aria-label="Select workspace"
                    selectionMode="single"
                    isOpen={isOpen}
                    isRequired={true}
                    selectedKeys={[selected]}
                    className="px-1"
                    classNames={{
                        trigger:
                            'min-h-14 bg-transparent border-small border-default-200 dark:border-default-200 data-[hover=true]:border-default-500 dark:data-[hover=true]:border-default-300 data-[hover=true]:bg-transparent',
                        listbox: 'z-0'
                    }}
                    items={workspaces}
                    listboxProps={{
                        className: 'z-0',
                        bottomContent: (
                            <Button className="bg-default-100 text-center text-foreground" size="sm" onPress={openCreateWorkSpaceBox}>
                                {t('New Workspace')}
                            </Button>
                        )
                    }}
                    showScrollIndicators={false}
                    placeholder="Select workspace"
                    selectorIcon={<Icon color="hsl(var(--heroui-default-500))" icon="lucide:chevrons-up-down" />}
                    startContent={
                        <div className="relative h-10 w-10 flex-none rounded-full border-small border-default-300">
                            <Icon className="ml-2 mt-2 text-default-500" icon="solar:users-group-rounded-linear" width={24} />
                        </div>
                    }
                    renderValue={items => {
                        return items.map(item => (
                            <div key={item.key} className="ml-1 flex flex-col gap-y-0.5">
                                <span className="text-tiny leading-4">{t('Workspace')}</span>
                                <span className="text-tiny text-default-400">{item.data?.label}</span>
                            </div>
                        ));
                    }}
                    onSelectionChange={handleSelectionChange}
                    onOpenChange={open => open !== isOpen && setIsOpen(open)}
                >
                    {section => (
                        <SelectSection key={section.value} hideSelectedIcon aria-label={section.label} items={section.items} title={section.label}>
                            {/* @ts-ignore */}
                            {item => (
                                <SelectItem key={item.value} aria-label={item.label} textValue={item.value}>
                                    <div className="flex flex-row items-center justify-between gap-1">
                                        <span>{item.label}</span>
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full border-small border-default-300">
                                            <Icon className="text-default-500" icon="solar:users-group-rounded-linear" width={16} />
                                        </div>
                                    </div>
                                </SelectItem>
                            )}
                        </SelectSection>
                    )}
                </Select>
            </Skeleton>
        </>
    );
}
