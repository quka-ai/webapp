import { Button, Input } from '@heroui/react';
import { Icon } from '@iconify/react';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
    ConfigureHermesEnvironment,
    ConfigureHermesProvider,
    GetHermesEnvironmentVariables,
    GetHermesProviderConfig,
    type HermesEnvironmentVariable,
    readHermesProviderConfig,
    SubscribeHermesAgentStatus
} from '@/apis/hermes-desktop';

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

const DEFAULT_FORM: HermesProviderForm = {
    modelName: '',
    baseURL: '',
    apiKey: '',
    tavilyAPIKey: ''
};

const HermesProviderSetting = React.forwardRef<HTMLDivElement, HermesProviderSettingProps>(({ className, onConfigured, title, description, ...props }, ref) => {
    const { t } = useTranslation();
    const [storedConfig, setStoredConfig] = React.useState(() => readHermesProviderConfig());
    const [form, setForm] = React.useState<HermesProviderForm>(() => ({
        ...DEFAULT_FORM,
        modelName: storedConfig.modelName,
        baseURL: storedConfig.baseURL
    }));
    const [envRows, setEnvRows] = React.useState<HermesEnvironmentRow[]>(() => [createEnvironmentRow()]);
    const [envErrors, setEnvErrors] = React.useState<Record<string, string>>({});
    const [errors, setErrors] = React.useState<HermesProviderFormErrors>({});
    const [isSaving, setIsSaving] = React.useState(false);
    const [isSavingEnv, setIsSavingEnv] = React.useState(false);

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

    const save = React.useCallback(async () => {
        const nextErrors = validateForm(form, storedConfig.apiKeyConfigured, t);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
            return;
        }

        setIsSaving(true);
        try {
            console.info('[hermes] saving provider configuration', {
                modelName: form.modelName.trim(),
                baseURL: form.baseURL.trim(),
                apiKeyPresent: Boolean(form.apiKey.trim()),
                tavilyKeyPresent: Boolean(form.tavilyAPIKey.trim())
            });
            await withTimeout(
                ConfigureHermesProvider({
                    modelName: form.modelName.trim(),
                    baseURL: form.baseURL.trim(),
                    apiKey: form.apiKey.trim(),
                    tavilyAPIKey: form.tavilyAPIKey.trim()
                }),
                15000
            );
            console.info('[hermes] provider configuration saved; bridge will start in background');
            toast.success(t('Hermes configuration saved'));
            setStoredConfig(prev => ({
                modelName: form.modelName.trim(),
                baseURL: form.baseURL.trim(),
                apiKeyConfigured: Boolean(form.apiKey.trim()) || prev.apiKeyConfigured,
                tavilyConfigured: Boolean(form.tavilyAPIKey.trim()) || Boolean(prev.tavilyConfigured)
            }));
            setForm(prev => ({ ...prev, apiKey: '', tavilyAPIKey: '' }));
            onConfigured?.();
        } catch (error: any) {
            console.error(error);
            toast.error(error?.message || t('Failed'));
        } finally {
            setIsSaving(false);
        }
    }, [form, onConfigured, storedConfig.apiKeyConfigured, t]);

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
                        <Button color="primary" variant="flat" isLoading={isSavingEnv} startContent={!isSavingEnv && <Icon icon="material-symbols:save-rounded" />} onPress={saveEnvironment}>
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
