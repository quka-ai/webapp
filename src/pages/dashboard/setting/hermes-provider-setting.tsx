import { Button, Input } from '@heroui/react';
import { Icon } from '@iconify/react';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSnapshot } from 'valtio';

import {
    ConfigureHermesEnvironment,
    ConfigureHermesProvider,
    GetHermesEnvironmentVariables,
    GetHermesProviderConfig,
    type HermesEnvironmentVariable,
    readHermesProviderConfig,
    SubscribeHermesAgentStatus
} from '@/apis/hermes-desktop';
import userStore from '@/stores/user';

interface HermesProviderSettingProps {
    className?: string;
    onConfigured?: () => void;
    title?: string;
    description?: string;
}

interface HermesProviderForm {
    modelName: string;
    baseURL: string;
    apiKey: string;
    tavilyAPIKey: string;
}

type HermesProviderFormErrors = Partial<Record<keyof HermesProviderForm, string>>;

interface HermesEnvironmentRow {
    id: string;
    name: string;
    value: string;
    configured: boolean;
}

interface HermesProviderPreset {
    id: string;
    modelName: string;
    baseURL: string;
    apiKey: string;
    tavilyAPIKey: string;
    updatedAt: number;
    pinned?: boolean;
}

const DEFAULT_FORM: HermesProviderForm = {
    modelName: '',
    baseURL: '',
    apiKey: '',
    tavilyAPIKey: ''
};

const HERMES_PROVIDER_PRESETS_STORAGE_KEY = 'quka-hermes-provider-presets';
const MAX_HERMES_PROVIDER_PRESETS = 8;
const QUKA_LLM_GATEWAY_PRESET_ID = 'quka-ai-llm-gateway';
const QUKA_LLM_GATEWAY_MODEL = 'quka-hermes';

const HermesProviderSetting = React.forwardRef<HTMLDivElement, HermesProviderSettingProps>(({ className, onConfigured, title, description, ...props }, ref) => {
    const { t } = useTranslation();
    const { host, accessToken, loginToken } = useSnapshot(userStore);
    const [storedConfig, setStoredConfig] = React.useState(() => readHermesProviderConfig());
    const [form, setForm] = React.useState<HermesProviderForm>(() => ({
        ...DEFAULT_FORM,
        modelName: storedConfig.modelName,
        baseURL: storedConfig.baseURL
    }));
    const [envRows, setEnvRows] = React.useState<HermesEnvironmentRow[]>(() => [createEnvironmentRow()]);
    const [envErrors, setEnvErrors] = React.useState<Record<string, string>>({});
    const [errors, setErrors] = React.useState<HermesProviderFormErrors>({});
    const [presets, setPresets] = React.useState<HermesProviderPreset[]>(() => readHermesProviderPresets());
    const [switchingPresetID, setSwitchingPresetID] = React.useState<string | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isSavingEnv, setIsSavingEnv] = React.useState(false);
    const qukaGatewayPreset = React.useMemo(() => createQukaLLMGatewayPreset(host, accessToken || loginToken || ''), [accessToken, host, loginToken]);
    const visiblePresets = React.useMemo(() => [qukaGatewayPreset, ...presets.filter(preset => preset.id !== QUKA_LLM_GATEWAY_PRESET_ID)], [presets, qukaGatewayPreset]);

    React.useEffect(() => {
        let mounted = true;
        Promise.all([GetHermesProviderConfig(), GetHermesEnvironmentVariables()])
            .then(([config, variables]) => {
                if (!mounted) {
                    return;
                }
                setStoredConfig(config);
                setForm(prev => ({
                    ...prev,
                    modelName: prev.modelName.trim() ? prev.modelName : config.modelName,
                    baseURL: prev.baseURL.trim() ? prev.baseURL : config.baseURL
                }));
                setEnvRows(normalizeEnvironmentRows(variables));
            })
            .catch(error => {
                console.error('Failed to load Hermes settings:', error);
                if (mounted) {
                    setEnvRows([createEnvironmentRow()]);
                }
            });
        return () => {
            mounted = false;
        };
    }, []);

    React.useEffect(() => {
        return SubscribeHermesAgentStatus(event => {
            console.info('[hermes] status event', event);
            if (event.error) {
                console.error('Hermes Agent failed to start:', event.error);
                toast.error(event.error);
                return;
            }
            if (event.ready) {
                toast.success(t('Hermes Agent started'));
            }
        });
    }, [t]);

    const setField = React.useCallback(
        (field: keyof HermesProviderForm, value: string) => {
            setForm(prev => ({ ...prev, [field]: value }));
            if (errors[field]) {
                setErrors(prev => ({ ...prev, [field]: undefined }));
            }
        },
        [errors]
    );

    const setEnvField = React.useCallback(
        (id: string, field: 'name' | 'value', value: string) => {
            setEnvRows(prev => prev.map(row => (row.id === id ? { ...row, [field]: value } : row)));
            if (envErrors[id]) {
                setEnvErrors(prev => ({ ...prev, [id]: '' }));
            }
        },
        [envErrors]
    );

    const addEnvRow = React.useCallback(() => {
        setEnvRows(prev => [...prev, createEnvironmentRow()]);
    }, []);

    const removeEnvRow = React.useCallback((id: string) => {
        setEnvRows(prev => prev.filter(row => row.id !== id));
        setEnvErrors(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    }, []);

    const saveProviderConfig = React.useCallback(
        async (nextForm: HermesProviderForm, successMessage: string, options?: { skipPreset?: boolean }) => {
            const nextErrors = validateForm(nextForm, storedConfig.apiKeyConfigured, t);
            setErrors(nextErrors);
            if (Object.keys(nextErrors).length > 0) {
                return false;
            }

            console.info('[hermes] saving provider configuration', {
                modelName: nextForm.modelName.trim(),
                baseURL: nextForm.baseURL.trim(),
                apiKeyPresent: Boolean(nextForm.apiKey.trim()),
                tavilyKeyPresent: Boolean(nextForm.tavilyAPIKey.trim())
            });
            await withTimeout(
                ConfigureHermesProvider({
                    modelName: nextForm.modelName.trim(),
                    baseURL: nextForm.baseURL.trim(),
                    apiKey: nextForm.apiKey.trim(),
                    tavilyAPIKey: nextForm.tavilyAPIKey.trim()
                }),
                15000
            );
            console.info('[hermes] provider configuration saved; bridge will start in background');
            toast.success(successMessage);
            setStoredConfig(prev => ({
                modelName: nextForm.modelName.trim(),
                baseURL: nextForm.baseURL.trim(),
                apiKeyConfigured: Boolean(nextForm.apiKey.trim()) || prev.apiKeyConfigured,
                tavilyConfigured: Boolean(nextForm.tavilyAPIKey.trim()) || Boolean(prev.tavilyConfigured)
            }));
            if (!options?.skipPreset) {
                setPresets(prev => saveHermesProviderPresets(upsertHermesProviderPreset(prev, nextForm)));
            }
            setForm(prev => ({ ...prev, modelName: nextForm.modelName.trim(), baseURL: nextForm.baseURL.trim(), apiKey: '', tavilyAPIKey: '' }));
            onConfigured?.();
            return true;
        },
        [onConfigured, storedConfig.apiKeyConfigured, t]
    );

    const save = React.useCallback(async () => {
        setIsSaving(true);
        try {
            await saveProviderConfig(form, t('Hermes configuration saved'));
        } catch (error: any) {
            console.error(error);
            toast.error(error?.message || t('Failed'));
        } finally {
            setIsSaving(false);
        }
    }, [form, saveProviderConfig, t]);

    const switchPreset = React.useCallback(
        async (preset: HermesProviderPreset) => {
            if (preset.pinned && !preset.apiKey) {
                toast.error(t('QukaAI login token is required for Hermes Agent'));
                return;
            }
            if (!preset.apiKey && !storedConfig.apiKeyConfigured) {
                toast.error(t('QukaAI login token is required for Hermes Agent'));
                return;
            }
            const nextForm = {
                ...form,
                modelName: preset.modelName,
                baseURL: preset.baseURL,
                apiKey: preset.apiKey || form.apiKey,
                tavilyAPIKey: preset.tavilyAPIKey || form.tavilyAPIKey
            };
            setForm(nextForm);
            setSwitchingPresetID(preset.id);
            try {
                await saveProviderConfig(nextForm, t('Hermes configuration switched'), { skipPreset: preset.pinned });
            } catch (error: any) {
                console.error(error);
                toast.error(error?.message || t('Failed'));
            } finally {
                setSwitchingPresetID(null);
            }
        },
        [form, saveProviderConfig, t]
    );

    const removePreset = React.useCallback((id: string) => {
        setPresets(prev => saveHermesProviderPresets(prev.filter(preset => preset.id !== id)));
    }, []);

    const saveEnvironment = React.useCallback(async () => {
        const nextErrors = validateEnvironmentRows(envRows, t);
        setEnvErrors(nextErrors);
        if (Object.values(nextErrors).some(Boolean)) {
            return;
        }

        setIsSavingEnv(true);
        try {
            const variables = envRows
                .filter(row => row.name.trim())
                .map(row => ({
                    name: row.name.trim(),
                    value: row.value,
                    configured: row.configured
                }));
            const saved = await ConfigureHermesEnvironment({ variables });
            setEnvRows(normalizeEnvironmentRows(saved));
            toast.success(t('Hermes environment saved'));
        } catch (error: any) {
            console.error(error);
            toast.error(error?.message || t('Failed'));
        } finally {
            setIsSavingEnv(false);
        }
    }, [envRows, t]);

    return (
        <div ref={ref} className={className} {...props}>
            <div className="flex flex-col gap-5 p-2">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-default-foreground">{t('Hermes Agent')}</h3>
                        <p className="mt-1 text-small text-default-500">{description || t('Desktop model provider')}</p>
                    </div>
                    <Icon icon="material-symbols:desktop-mac-rounded" width={24} className="text-default-400" />
                </div>
                {title && <h4 className="text-base font-semibold text-default-foreground">{title}</h4>}

                <div className="flex flex-col gap-4">
                    {visiblePresets.length > 0 && (
                        <div className="rounded-large border border-default-200 bg-default-50/50 p-3">
                            <div className="mb-3 flex items-start justify-between gap-3">
                                <div>
                                    <h4 className="text-small font-semibold text-default-foreground">{t('Quick Switch')}</h4>
                                    <p className="mt-1 text-tiny text-default-500">{t('Quick Switch Description')}</p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                {visiblePresets.map(preset => {
                                    const isCurrent = preset.modelName === form.modelName.trim() && preset.baseURL === form.baseURL.trim();
                                    const isSwitching = switchingPresetID === preset.id;
                                    return (
                                        <div key={preset.id} className="flex items-center justify-between gap-3 rounded-medium border border-default-200 bg-background px-3 py-2">
                                            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => switchPreset(preset)}>
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <div className="truncate text-small font-medium text-default-foreground">{preset.pinned ? t('QukaAI Built-in LLM Gateway') : preset.modelName}</div>
                                                    {preset.pinned && (
                                                        <span className="shrink-0 rounded-small bg-primary-100 px-1.5 py-0.5 text-tiny font-medium text-primary-600">{t('Built in')}</span>
                                                    )}
                                                </div>
                                                <div className="truncate text-tiny text-default-500">{preset.baseURL}</div>
                                                <div className="mt-1 text-tiny text-default-400">{preset.apiKey ? t('API key saved') : t('API key not saved')}</div>
                                            </button>
                                            <div className="flex shrink-0 items-center gap-1">
                                                <Button
                                                    size="sm"
                                                    variant={isCurrent ? 'flat' : 'light'}
                                                    color={isCurrent ? 'primary' : 'default'}
                                                    isLoading={isSwitching}
                                                    isDisabled={isSaving || Boolean(switchingPresetID) || isCurrent}
                                                    onPress={() => switchPreset(preset)}
                                                >
                                                    {isCurrent ? t('Current') : t('Switch')}
                                                </Button>
                                                {!preset.pinned && (
                                                    <Button isIconOnly size="sm" variant="light" color="danger" aria-label={t('Remove')} onPress={() => removePreset(preset.id)}>
                                                        <Icon icon="material-symbols:close-rounded" width={18} />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <Input
                        label={t('Model Name')}
                        labelPlacement="outside"
                        placeholder="anthropic/claude-sonnet-4"
                        value={form.modelName}
                        variant="bordered"
                        isInvalid={Boolean(errors.modelName)}
                        errorMessage={errors.modelName}
                        onValueChange={value => setField('modelName', value)}
                    />
                    <Input
                        label={t('Base URL')}
                        labelPlacement="outside"
                        placeholder="https://api.example.com/v1"
                        value={form.baseURL}
                        variant="bordered"
                        isInvalid={Boolean(errors.baseURL)}
                        errorMessage={errors.baseURL}
                        onValueChange={value => setField('baseURL', value)}
                    />
                    <Input
                        label={t('Model API Key')}
                        labelPlacement="outside"
                        placeholder={storedConfig.apiKeyConfigured ? t('API key already configured') : 'sk-...'}
                        type="password"
                        value={form.apiKey}
                        variant="bordered"
                        isInvalid={Boolean(errors.apiKey)}
                        errorMessage={errors.apiKey}
                        onValueChange={value => setField('apiKey', value)}
                    />
                    <Input
                        label={t('Tavily API Key Optional')}
                        labelPlacement="outside"
                        placeholder={storedConfig.tavilyConfigured ? t('Tavily API key already configured') : 'tvly-...'}
                        type="password"
                        value={form.tavilyAPIKey}
                        variant="bordered"
                        isInvalid={Boolean(errors.tavilyAPIKey)}
                        errorMessage={errors.tavilyAPIKey}
                        onValueChange={value => setField('tavilyAPIKey', value)}
                    />
                </div>

                <div className="flex justify-end">
                    <Button color="primary" isLoading={isSaving} startContent={!isSaving && <Icon icon="material-symbols:save-rounded" />} onPress={save}>
                        {t('Save')}
                    </Button>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-3">
                        <h4 className="text-base font-semibold text-default-foreground">{t('Environment Variables')}</h4>
                        <Button isIconOnly variant="light" aria-label={t('Add Environment Variable')} onPress={addEnvRow}>
                            <Icon icon="material-symbols:add-circle-outline-rounded" width={22} />
                        </Button>
                    </div>

                    <div className="flex flex-col gap-3">
                        {envRows.map(row => (
                            <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px] items-start gap-2">
                                <Input
                                    label={t('Name')}
                                    labelPlacement="outside"
                                    placeholder="GH_TOKEN"
                                    value={row.name}
                                    variant="bordered"
                                    isInvalid={Boolean(envErrors[row.id])}
                                    errorMessage={envErrors[row.id]}
                                    onValueChange={value => setEnvField(row.id, 'name', value)}
                                />
                                <Input
                                    label={t('Value')}
                                    labelPlacement="outside"
                                    placeholder={row.configured ? t('Configured') : 'ghp_...'}
                                    type="password"
                                    value={row.value}
                                    variant="bordered"
                                    onValueChange={value => setEnvField(row.id, 'value', value)}
                                />
                                <Button isIconOnly className="mt-6" variant="light" color="danger" aria-label={t('Remove')} onPress={() => removeEnvRow(row.id)}>
                                    <Icon icon="material-symbols:delete-outline-rounded" width={20} />
                                </Button>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end">
                        <Button color="primary" isLoading={isSavingEnv} startContent={!isSavingEnv && <Icon icon="material-symbols:save-rounded" />} onPress={saveEnvironment}>
                            {t('Save Environment')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
});

HermesProviderSetting.displayName = 'HermesProviderSetting';

export default HermesProviderSetting;

function validateForm(form: HermesProviderForm, apiKeyConfigured: boolean, t: (key: string) => string): HermesProviderFormErrors {
    const errors: HermesProviderFormErrors = {};
    if (!form.modelName.trim()) {
        errors.modelName = t('Model name is required');
    }
    if (!form.baseURL.trim()) {
        errors.baseURL = t('Base URL is required');
    } else if (!isValidHTTPURL(form.baseURL.trim())) {
        errors.baseURL = t('Please enter a valid URL');
    }
    if (!form.apiKey.trim() && !apiKeyConfigured) {
        errors.apiKey = t('Model API key is required');
    }
    return errors;
}

function isValidHTTPURL(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function createEnvironmentRow(variable?: HermesEnvironmentVariable): HermesEnvironmentRow {
    return {
        id: window.crypto?.randomUUID?.() || `env-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: variable?.name || '',
        value: '',
        configured: Boolean(variable?.configured)
    };
}

function normalizeEnvironmentRows(variables: HermesEnvironmentVariable[]): HermesEnvironmentRow[] {
    const rows = variables.map(createEnvironmentRow);
    return rows.length ? rows : [createEnvironmentRow()];
}

function readHermesProviderPresets(): HermesProviderPreset[] {
    try {
        const raw = window.localStorage.getItem(HERMES_PROVIDER_PRESETS_STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .filter(preset => typeof preset?.modelName === 'string' && typeof preset?.baseURL === 'string' && isValidHTTPURL(preset.baseURL))
            .map(preset => ({
                id: typeof preset.id === 'string' && preset.id ? preset.id : createHermesProviderPresetID(preset.modelName, preset.baseURL),
                modelName: preset.modelName.trim(),
                baseURL: preset.baseURL.trim(),
                apiKey: typeof preset.apiKey === 'string' ? preset.apiKey : '',
                tavilyAPIKey: typeof preset.tavilyAPIKey === 'string' ? preset.tavilyAPIKey : '',
                updatedAt: Number(preset.updatedAt) || 0
            }))
            .filter(preset => preset.modelName && preset.baseURL)
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, MAX_HERMES_PROVIDER_PRESETS);
    } catch {
        return [];
    }
}

function saveHermesProviderPresets(presets: HermesProviderPreset[]): HermesProviderPreset[] {
    const nextPresets = presets.slice(0, MAX_HERMES_PROVIDER_PRESETS);
    window.localStorage.setItem(HERMES_PROVIDER_PRESETS_STORAGE_KEY, JSON.stringify(nextPresets));
    return nextPresets;
}

function upsertHermesProviderPreset(presets: HermesProviderPreset[], form: HermesProviderForm): HermesProviderPreset[] {
    const modelName = form.modelName.trim();
    const baseURL = form.baseURL.trim();
    if (!modelName || !baseURL || !isValidHTTPURL(baseURL)) {
        return presets;
    }

    const id = createHermesProviderPresetID(modelName, baseURL);
    const existingPreset = presets.find(preset => preset.id === id || (preset.modelName === modelName && preset.baseURL === baseURL));
    return [
        {
            id,
            modelName,
            baseURL,
            apiKey: form.apiKey.trim() || existingPreset?.apiKey || '',
            tavilyAPIKey: form.tavilyAPIKey.trim() || existingPreset?.tavilyAPIKey || '',
            updatedAt: Date.now()
        },
        ...presets.filter(preset => preset.id !== id && !(preset.modelName === modelName && preset.baseURL === baseURL))
    ].slice(0, MAX_HERMES_PROVIDER_PRESETS);
}

function createQukaLLMGatewayPreset(host: string, apiKey: string): HermesProviderPreset {
    return {
        id: QUKA_LLM_GATEWAY_PRESET_ID,
        modelName: QUKA_LLM_GATEWAY_MODEL,
        baseURL: `${host.trim().replace(/\/+$/, '')}/llm-gateway/v1`,
        apiKey,
        tavilyAPIKey: '',
        updatedAt: Number.MAX_SAFE_INTEGER,
        pinned: true
    };
}

function createHermesProviderPresetID(modelName: string, baseURL: string): string {
    return `${modelName.trim()}::${baseURL.trim()}`;
}

function validateEnvironmentRows(rows: HermesEnvironmentRow[], t: (key: string) => string): Record<string, string> {
    const errors: Record<string, string> = {};
    const seen = new Set<string>();
    rows.forEach(row => {
        const name = row.name.trim();
        if (!name && !row.value.trim()) {
            return;
        }
        if (!isValidEnvironmentVariableName(name)) {
            errors[row.id] = t('Invalid environment variable name');
            return;
        }
        if (isProtectedEnvironmentVariableName(name)) {
            errors[row.id] = t('Environment variable is managed by QukaAI Desktop');
            return;
        }
        if (seen.has(name)) {
            errors[row.id] = t('Duplicate environment variable');
            return;
        }
        seen.add(name);
    });
    return errors;
}

function isValidEnvironmentVariableName(name: string): boolean {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

function isProtectedEnvironmentVariableName(name: string): boolean {
    return (
        [
            'HOME',
            'USERPROFILE',
            'PATH',
            'HERMES_HOME',
            'QUKA_HERMES_HOME',
            'HERMES_KANBAN_HOME',
            'HERMES_PLATFORM',
            'HERMES_SESSION_PLATFORM',
            'HERMES_DASHBOARD_SESSION_TOKEN',
            'HERMES_BUNDLED_PLUGINS',
            'PYINSTALLER_RESET_ENVIRONMENT',
            'QUKA_AI_CONFIG',
            'OPENAI_API_KEY',
            'TAVILY_API_KEY'
        ].includes(name) ||
        name.startsWith('QUKA_') ||
        name.startsWith('_PYI_') ||
        name.startsWith('PYINSTALLER_')
    );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
            reject(new Error('Hermes configuration request timed out'));
        }, timeoutMs);

        promise.then(
            value => {
                window.clearTimeout(timer);
                resolve(value);
            },
            error => {
                window.clearTimeout(timer);
                reject(error);
            }
        );
    });
}
