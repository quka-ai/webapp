import { Button, Form, Input, Textarea } from '@heroui/react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApplySpace } from '@/apis/space';

export interface SpaceApplicationFormProps {
    spaceToken: string;
    onSubmit: () => void;
}

export default function SpaceApplicationForm({ spaceToken, onSubmit }: SpaceApplicationFormProps) {
    const { t } = useTranslation();

    const [isLoading, setIsLoading] = useState(false);
    const submit = useCallback(
        async (data: string) => {
            setIsLoading(true);
            try {
                await ApplySpace(spaceToken, data);
                onSubmit && onSubmit();
            } catch (e: any) {
                console.error(e);
            }
            setIsLoading(false);
        },
        [spaceToken, onSubmit]
    );

    return (
        <Form
            className="w-full max-w-xs flex flex-col gap-4"
            onSubmit={e => {
                e.preventDefault();
                let data = Object.fromEntries(new FormData(e.currentTarget));
                submit(data.applicationInfo);
            }}
        >
            <Textarea isRequired variant='bordered' label={t('space.ApplicationInfo')} labelPlacement="outside" name="applicationInfo" type="text" />

            <div className="flex gap-2">
                <Button color="primary" type="submit" isLoading={isLoading}>
                    {t('Submit')}
                </Button>
                <Button type="reset" variant="flat" isDisabled={isLoading}>
                    {t('Reset')}
                </Button>
            </div>
        </Form>
    );
}
