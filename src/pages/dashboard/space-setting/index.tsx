import { Button, Drawer, DrawerBody, DrawerContent, useDisclosure } from '@heroui/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Setting from './setting';

import { useMedia } from '@/hooks/use-media';

export interface SpaceSettingProps {
    space: UserSpace;
}

export function SpaceSetting({ space }: SpaceSettingProps) {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const { t } = useTranslation();
    const [size, setSize] = useState('3xl');
    const { isMobile } = useMedia();

    useEffect(() => {
        if (isMobile) {
            setSize('full');
        } else {
            setSize('3xl');
        }
    }, [isMobile]);

    const handleOpen = size => {
        setSize(size);
        onOpen();
    };

    return (
        <>
            <div className="flex flex-wrap gap-3">
                <Button key={size} variant="ghost" onPress={() => handleOpen(size)}>
                    {t('Space Setting')}
                </Button>
            </div>
            <Drawer isOpen={isOpen} size={size} onClose={onClose}>
                <DrawerContent>
                    {onClose => (
                        <>
                            <DrawerBody>{space && <Setting space={space} onClose={onClose} />}</DrawerBody>
                        </>
                    )}
                </DrawerContent>
            </Drawer>
        </>
    );
}
