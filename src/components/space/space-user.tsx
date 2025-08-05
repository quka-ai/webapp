import { Button, Chip, Input, Popover, PopoverContent, PopoverTrigger, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, User } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useImmer } from 'use-immer';
import { useSnapshot } from 'valtio';

import { ListSpaceUsers, RemoveUser, SpaceUser } from '@/apis/space';
import userStore from '@/stores/user';
import { Role } from '@/types';

interface SpaceUserProps {
    spaceID: string;
}

export function SpaceUserList({ spaceID }: SpaceUserProps) {
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const { t } = useTranslation();
    const { t: tSpaceSetting } = useTranslation('space-setting');

    const [spaceUsers, setSpaceUsers] = useImmer<SpaceUser[]>([]);
    const [page, setPage] = useImmer(1);
    const [total, setTotal] = useState(0);
    const pageSize = 20;
    async function loadSpaceUsers(page: number) {
        if (page !== 1 && !hasMore) {
            return;
        }
        setIsLoading(true);
        try {
            const resp = await ListSpaceUsers(spaceID, keywords, page, pageSize);
            setTotal(resp.total);
            if (page == 1) {
                setSpaceUsers(resp.list);
            } else {
                setSpaceUsers((prev: SpaceUser[]) => {
                    prev = prev.concat(resp.list);
                });
            }
            if (page * pageSize >= resp.total) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }
            setPage(page);
        } catch (e: any) {
            console.error(e);
        }
        setIsLoading(false);
    }

    const [keywords, setKeywords] = useState('');
    const handleKeyDown = async (event: KeyboardEvent) => {
        // 阻止默认的提交行为
        if (event.key === 'Enter') {
            event.preventDefault();
            const keyCode = event.which || event.keyCode;

            if (keyCode === 229) {
                // 触发中文输入法确认中文等回车行为
                return;
            }
            loadSpaceUsers(1);
        }
    };

    const removeUser = useCallback(
        async (userID: string) => {
            try {
                await RemoveUser(spaceID, userID);
                await loadSpaceUsers(1);
            } catch (e: any) {
                console.error(e);
            }
        },
        [spaceID]
    );

    useEffect(() => {
        if (!spaceID) {
            setSpaceUsers([]);
            return;
        }
        loadSpaceUsers(1);
    }, [spaceID]);

    const columns = [
        { name: t('User'), uid: 'user' },
        { name: t('Role'), uid: 'role' },
        { name: t('JoinTime'), uid: 'created_at' },
        { name: t('Operate'), uid: 'actions' }
    ];

    const classNames = useMemo(
        () => ({
            wrapper: ['max-h-[382px]', 'max-w-3xl'],
            th: ['bg-transparent', 'text-default-500', 'border-b', 'border-divider'],
            td: [
                // changing the rows border radius
                // first
                'group-data-[first=true]/tr:first:before:rounded-lg',
                'group-data-[first=true]/tr:last:before:rounded-lg',
                // middle
                'group-data-[middle=true]/tr:before:rounded-none',
                // last
                'group-data-[last=true]/tr:first:before:rounded-lg',
                'group-data-[last=true]/tr:last:before:rounded-lg'
            ]
        }),
        []
    );

    const [isRemoveLoading, setIsRemoveLoading] = useState(false);
    const { userInfo } = useSnapshot(userStore);

    const renderCell = useCallback(
        (item: SpaceUser, columnKey: string) => {
            const cellValue = item[columnKey];

            switch (columnKey) {
                case 'user':
                    return (
                        <User
                            avatarProps={{ radius: 'full', size: 'sm', src: item.avatar }}
                            classNames={{
                                description: 'text-default-500'
                            }}
                            description={item.email}
                            name={item.name}
                        >
                            {item.name}
                        </User>
                    );
                case 'role':
                    const color = (cellValue => {
                        switch (cellValue) {
                            case Role.ADMIN || Role.CHIEF:
                                return 'danger';
                            case Role.EDITOR:
                                return 'warning';
                            case Role.VIEWER:
                                return 'primary';
                            case Role.MEMBER:
                                return 'secondary';
                            default:
                                return 'secondary';
                        }
                    })(cellValue);

                    return (
                        <Chip className="capitalize border-none gap-1 text-default-600" color={color} size="sm">
                            {t(cellValue)}
                        </Chip>
                    );
                case 'actions':
                    return (
                        <div className="relative flex justify-end items-center gap-2">
                            {item.user_id !== userInfo.userID && (
                                <Popover showArrow offset={10}>
                                    <PopoverTrigger>
                                        <Button size="sm" variant="ghost">
                                            {t('Remove')}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent>
                                        <Button
                                            color="warning"
                                            size="sm"
                                            onPress={async () => {
                                                toast.promise(removeUser(item.user_id), {
                                                    loading: t(`Doing`),
                                                    success: t(`Success`),
                                                    error: t(`Failed`)
                                                });
                                            }}
                                        >
                                            {t('Confirm')}
                                        </Button>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>
                    );
                case 'created_at':
                    return new Date(cellValue * 1000).toLocaleString();
                default:
                    return cellValue;
            }
        },
        [spaceID, userInfo]
    );

    return (
        <div className="w-full overflow-hidden">
            <Table
                removeWrapper
                aria-label="Example table with custom cells, pagination and sorting"
                bottomContent={
                    hasMore && !isLoading ? (
                        <div className="flex w-full justify-center">
                            <Button
                                isDisabled={isLoading}
                                variant="flat"
                                onPress={async () => {
                                    const nextPage = page + 1;
                                    try {
                                        await loadSpaceUsers(nextPage);
                                        setPage(nextPage);
                                    } catch (e: any) {
                                        console.error(e);
                                    }
                                }}
                            >
                                {isLoading && <Spinner color="white" size="sm" />}
                                {t('LoadMore')}
                            </Button>
                        </div>
                    ) : null
                }
                topContent={
                    <div className="flex justify-end">
                        <Input
                            isClearable
                            variant="bordered"
                            classNames={{
                                base: 'max-w-full sm:max-w-[20rem] h-10',
                                mainWrapper: 'h-full',
                                input: 'text-small',
                                inputWrapper: 'h-full rounded-xl font-normal text-default-500'
                            }}
                            placeholder={tSpaceSetting('ApplicationSearchPlaceholder')}
                            size="sm"
                            startContent={<Icon className="text-default-500" icon="solar:magnifer-linear" width={18} />}
                            type="search"
                            onValueChange={setKeywords}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                }
                bottomContentPlacement="outside"
                checkboxesProps={{
                    classNames: {
                        wrapper: 'after:bg-foreground after:text-background text-background'
                    }
                }}
                classNames={classNames}
            >
                <TableHeader columns={columns}>
                    {column => (
                        <TableColumn key={column.uid} align={column.uid === 'actions' ? 'center' : 'start'}>
                            {column.name}
                        </TableColumn>
                    )}
                </TableHeader>
                <TableBody isLoading={isLoading} loadingContent={<Spinner />} emptyContent={t('Empty')} items={spaceUsers || []}>
                    {item => <TableRow key={item.user_id}>{columnKey => <TableCell>{renderCell(item, columnKey)}</TableCell>}</TableRow>}
                </TableBody>
            </Table>
        </div>
    );
}
