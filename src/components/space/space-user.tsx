import {
    Button,
    Chip,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Select,
    SelectItem,
    SelectSection,
    Spinner,
    Table,
    TableBody,
    TableCell,
    TableColumn,
    TableHeader,
    TableRow,
    Textarea,
    useDisclosure,
    User
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useImmer } from 'use-immer';
import { useSnapshot } from 'valtio';

import { CreateKnowledge } from '@/apis/knowledge';
import { ListSpaceUsers, SpaceUser } from '@/apis/space';
import { FilePreview, FileUploader } from '@/components/file-uploader';
import { useMedia } from '@/hooks/use-media';
import { usePlan } from '@/hooks/use-plan';
import { useGroupedResources } from '@/hooks/use-resource';
import { useUploader } from '@/hooks/use-uploader';
import resourceStore from '@/stores/resource';
import spaceStore from '@/stores/space';
import { Role } from '@/types';

interface SpaceUserProps {
    spaceID: string;
}

export function SpaceUserList({ spaceID }: SpaceUserProps) {
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const { t } = useTranslation();

    const { isOpen, onOpen, onOpenChange } = useDisclosure();
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
            const resp = await ListSpaceUsers(spaceID, page, pageSize);
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

    const removeUser = useCallback(async (userID: string) => {}, [spaceID]);

    useEffect(() => {
        if (!spaceID) {
            setSpaceUsers([]);
            return;
        }
        loadSpaceUsers(1);
    }, [spaceID, isOpen]);

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
                            case Role.ADMIN:
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
                            <Popover showArrow offset={10}>
                                <PopoverTrigger>
                                    <Button size="sm" variant="ghost">
                                        {t('Remove')}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent>
                                    <Button
                                        onPress={async () => {
                                            toast.promise(removeUser(item.user_id), {
                                                loading: t(`Doing`)
                                            });
                                        }}
                                        color="warning"
                                        size="sm"
                                    >
                                        {t('Confirm')}
                                    </Button>
                                </PopoverContent>
                            </Popover>
                        </div>
                    );
                case 'created_at':
                    return new Date(cellValue * 1000).toLocaleString();
                default:
                    return cellValue;
            }
        },
        [spaceID]
    );

    return (
        <>
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
                <TableBody isLoading={isLoading} loadingContent={<Spinner />} onLoadMore={loadSpaceUsers} emptyContent={t('Empty')} items={spaceUsers}>
                    {item => <TableRow key={item.user_id}>{columnKey => <TableCell>{renderCell(item, columnKey)}</TableCell>}</TableRow>}
                </TableBody>
            </Table>
            <Modal isOpen={isOpen} backdrop="blur" size="5xl" onOpenChange={onOpenChange}>
                <ModalContent>
                    {onClose => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">{t('TaskList')}</ModalHeader>
                            <ModalBody></ModalBody>
                            <ModalFooter></ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </>
    );
}
