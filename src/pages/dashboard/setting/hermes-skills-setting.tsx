import { Button, Chip, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, ScrollShadow } from '@heroui/react';
import { Icon } from '@iconify/react';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
    DeleteHermesSkill,
    InstallHermesSkill,
    ListHermesSkills,
    ReloadHermesSkills,
    ViewHermesSkill,
    type HermesSkillContent,
    type HermesSkillInfo,
    type HermesSkillList
} from '@/apis/hermes-desktop';

interface HermesSkillsSettingProps {
    className?: string;
}

const EMPTY_SKILLS: HermesSkillList = { skills: [], userSkillsDir: '', builtInRootDir: '' };

const HermesSkillsSetting = React.forwardRef<HTMLDivElement, HermesSkillsSettingProps>(({ className, ...props }, ref) => {
    const { t } = useTranslation();
    const [skills, setSkills] = React.useState<HermesSkillList>(EMPTY_SKILLS);
    const [selectedSkill, setSelectedSkill] = React.useState<HermesSkillContent | null>(null);
    const [installPath, setInstallPath] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [isInstalling, setIsInstalling] = React.useState(false);
    const [deletingSkillKey, setDeletingSkillKey] = React.useState('');
    const [pendingDeleteSkill, setPendingDeleteSkill] = React.useState<HermesSkillInfo | null>(null);
    const [installError, setInstallError] = React.useState('');

    const loadSkills = React.useCallback(async () => {
        setIsLoading(true);
        try {
            setSkills(await ListHermesSkills());
        } catch (error: any) {
            console.error('Failed to load Hermes skills:', error);
            toast.error(error?.message || t('Failed to load Hermes skills'));
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    React.useEffect(() => {
        loadSkills();
    }, [loadSkills]);

    const reloadSkills = React.useCallback(async () => {
        setIsLoading(true);
        try {
            setSkills(await ReloadHermesSkills());
            toast.success(t('Hermes skills reloaded'));
        } catch (error: any) {
            console.error(error);
            toast.error(error?.message || t('Failed'));
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    const installSkill = React.useCallback(async () => {
        const sourcePath = installPath.trim();
        if (!sourcePath) {
            setInstallError(t('Skill folder path is required'));
            return;
        }
        setInstallError('');
        setIsInstalling(true);
        try {
            setSkills(await InstallHermesSkill({ sourcePath }));
            setInstallPath('');
            toast.success(t('Hermes skill installed'));
        } catch (error: any) {
            console.error(error);
            toast.error(error?.message || t('Failed'));
        } finally {
            setIsInstalling(false);
        }
    }, [installPath, t]);

    const viewSkill = React.useCallback(
        async (skill: HermesSkillInfo) => {
            try {
                setSelectedSkill(await ViewHermesSkill({ name: skill.name, source: skill.source }));
            } catch (error: any) {
                console.error(error);
                toast.error(error?.message || t('Failed'));
            }
        },
        [t]
    );

    const openDeleteConfirm = React.useCallback((skill: HermesSkillInfo) => {
        if (skill.builtIn) {
            return;
        }
        setPendingDeleteSkill(skill);
    }, []);

    const closeDeleteConfirm = React.useCallback(() => {
        if (!deletingSkillKey) {
            setPendingDeleteSkill(null);
        }
    }, [deletingSkillKey]);

    const confirmDeleteSkill = React.useCallback(
        async () => {
            const skill = pendingDeleteSkill;
            if (!skill) {
                return;
            }
            if (skill.builtIn) {
                return;
            }
            const key = skillKey(skill);
            setDeletingSkillKey(key);
            try {
                setSkills(await DeleteHermesSkill({ name: skill.name, source: skill.source, path: skill.path }));
                setPendingDeleteSkill(null);
                toast.success(t('Hermes skill deleted'));
            } catch (error: any) {
                console.error(error);
                toast.error(error?.message || t('Failed'));
            } finally {
                setDeletingSkillKey('');
            }
        },
        [pendingDeleteSkill, t]
    );

    return (
        <div ref={ref} className={className} {...props}>
            <div className="flex flex-col gap-5 p-2">
                <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-default-foreground">{t('Hermes Skills')}</h3>
                        <p className="mt-1 truncate text-small text-default-500">
                            {skills.userSkillsDir ? `${t('User skills folder')}: ${skills.userSkillsDir}` : t('Manage local Hermes skills')}
                        </p>
                    </div>
                    <Button isIconOnly variant="light" aria-label={t('Reload Skills')} isLoading={isLoading} onPress={reloadSkills}>
                        {!isLoading && <Icon icon="material-symbols:refresh-rounded" width={21} />}
                    </Button>
                </div>

                <div className="flex flex-col gap-3 rounded-medium border border-default-200 bg-content1 p-3">
                    <div>
                        <h4 className="text-small font-semibold text-default-700">{t('Install User Skill')}</h4>
                        <p className="mt-1 text-tiny leading-5 text-default-500">{t('Install a local folder that contains SKILL.md into the QukaAI Desktop Hermes home.')}</p>
                    </div>
                    <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <Input
                            label={t('Skill Folder')}
                            labelPlacement="outside"
                            placeholder="/Users/name/path/to/my-skill"
                            value={installPath}
                            variant="bordered"
                            isInvalid={Boolean(installError)}
                            errorMessage={installError}
                            onValueChange={value => {
                                setInstallPath(value);
                                if (installError) {
                                    setInstallError('');
                                }
                            }}
                        />
                        <Button className="sm:mt-6" color="primary" isLoading={isInstalling} startContent={!isInstalling && <Icon icon="material-symbols:download-rounded" />} onPress={installSkill}>
                            {t('Install')}
                        </Button>
                    </div>
                </div>

                <Divider />

                <div className="flex flex-col gap-2">
                    {skills.skills.length === 0 && <div className="rounded-medium border border-default-200 px-3 py-4 text-center text-small text-default-500">{t('No Hermes skills found')}</div>}
                    {skills.skills.map(skill => (
                        <div key={skillKey(skill)} className="flex items-center gap-3 rounded-medium border border-default-200 px-3 py-2">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="truncate text-small font-medium text-default-700">{skill.name}</span>
                                    <Chip size="sm" variant="flat" color={skill.builtIn ? 'primary' : 'default'}>
                                        {skill.builtIn ? t('Built-in') : t('User')}
                                    </Chip>
                                </div>
                                <p className="mt-1 line-clamp-2 text-tiny text-default-500">{skill.description || skill.path}</p>
                            </div>
                            <Button isIconOnly size="sm" variant="light" aria-label={t('View Skill')} onPress={() => viewSkill(skill)}>
                                <Icon icon="material-symbols:visibility-outline-rounded" width={19} />
                            </Button>
                            {!skill.builtIn && (
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    color="danger"
                                    aria-label={t('Delete Skill')}
                                    isLoading={deletingSkillKey === skillKey(skill)}
                                    onClick={() => openDeleteConfirm(skill)}
                                    onPress={() => openDeleteConfirm(skill)}
                                >
                                    {deletingSkillKey !== skillKey(skill) && <Icon icon="material-symbols:delete-outline-rounded" width={19} />}
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <Modal backdrop="blur" isOpen={Boolean(selectedSkill)} size="3xl" scrollBehavior="inside" onClose={() => setSelectedSkill(null)}>
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span>{selectedSkill?.info.name}</span>
                            {selectedSkill && (
                                <Chip size="sm" variant="flat" color={selectedSkill.info.builtIn ? 'primary' : 'default'}>
                                    {selectedSkill.info.builtIn ? t('Built-in') : t('User')}
                                </Chip>
                            )}
                        </div>
                        <span className="break-all text-tiny font-normal text-default-500">{selectedSkill?.info.path}</span>
                    </ModalHeader>
                    <ModalBody className="pb-6">
                        <ScrollShadow className="max-h-[60vh] rounded-medium border border-default-200 bg-content2 p-3">
                            <pre className="whitespace-pre-wrap break-words text-xs leading-5 text-default-700">{selectedSkill?.content || ''}</pre>
                        </ScrollShadow>
                    </ModalBody>
                </ModalContent>
            </Modal>
            <Modal backdrop="blur" isOpen={Boolean(pendingDeleteSkill)} placement="center" onClose={closeDeleteConfirm}>
                <ModalContent>
                    <ModalHeader>{t('Delete Skill')}</ModalHeader>
                    <ModalBody>
                        <p className="text-small text-default-600">{t('Delete this Hermes skill?')}</p>
                        <div className="rounded-medium border border-default-200 bg-content2 px-3 py-2">
                            <p className="text-small font-medium text-default-800">{pendingDeleteSkill?.name}</p>
                            <p className="mt-1 break-all text-tiny text-default-500">{pendingDeleteSkill?.path}</p>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={closeDeleteConfirm}>
                            {t('Cancel')}
                        </Button>
                        <Button color="danger" isLoading={Boolean(deletingSkillKey)} startContent={!deletingSkillKey && <Icon icon="material-symbols:delete-outline-rounded" />} onPress={confirmDeleteSkill}>
                            {t('Delete')}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
});

HermesSkillsSetting.displayName = 'HermesSkillsSetting';

export default HermesSkillsSetting;

function skillKey(skill: HermesSkillInfo): string {
    return `${skill.source}:${skill.name}:${skill.path}`;
}
