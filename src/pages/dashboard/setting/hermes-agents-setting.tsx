import { Button, Chip, Divider, Input, ScrollShadow, Select, SelectItem, Switch, Textarea } from '@heroui/react';
import { Icon } from '@iconify/react';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { DeleteHermesAgent, type HermesAgentProfile, type HermesAgentProfileList, type HermesAgentRunTestResult, ListHermesAgents, RunHermesAgentTest, SaveHermesAgent } from '@/apis/hermes-desktop';

interface HermesAgentsSettingProps {
    className?: string;
    currentSessionID?: string;
}

interface AgentForm {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
    toolPolicy: string;
    enabledToolsets: string[];
    enabledSkills: string;
    contextPolicy: string;
}

const EMPTY_LIST: HermesAgentProfileList = { profiles: [], profilesPath: '' };
const TOOLSET_OPTIONS = [
    { key: 'web', label: 'Web' },
    { key: 'terminal', label: 'Terminal' },
    { key: 'skills', label: 'Skills' },
    { key: 'memory', label: 'Memory' }
];
const DEFAULT_FORM: AgentForm = {
    id: '',
    name: '',
    description: '',
    systemPrompt: '',
    toolPolicy: 'read_only',
    enabledToolsets: ['skills', 'memory'],
    enabledSkills: '',
    contextPolicy: 'focused'
};

const HermesAgentsSetting = React.forwardRef<HTMLDivElement, HermesAgentsSettingProps>(({ className, currentSessionID, ...props }, ref) => {
    const { t } = useTranslation();
    const [list, setList] = React.useState<HermesAgentProfileList>(EMPTY_LIST);
    const [selectedID, setSelectedID] = React.useState('');
    const [form, setForm] = React.useState<AgentForm>(DEFAULT_FORM);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isTesting, setIsTesting] = React.useState(false);
    const [fakeTest, setFakeTest] = React.useState(true);
    const [testTask, setTestTask] = React.useState('Run a short verification task and explain what this agent is configured to do.');
    const [testResult, setTestResult] = React.useState<HermesAgentRunTestResult | null>(null);

    const selectedProfile = React.useMemo(() => list.profiles.find(profile => profile.id === selectedID) || null, [list.profiles, selectedID]);

    const loadAgents = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const next = await ListHermesAgents();
            setList(next);
            setSelectedID(prev => {
                if (prev || next.profiles.length === 0) {
                    return prev;
                }
                setForm(profileToForm(next.profiles[0]));
                return next.profiles[0].id;
            });
        } catch (error: any) {
            console.error(error);
            toast.error(error?.message || t('Failed to load Hermes agents'));
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    React.useEffect(() => {
        loadAgents();
    }, [loadAgents]);

    const selectProfile = React.useCallback((profile: HermesAgentProfile) => {
        setSelectedID(profile.id);
        setForm(profileToForm(profile));
        setTestResult(null);
    }, []);

    const createNew = React.useCallback(() => {
        setSelectedID('');
        setForm(DEFAULT_FORM);
        setTestResult(null);
    }, []);

    const setField = React.useCallback(<K extends keyof AgentForm>(field: K, value: AgentForm[K]) => {
        setForm(prev => ({ ...prev, [field]: value }));
    }, []);

    const save = React.useCallback(async () => {
        const profile = formToProfile(form);
        if (!profile.id || !profile.name || !profile.systemPrompt) {
            toast.error(t('Agent id, name and system prompt are required'));
            return;
        }
        setIsSaving(true);
        try {
            const next = await SaveHermesAgent({ profile });
            setList(next);
            setSelectedID(profile.id);
            toast.success(t('Hermes agent saved'));
        } catch (error: any) {
            console.error(error);
            toast.error(error?.message || t('Failed'));
        } finally {
            setIsSaving(false);
        }
    }, [form, t]);

    const deleteProfile = React.useCallback(async () => {
        if (!selectedProfile || selectedProfile.builtIn) {
            return;
        }
        setIsDeleting(true);
        try {
            const next = await DeleteHermesAgent({ id: selectedProfile.id });
            setList(next);
            const first = next.profiles[0];
            setSelectedID(first?.id || '');
            setForm(first ? profileToForm(first) : DEFAULT_FORM);
            toast.success(t('Hermes agent deleted'));
        } catch (error: any) {
            console.error(error);
            toast.error(error?.message || t('Failed'));
        } finally {
            setIsDeleting(false);
        }
    }, [selectedProfile, t]);

    const runTest = React.useCallback(async () => {
        const profile = selectedProfile || formToProfile(form);
        if (!profile.id) {
            toast.error(t('Select or create an agent first'));
            return;
        }
        setIsTesting(true);
        setTestResult(null);
        try {
            const result = await RunHermesAgentTest({
                parentSessionID: currentSessionID || 'manual-agent-test',
                userRequest: `Verify QukaAI Desktop agent profile: ${profile.name || profile.id}`,
                coordinatorIntent: 'Manual verification from the QukaAI Desktop Agents panel.',
                strategy: 'parallel',
                maxParallelism: 1,
                fake: fakeTest,
                ensureBridge: !fakeTest,
                nodes: [
                    {
                        nodeID: `${profile.id}-test`,
                        agentID: profile.id,
                        task: testTask,
                        expectedOutput: 'A concise structured verification result.',
                        toolPolicy: profile.toolPolicy,
                        toolsets: profile.enabledToolsets
                    }
                ]
            });
            setTestResult(result);
            toast.success(result.ok ? t('Agent test completed') : t('Agent test finished with errors'));
        } catch (error: any) {
            console.error(error);
            toast.error(error?.message || t('Failed'));
        } finally {
            setIsTesting(false);
        }
    }, [currentSessionID, fakeTest, form, selectedProfile, t, testTask]);

    return (
        <div ref={ref} className={className} {...props}>
            <div className="grid h-[72vh] min-h-0 grid-cols-1 gap-4 overflow-hidden p-2 md:grid-cols-[240px_minmax(0,1fr)]">
                <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <h3 className="text-lg font-semibold text-default-foreground">{t('Hermes Agents')}</h3>
                            <p className="truncate text-tiny text-default-500">{list.profilesPath || t('Manage local agent profiles')}</p>
                        </div>
                        <Button isIconOnly variant="light" isLoading={isLoading} aria-label={t('Reload')} onPress={loadAgents}>
                            {!isLoading && <Icon icon="material-symbols:refresh-rounded" width={20} />}
                        </Button>
                    </div>
                    <Button size="sm" variant="flat" startContent={<Icon icon="material-symbols:add-rounded" width={18} />} onPress={createNew}>
                        {t('New Agent')}
                    </Button>
                    <ScrollShadow className="min-h-0 flex-1 overflow-auto pr-1">
                        <div className="flex flex-col gap-2">
                            {list.profiles.map(profile => (
                                <button
                                    key={profile.id}
                                    className={`rounded-medium border px-3 py-2 text-left transition-colors ${selectedID === profile.id ? 'border-primary bg-primary-50' : 'border-default-200 bg-content1 hover:bg-content2'}`}
                                    type="button"
                                    onClick={() => selectProfile(profile)}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="min-w-0 flex-1 truncate text-small font-medium text-default-800">{profile.name || profile.id}</span>
                                        <Chip size="sm" variant="flat" color={profile.builtIn ? 'primary' : 'default'}>
                                            {profile.builtIn ? t('Built-in') : t('User')}
                                        </Chip>
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-tiny text-default-500">{profile.description || profile.id}</p>
                                </button>
                            ))}
                        </div>
                    </ScrollShadow>
                </div>

                <ScrollShadow className="min-h-0 overflow-auto pr-1">
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Input
                                label={t('Agent ID')}
                                labelPlacement="outside"
                                isDisabled={Boolean(selectedProfile?.builtIn)}
                                value={form.id}
                                variant="bordered"
                                onValueChange={value => setField('id', value)}
                            />
                            <Input
                                label={t('Name')}
                                labelPlacement="outside"
                                isDisabled={Boolean(selectedProfile?.builtIn)}
                                value={form.name}
                                variant="bordered"
                                onValueChange={value => setField('name', value)}
                            />
                        </div>
                        <Input
                            label={t('Description')}
                            labelPlacement="outside"
                            isDisabled={Boolean(selectedProfile?.builtIn)}
                            value={form.description}
                            variant="bordered"
                            onValueChange={value => setField('description', value)}
                        />
                        <Textarea
                            minRows={6}
                            label={t('System Prompt')}
                            labelPlacement="outside"
                            isDisabled={Boolean(selectedProfile?.builtIn)}
                            value={form.systemPrompt}
                            variant="bordered"
                            onValueChange={value => setField('systemPrompt', value)}
                        />
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <Select
                                label={t('Tool Policy')}
                                labelPlacement="outside"
                                selectedKeys={[form.toolPolicy]}
                                isDisabled={Boolean(selectedProfile?.builtIn)}
                                variant="bordered"
                                onSelectionChange={keys => setField('toolPolicy', String(Array.from(keys)[0] || 'read_only'))}
                            >
                                <SelectItem key="no_tools">{t('No Tools')}</SelectItem>
                                <SelectItem key="read_only">{t('Read Only')}</SelectItem>
                                <SelectItem key="restricted">{t('Restricted')}</SelectItem>
                                <SelectItem key="workspace_write">{t('Workspace Write')}</SelectItem>
                            </Select>
                            <Select
                                label={t('Context')}
                                labelPlacement="outside"
                                selectedKeys={[form.contextPolicy]}
                                isDisabled={Boolean(selectedProfile?.builtIn)}
                                variant="bordered"
                                onSelectionChange={keys => setField('contextPolicy', String(Array.from(keys)[0] || 'focused'))}
                            >
                                <SelectItem key="minimal">{t('Minimal')}</SelectItem>
                                <SelectItem key="focused">{t('Focused')}</SelectItem>
                                <SelectItem key="summary">{t('Summary')}</SelectItem>
                            </Select>
                            <Select
                                label={t('Toolsets')}
                                labelPlacement="outside"
                                selectionMode="multiple"
                                selectedKeys={new Set(form.enabledToolsets)}
                                isDisabled={Boolean(selectedProfile?.builtIn)}
                                variant="bordered"
                                renderValue={() => <span className="block min-w-0 truncate text-small">{formatToolsetSelection(form.enabledToolsets, t)}</span>}
                                onSelectionChange={keys => {
                                    const selected = keys === 'all' ? TOOLSET_OPTIONS.map(option => option.key) : Array.from(keys).map(String);
                                    setField('enabledToolsets', selected);
                                }}
                            >
                                {TOOLSET_OPTIONS.map(option => (
                                    <SelectItem key={option.key}>{t(option.label)}</SelectItem>
                                ))}
                            </Select>
                        </div>
                        <Input
                            label={t('Preferred Skills')}
                            labelPlacement="outside"
                            isDisabled={Boolean(selectedProfile?.builtIn)}
                            value={form.enabledSkills}
                            variant="bordered"
                            onValueChange={value => setField('enabledSkills', value)}
                        />

                        <div className="flex items-center justify-between gap-3">
                            <div className="text-tiny text-default-500">
                                {selectedProfile?.builtIn
                                    ? t('Built-in agents are read-only. Create a user agent to customize behavior.')
                                    : t('User agents are saved locally and loaded by quka-agents at run time.')}
                            </div>
                            <div className="flex items-center gap-2">
                                {!selectedProfile?.builtIn && selectedProfile && (
                                    <Button
                                        color="danger"
                                        variant="light"
                                        isLoading={isDeleting}
                                        startContent={!isDeleting && <Icon icon="material-symbols:delete-outline-rounded" />}
                                        onPress={deleteProfile}
                                    >
                                        {t('Delete')}
                                    </Button>
                                )}
                                {!selectedProfile?.builtIn && (
                                    <Button color="primary" isLoading={isSaving} startContent={!isSaving && <Icon icon="material-symbols:save-outline-rounded" />} onPress={save}>
                                        {t('Save')}
                                    </Button>
                                )}
                            </div>
                        </div>

                        <Divider />

                        <div className="flex flex-col gap-3 rounded-medium border border-default-200 bg-content1 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h4 className="text-small font-semibold text-default-800">{t('Run Test')}</h4>
                                    <p className="mt-1 text-tiny text-default-500">{t('Run a manual sub-agent verification and inspect the trace output.')}</p>
                                </div>
                                <Switch size="sm" isSelected={fakeTest} onValueChange={setFakeTest}>
                                    {t('Fake')}
                                </Switch>
                            </div>
                            <Textarea minRows={3} value={testTask} variant="bordered" onValueChange={setTestTask} />
                            <Button
                                className="self-start"
                                color="primary"
                                isLoading={isTesting}
                                startContent={!isTesting && <Icon icon="material-symbols:play-arrow-rounded" width={20} />}
                                onPress={runTest}
                            >
                                {t('Run Agent Test')}
                            </Button>
                            {testResult && (
                                <div className="rounded-medium border border-default-200 bg-content2 p-3">
                                    <div className="mb-2 flex items-center gap-2">
                                        <Chip size="sm" variant="flat" color={testResult.ok ? 'success' : 'danger'}>
                                            {testResult.status}
                                        </Chip>
                                        <span className="truncate text-tiny text-default-500">{testResult.run_id}</span>
                                    </div>
                                    <p className="break-all text-tiny text-default-500">{testResult.trace_dir}</p>
                                    <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-default-700">{JSON.stringify(testResult.nodes, null, 2)}</pre>
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollShadow>
            </div>
        </div>
    );
});

HermesAgentsSetting.displayName = 'HermesAgentsSetting';

export default HermesAgentsSetting;

function profileToForm(profile: HermesAgentProfile): AgentForm {
    return {
        id: profile.id || '',
        name: profile.name || '',
        description: profile.description || '',
        systemPrompt: profile.systemPrompt || '',
        toolPolicy: profile.toolPolicy || 'read_only',
        enabledToolsets: cleanStringList(profile.enabledToolsets || []),
        enabledSkills: (profile.enabledSkills || []).join(','),
        contextPolicy: profile.contextPolicy || 'focused'
    };
}

function formToProfile(form: AgentForm): HermesAgentProfile {
    return {
        id: form.id.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        systemPrompt: form.systemPrompt.trim(),
        toolPolicy: form.toolPolicy || 'read_only',
        enabledToolsets: cleanStringList(form.enabledToolsets),
        enabledSkills: splitCSV(form.enabledSkills),
        contextPolicy: form.contextPolicy || 'focused',
        builtIn: false
    };
}

function cleanStringList(values: string[]): string[] {
    return Array.from(new Set(values.map(item => item.trim()).filter(Boolean)));
}

function formatToolsetSelection(values: string[], t: (value: string) => string): string {
    const labelByKey = new Map(TOOLSET_OPTIONS.map(option => [option.key, t(option.label)]));
    const labels = cleanStringList(values).map(value => labelByKey.get(value) || value);
    if (labels.length <= 2) {
        return labels.join(', ');
    }
    return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
}

function splitCSV(value: string): string[] {
    return value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}
