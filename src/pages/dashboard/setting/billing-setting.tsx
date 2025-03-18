import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, RadioGroup, Select, SelectItem, Skeleton, Spacer, useDisclosure, user } from '@heroui/react';
import { cn } from '@heroui/react';
import { Icon } from '@iconify/react';
import { fromAbsolute, getLocalTimeZone } from '@internationalized/date';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useSnapshot } from 'valtio';

import { PlanCustomRadio } from './plan-custom-radio';

import { GetPlanList, type Plan, RedeemGiftCode, RedeemGiftCodeResponse } from '@/apis/plan';
import { GetUserPlanDescription } from '@/apis/user';
import { usePlan } from '@/hooks/use-plan';
import { toast } from '@/hooks/use-toast';
import userStore, { setUserInfo } from '@/stores/user';

interface BillingSettingCardProps {
    className?: string;
}

const BillingSetting = React.forwardRef<HTMLDivElement, BillingSettingCardProps>(({ className, ...props }, ref) => {
    const { t } = useTranslation();

    const [userPlan, setUserPlan] = React.useState<{ planID: string; startTime: string; endTime: string }>();
    const [giftCode, setGiftCode] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(true);
    async function loadUserPlan() {
        setIsLoading(true);
        try {
            const resp = await GetUserPlanDescription();
            setUserPlan({
                planID: resp.plan_id,
                startTime: new Date(resp.start_time * 1000).toLocaleDateString(),
                endTime: new Date(resp.end_time * 1000).toLocaleDateString()
            });
            setUserInfo({
                ...userInfo,
                planID: resp.plan_id
            });
        } catch (e: any) {
            console.error(e);
        }
        setIsLoading(false);
    }

    const { userIsPro } = usePlan();
    const { userInfo } = useSnapshot(userStore);

    React.useEffect(() => {
        loadPlanList();
        if (!userIsPro) {
            setUserPlan({
                planID: '😭',
                startTime: '',
                endTime: 'Now?!!!'
            });
            setTimeout(() => {
                setIsLoading(false);
            }, 500);
            return;
        }
        loadUserPlan();
    }, [userIsPro]);

    const [planList, setPlanList] = React.useState();
    async function loadPlanList() {
        try {
            const list = await GetPlanList();

            setPlanList(list);
        } catch (e: any) {
            console.error(e);
        }
    }

    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const [redeemLoading, setRedeemLoading] = React.useState(false);
    const [gift, setGift] = React.useState<RedeemGiftCodeResponse>();
    const redeem = React.useCallback(async () => {
        setRedeemLoading(true);
        try {
            const res = await RedeemGiftCode(giftCode);
            setGift(res);
            onOpen();
            await loadUserPlan();
            setGiftCode('');
        } catch (e: any) {
            console.error(e);
        }
        setRedeemLoading(false);
    }, [giftCode]);

    return (
        <div ref={ref} className={cn('p-2', className)} {...props}>
            <Skeleton isLoaded={!isLoading} className=" rounded-lg">
                {/* Payment Method */}
                {userPlan && userPlan.planID != '' && (
                    <div>
                        <div className="rounded-large bg-default-100">
                            <div className="flex items-center justify-between gap-2 px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <Icon className="h-6 w-6 text-default-500" icon="solar:card-outline" />
                                    <div>
                                        <p className="text-sm font-medium text-default-600"> {t('CurrentPlan', { plan: userPlan.planID })}</p>
                                        <p className="text-xs text-default-400">
                                            {t('Your membership plan will expire on')} <span className="text-default-500">{userPlan?.endTime}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <Spacer y={4} />
                {/* Current Plan */}
                <div>
                    {/* {userIsPro ? (
                        <p className="mt-1 text-sm font-normal text-default-400">
                            {t('Your membership plan will expire on')} <span className="text-default-500">{userPlan?.endTime}</span>
                        </p>
                    ) : (
                        ''
                    )} */}
                    {/* Plan radio group */}
                    {planList && (
                        <>
                            <p className="text-base font-medium text-default-700">{t('Current Plan')}</p>
                            <p className="mt-1 text-sm font-normal text-default-400">{t('PlanSellDesc')}</p>
                            <RadioGroup
                                className="mt-4"
                                classNames={{
                                    wrapper: 'gap-4 flex-row flex-wrap'
                                }}
                                defaultValue={userPlan?.planID}
                                isReadOnly
                            >
                                {planList.map((v: Plan) => {
                                    return (
                                        <PlanCustomRadio
                                            key={v.plan_id}
                                            classNames={{
                                                label: 'text-default-500 font-medium'
                                            }}
                                            description={t(v.title)}
                                            value={v.plan_id}
                                        >
                                            <div className="mt-2">
                                                <p className="pt-2">
                                                    <span className="text-[30px] font-semibold leading-7 text-default-foreground">￥{v.price}</span>
                                                    &nbsp;<span className="text-xs font-medium text-default-400">/ {t(v.plan_cycle)}</span>
                                                </p>
                                                <ul className="list-inside mt-3 list-disc text-xs font-normal text-default-500">
                                                    {v.features.map(v => {
                                                        return <li key={v}>{t(v)}</li>;
                                                    })}
                                                </ul>
                                            </div>
                                        </PlanCustomRadio>
                                    );
                                })}
                            </RadioGroup>
                        </>
                    )}
                </div>
                <Spacer y={4} />
                {/* Billing Address */}
                <div>
                    {/*  Title */}
                    <div>
                        <p className="text-base font-medium text-default-700">{t('GiftCode')}</p>
                        <p className="mt-1 text-sm font-normal text-default-400">Your personal referral code.</p>
                    </div>
                </div>
                <div className="mt-2 space-y-2">
                    <Input placeholder="Enter your gift code" size="lg" value={giftCode} onValueChange={setGiftCode} />
                </div>
                <Button className="mt-5 bg-default-foreground text-background" isLoading={redeemLoading} value={giftCode} isDisabled={!giftCode || giftCode.length < 10} onPress={redeem}>
                    {t('Redeem')}
                </Button>
            </Skeleton>

            <Modal isOpen={isOpen} backdrop="blur" onOpenChange={onOpenChange}>
                <ModalContent>
                    {onClose => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">{t('Congratulation')}</ModalHeader>
                            <ModalBody>
                                <span className="text-2xl">{gift?.title}</span>
                            </ModalBody>
                            <ModalFooter>
                                <Button color="primary" onPress={onClose}>
                                    Yeah!!! ✌
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
});

BillingSetting.displayName = 'BillingSetting';

export default BillingSetting;
