import { Button, Drawer, DrawerBody, DrawerContent, useDisclosure } from '@heroui/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import Setting from './setting';

import { useMedia } from '@/hooks/use-media';

export interface SpaceSettingProps {
    space: UserSpace;
}

export function SpaceSetting({ space }: SpaceSettingProps) {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const { t } = useTranslation();
    const navigate = useNavigate();
    // const [size, setSize] = useState('3xl');
    // const { isMobile } = useMedia();

    // useEffect(() => {
    //     if (isMobile) {
    //         setSize('full');
    //     } else {
    //         setSize('3xl');
    //     }
    // }, [isMobile]);

    const handleOpen = () => {
        // setSize(size);
        // onOpen();
        navigate(`/dashboard/space-setting/${space.space_id}`);
    };

    return (
        <>
            <div className="flex flex-wrap gap-3">
                <Button variant="ghost" onPress={handleOpen}>
                    {t('Space Setting')}
                </Button>
            </div>
            {/* <Drawer isOpen={isOpen} size={size} onClose={onClose}>
                <DrawerContent>
                    {onClose => (
                        <>
                            <DrawerBody>{space && <Setting space={space} onClose={onClose} />}</DrawerBody>
                        </>
                    )}
                </DrawerContent>
            </Drawer> */}
        </>
    );
}
