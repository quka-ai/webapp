import type { ChatMessageExt, ChatMessageList, ChatSessionList, SendMessageArgs, SendMessageResponse } from './chat';

import userStore from '@/stores/user';
import { EventType, MessageType, StreamMessage } from '@/types/chat';

const HERMES_EVENT_NAME = 'hermes-agent:event';
const HERMES_STATUS_EVENT_NAME = 'hermes-agent:status';
const HERMES_INTERACTION_EVENT_NAME = 'hermes-agent:interaction';

interface WailsAppBridge {
    ConfigureHermesAgent: (req: HermesConfigureRequest) => Promise<HermesStatus>;
    ConfigureHermesProvider: (req: HermesProviderConfigureRequest) => Promise<HermesStatus>;
    GetHermesAgentStatus?: () => Promise<HermesStatus> | HermesStatus;
    GetHermesRuntimeDiagnostics?: () => Promise<Record<string, unknown>> | Record<string, unknown>;
    HasHermesProviderConfigured?: () => Promise<boolean> | boolean;
    GetHermesProviderConfig?: () => Promise<HermesProviderStoredConfig> | HermesProviderStoredConfig;
    GetHermesEnvironmentVariables?: () => Promise<HermesEnvironmentVariable[]> | HermesEnvironmentVariable[];
    ConfigureHermesEnvironment?: (req: HermesEnvironmentConfigureRequest) => Promise<HermesEnvironmentVariable[]> | HermesEnvironmentVariable[];
    ListHermesSkills?: () => Promise<HermesSkillList> | HermesSkillList;
    ViewHermesSkill?: (req: HermesSkillViewRequest) => Promise<HermesSkillContent> | HermesSkillContent;
    ReloadHermesSkills?: () => Promise<HermesSkillList> | HermesSkillList;
    InstallHermesSkill?: (req: HermesSkillInstallRequest) => Promise<HermesSkillList> | HermesSkillList;
    DeleteHermesSkill?: (req: HermesSkillDeleteRequest) => Promise<HermesSkillList> | HermesSkillList;
    ListHermesAgents?: () => Promise<HermesAgentProfileList> | HermesAgentProfileList;
    SaveHermesAgent?: (req: HermesAgentProfileSaveRequest) => Promise<HermesAgentProfileList> | HermesAgentProfileList;
    DeleteHermesAgent?: (req: HermesAgentProfileDeleteRequest) => Promise<HermesAgentProfileList> | HermesAgentProfileList;
    RunHermesAgentTest?: (req: HermesAgentRunTestRequest) => Promise<HermesAgentRunTestResult> | HermesAgentRunTestResult;
    ResolveHermesInteraction?: (req: HermesInteractionResolveRequest) => Promise<void>;
    CreateHermesSession: (spaceID: string) => Promise<string>;
    ListHermesSessions: (spaceID: string, page: number, pageSize: number) => Promise<ChatSessionList>;
    GetHermesSessionHistory: (spaceID: string, sessionID: string, page: number, pageSize: number) => Promise<ChatMessageList>;
    SendHermesMessage: (req: HermesSendMessageRequest) => Promise<SendMessageResponse>;
    StopHermesSession: (sessionID: string) => Promise<void>;
    RenameHermesSession: (spaceID: string, sessionID: string, firstMessage: string) => Promise<{ session_id: string; name: string }>;
    DeleteHermesSession: (spaceID: string, sessionID: string) => Promise<void>;
}

interface WailsRuntimeBridge {
    EventsOn?: (eventName: string, callback: (payload: unknown) => void) => (() => void) | void;
}

interface HermesConfigureRequest {
    host: string;
    accessToken: string;
    apiBaseURL: string;
    authToken: string;
    tokenType: 'access' | 'authorization';
    spaceID: string;
    resource: string;
}

export interface HermesProviderConfigureRequest {
    modelName: string;
    baseURL: string;
    apiKey: string;
    tavilyAPIKey: string;
}

export interface HermesProviderStoredConfig {
    modelName: string;
    baseURL: string;
    apiKeyConfigured: boolean;
    tavilyConfigured?: boolean;
}

export interface HermesEnvironmentVariable {
    name: string;
    value?: string;
    configured?: boolean;
}

export interface HermesEnvironmentConfigureRequest {
    variables: HermesEnvironmentVariable[];
}

export interface HermesSkillInfo {
    name: string;
    description: string;
    source: 'user' | 'built-in' | string;
    path: string;
    builtIn: boolean;
}

export interface HermesSkillList {
    skills: HermesSkillInfo[];
    userSkillsDir: string;
    builtInRootDir: string;
}

export interface HermesSkillViewRequest {
    name: string;
    source?: string;
}

export interface HermesSkillInstallRequest {
    sourcePath: string;
}

export interface HermesSkillDeleteRequest {
    name: string;
    source?: string;
    path?: string;
}

export interface HermesSkillContent {
    info: HermesSkillInfo;
    content: string;
}

export interface HermesAgentProfile {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
    toolPolicy: 'no_tools' | 'read_only' | 'restricted' | 'workspace_write' | string;
    enabledToolsets: string[];
    enabledSkills: string[];
    contextPolicy: 'minimal' | 'focused' | 'summary' | string;
    builtIn?: boolean;
    createdAt?: number;
    updatedAt?: number;
}

export interface HermesAgentProfileList {
    profiles: HermesAgentProfile[];
    profilesPath: string;
}

export interface HermesAgentProfileSaveRequest {
    profile: HermesAgentProfile;
}

export interface HermesAgentProfileDeleteRequest {
    id: string;
}

export interface HermesAgentRunNodeRequest {
    nodeID: string;
    agentID: string;
    task: string;
    expectedOutput?: string;
    dependsOn?: string[];
    toolPolicy?: string;
    toolsets?: string[];
    context?: Record<string, unknown>;
}

export interface HermesAgentRunTestRequest {
    parentSessionID?: string;
    userRequest: string;
    coordinatorIntent?: string;
    strategy?: 'parallel' | 'dag' | string;
    maxParallelism?: number;
    nodes: HermesAgentRunNodeRequest[];
    fake?: boolean;
    ensureBridge?: boolean;
}

export interface HermesAgentRunTestResult {
    ok: boolean;
    run_id: string;
    parent_session_id: string;
    status: string;
    strategy: string;
    started_at?: string;
    completed_at?: string;
    trace_dir: string;
    nodes: Array<Record<string, unknown>>;
    error?: string;
}

export interface HermesStatus {
    ready: boolean;
    baseURL: string;
    mode: string;
}

interface HermesSendMessageRequest {
    spaceID: string;
    sessionID: string;
    messageID: string;
    message: string;
}

export interface HermesRuntimeEvent {
    type: EventType;
    data: StreamMessage & {
        sequence?: number;
        space_id?: string;
    };
}

export interface HermesStatusEvent {
    ready?: boolean;
    baseURL?: string;
    mode?: string;
    error?: string;
}

export interface HermesInteractionRequest {
    request_id: string;
    kind: 'approval' | 'sudo_password' | string;
    session_id?: string;
    title?: string;
    message?: string;
    command?: string;
    description?: string;
    explanation?: string;
    pattern_key?: string;
    pattern_keys?: string[];
    allow_permanent?: boolean;
    sensitive?: boolean;
    timeout_seconds?: number;
}

export interface HermesInteractionResolveRequest {
    request_id: string;
    action: 'approve_once' | 'approve_session' | 'approve_always' | 'deny' | 'submit' | 'cancel';
    value?: string;
}

interface ExtendedWindow extends Window {
    go?: {
        main?: {
            App?: WailsAppBridge;
        };
    };
    runtime?: WailsRuntimeBridge;
}

let configuredKey = '';
let configurePromise: Promise<void> | null = null;
const HERMES_PROVIDER_FORM_KEY = 'quka:desktop:hermes-provider';

function appBridge(): WailsAppBridge | undefined {
    return (window as ExtendedWindow).go?.main?.App;
}

export function isHermesDesktopAvailable(): boolean {
    return typeof window !== 'undefined' && Boolean(appBridge()?.ConfigureHermesAgent);
}

export async function ConfigureHermesProvider(req: HermesProviderConfigureRequest): Promise<HermesStatus> {
    const bridge = appBridge();
    if (!bridge?.ConfigureHermesProvider) {
        throw new Error('Hermes desktop bridge is not available');
    }
    console.info('[hermes] invoking Wails ConfigureHermesProvider');
    const status = await bridge.ConfigureHermesProvider(req);
    console.info('[hermes] Wails ConfigureHermesProvider returned', status);
    const previous = readHermesProviderConfig();
    const nextConfig = {
        modelName: req.modelName,
        baseURL: req.baseURL,
        apiKeyConfigured: Boolean(req.apiKey.trim()) || previous.apiKeyConfigured,
        tavilyConfigured: Boolean(req.tavilyAPIKey.trim()) || Boolean(previous.tavilyConfigured)
    };
    storeHermesProviderConfig(nextConfig);
    return status;
}

export async function HasHermesProviderConfigured(): Promise<boolean> {
    const localConfigured = isHermesProviderConfiguredLocally();
    const bridge = appBridge();

    if (!bridge?.HasHermesProviderConfigured) {
        return localConfigured;
    }

    try {
        return Boolean(await bridge.HasHermesProviderConfigured());
    } catch (error) {
        console.warn('[hermes] failed to check provider configuration', error);
        return false;
    }
}

export async function GetHermesProviderConfig(): Promise<HermesProviderStoredConfig> {
    const localConfig = readHermesProviderConfig();
    const bridge = appBridge();

    if (!bridge?.GetHermesProviderConfig) {
        return localConfig;
    }

    try {
        const config = normalizeHermesProviderConfig(await bridge.GetHermesProviderConfig());
        storeHermesProviderConfig(config);
        return config;
    } catch (error) {
        console.warn('[hermes] failed to read provider configuration', error);
        return localConfig;
    }
}

export async function GetHermesAgentStatus(): Promise<HermesStatus> {
    const bridge = appBridge();
    if (!bridge?.GetHermesAgentStatus) {
        return { ready: false, baseURL: '', mode: 'unavailable' };
    }
    return bridge.GetHermesAgentStatus();
}

export async function GetHermesRuntimeDiagnostics(): Promise<Record<string, unknown>> {
    const bridge = appBridge();
    if (!bridge?.GetHermesRuntimeDiagnostics) {
        return {};
    }
    return bridge.GetHermesRuntimeDiagnostics();
}

export async function GetHermesEnvironmentVariables(): Promise<HermesEnvironmentVariable[]> {
    const bridge = appBridge();
    if (!bridge?.GetHermesEnvironmentVariables) {
        return [];
    }
    const variables = await bridge.GetHermesEnvironmentVariables();
    return Array.isArray(variables) ? variables : [];
}

export async function ConfigureHermesEnvironment(req: HermesEnvironmentConfigureRequest): Promise<HermesEnvironmentVariable[]> {
    const bridge = appBridge();
    if (!bridge?.ConfigureHermesEnvironment) {
        throw new Error('Hermes desktop bridge is not available');
    }
    const variables = await bridge.ConfigureHermesEnvironment(req);
    return Array.isArray(variables) ? variables : [];
}

export async function ListHermesSkills(): Promise<HermesSkillList> {
    const bridge = appBridge();
    if (!bridge?.ListHermesSkills) {
        return { skills: [], userSkillsDir: '', builtInRootDir: '' };
    }
    const list = await bridge.ListHermesSkills();
    return {
        skills: Array.isArray(list?.skills) ? list.skills : [],
        userSkillsDir: list?.userSkillsDir || '',
        builtInRootDir: list?.builtInRootDir || ''
    };
}

export async function ViewHermesSkill(req: HermesSkillViewRequest): Promise<HermesSkillContent> {
    const bridge = appBridge();
    if (!bridge?.ViewHermesSkill) {
        throw new Error('Hermes desktop bridge is not available');
    }
    return bridge.ViewHermesSkill(req);
}

export async function ReloadHermesSkills(): Promise<HermesSkillList> {
    const bridge = appBridge();
    if (!bridge?.ReloadHermesSkills) {
        return ListHermesSkills();
    }
    const list = await bridge.ReloadHermesSkills();
    return {
        skills: Array.isArray(list?.skills) ? list.skills : [],
        userSkillsDir: list?.userSkillsDir || '',
        builtInRootDir: list?.builtInRootDir || ''
    };
}

export async function InstallHermesSkill(req: HermesSkillInstallRequest): Promise<HermesSkillList> {
    const bridge = appBridge();
    if (!bridge?.InstallHermesSkill) {
        throw new Error('Hermes desktop bridge is not available');
    }
    const list = await bridge.InstallHermesSkill(req);
    return {
        skills: Array.isArray(list?.skills) ? list.skills : [],
        userSkillsDir: list?.userSkillsDir || '',
        builtInRootDir: list?.builtInRootDir || ''
    };
}

export async function DeleteHermesSkill(req: HermesSkillDeleteRequest): Promise<HermesSkillList> {
    const bridge = appBridge();
    if (!bridge?.DeleteHermesSkill) {
        throw new Error('Hermes desktop bridge is not available');
    }
    const list = await bridge.DeleteHermesSkill(req);
    return {
        skills: Array.isArray(list?.skills) ? list.skills : [],
        userSkillsDir: list?.userSkillsDir || '',
        builtInRootDir: list?.builtInRootDir || ''
    };
}

export async function ListHermesAgents(): Promise<HermesAgentProfileList> {
    const bridge = appBridge();
    if (!bridge?.ListHermesAgents) {
        return { profiles: [], profilesPath: '' };
    }
    const list = await bridge.ListHermesAgents();
    return normalizeHermesAgentProfileList(list);
}

export async function SaveHermesAgent(req: HermesAgentProfileSaveRequest): Promise<HermesAgentProfileList> {
    const bridge = appBridge();
    if (!bridge?.SaveHermesAgent) {
        throw new Error('Hermes desktop bridge is not available');
    }
    return normalizeHermesAgentProfileList(await bridge.SaveHermesAgent(req));
}

export async function DeleteHermesAgent(req: HermesAgentProfileDeleteRequest): Promise<HermesAgentProfileList> {
    const bridge = appBridge();
    if (!bridge?.DeleteHermesAgent) {
        throw new Error('Hermes desktop bridge is not available');
    }
    return normalizeHermesAgentProfileList(await bridge.DeleteHermesAgent(req));
}

export async function RunHermesAgentTest(req: HermesAgentRunTestRequest): Promise<HermesAgentRunTestResult> {
    const bridge = appBridge();
    if (!bridge?.RunHermesAgentTest) {
        throw new Error('Hermes desktop bridge is not available');
    }
    return bridge.RunHermesAgentTest(req);
}

export function readHermesProviderConfig(): HermesProviderStoredConfig {
    if (typeof window === 'undefined') {
        return {
            modelName: '',
            baseURL: '',
            apiKeyConfigured: false,
            tavilyConfigured: false
        };
    }

    try {
        const raw = window.localStorage.getItem(HERMES_PROVIDER_FORM_KEY);
        if (!raw) {
            return {
                modelName: '',
                baseURL: '',
                apiKeyConfigured: false,
                tavilyConfigured: false
            };
        }
        const parsed = JSON.parse(raw) as Partial<HermesProviderStoredConfig>;
        return {
            modelName: parsed.modelName || '',
            baseURL: parsed.baseURL || '',
            apiKeyConfigured: Boolean(parsed.apiKeyConfigured),
            tavilyConfigured: Boolean(parsed.tavilyConfigured)
        };
    } catch {
        return {
            modelName: '',
            baseURL: '',
            apiKeyConfigured: false,
            tavilyConfigured: false
        };
    }
}

export function isHermesProviderConfiguredLocally(): boolean {
    const config = readHermesProviderConfig();
    return Boolean(config.modelName.trim() && config.baseURL.trim() && config.apiKeyConfigured);
}

export function storeHermesProviderConfig(config: HermesProviderStoredConfig) {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.setItem(
        HERMES_PROVIDER_FORM_KEY,
        JSON.stringify({
            modelName: config.modelName.trim(),
            baseURL: config.baseURL.trim(),
            apiKeyConfigured: config.apiKeyConfigured,
            tavilyConfigured: Boolean(config.tavilyConfigured)
        })
    );
}

function normalizeHermesProviderConfig(config: Partial<HermesProviderStoredConfig> | null | undefined): HermesProviderStoredConfig {
    return {
        modelName: config?.modelName || '',
        baseURL: config?.baseURL || '',
        apiKeyConfigured: Boolean(config?.apiKeyConfigured),
        tavilyConfigured: Boolean(config?.tavilyConfigured)
    };
}

function normalizeHermesAgentProfileList(list: Partial<HermesAgentProfileList> | null | undefined): HermesAgentProfileList {
    return {
        profiles: Array.isArray(list?.profiles)
            ? list!.profiles.map(profile => ({
                  id: profile.id || '',
                  name: profile.name || profile.id || '',
                  description: profile.description || '',
                  systemPrompt: profile.systemPrompt || '',
                  toolPolicy: profile.toolPolicy || 'read_only',
                  enabledToolsets: Array.isArray(profile.enabledToolsets) ? profile.enabledToolsets : [],
                  enabledSkills: Array.isArray(profile.enabledSkills) ? profile.enabledSkills : [],
                  contextPolicy: profile.contextPolicy || 'focused',
                  builtIn: Boolean(profile.builtIn),
                  createdAt: profile.createdAt,
                  updatedAt: profile.updatedAt
              }))
            : [],
        profilesPath: list?.profilesPath || ''
    };
}

export function SubscribeHermesAgentStatus(callback: (event: HermesStatusEvent) => void): () => void {
    const runtime = (window as ExtendedWindow).runtime;

    if (!runtime?.EventsOn) {
        return () => {};
    }

    const unlisten = runtime.EventsOn(HERMES_STATUS_EVENT_NAME, event => {
        callback(event as HermesStatusEvent);
    });

    return typeof unlisten === 'function' ? unlisten : () => {};
}

export function SubscribeHermesInteraction(callback: (event: HermesInteractionRequest) => void): () => void {
    const runtime = (window as ExtendedWindow).runtime;

    if (!runtime?.EventsOn) {
        return () => {};
    }

    const unlisten = runtime.EventsOn(HERMES_INTERACTION_EVENT_NAME, event => {
        callback(event as HermesInteractionRequest);
    });

    return typeof unlisten === 'function' ? unlisten : () => {};
}

export async function ResolveHermesInteraction(req: HermesInteractionResolveRequest): Promise<void> {
    const bridge = appBridge();
    if (!bridge?.ResolveHermesInteraction) {
        throw new Error('Hermes desktop bridge is not available');
    }
    await bridge.ResolveHermesInteraction(req);
}

function resolveHermesAuth(): { accessToken: string; authToken: string; tokenType: 'access' | 'authorization'; token: string } {
    if (userStore.accessToken) {
        return {
            accessToken: userStore.accessToken,
            authToken: '',
            tokenType: 'access',
            token: userStore.accessToken
        };
    }

    if (userStore.loginToken) {
        return {
            accessToken: '',
            authToken: userStore.loginToken,
            tokenType: 'authorization',
            token: userStore.loginToken
        };
    }

    throw new Error('QukaAI login token is required for Hermes Agent');
}

export async function ensureHermesAgentConfigured(spaceID: string): Promise<void> {
    const bridge = appBridge();

    if (!bridge || !spaceID) {
        return;
    }

    const auth = resolveHermesAuth();
    const apiBaseURL = userStore.host;
    const key = [apiBaseURL, auth.tokenType, auth.token, spaceID].join('|');

    if (configuredKey === key) {
        return;
    }

    if (configurePromise) {
        await configurePromise;
        if (configuredKey === key) {
            return;
        }
    }

    configurePromise = bridge
        .ConfigureHermesAgent({
            host: apiBaseURL,
            accessToken: auth.accessToken,
            apiBaseURL,
            authToken: auth.authToken,
            tokenType: auth.tokenType,
            spaceID,
            resource: 'knowledge'
        })
        .then(() => {
            configuredKey = key;
        })
        .finally(() => {
            configurePromise = null;
        });

    await configurePromise;
}

export async function CreateHermesChatSession(spaceID: string): Promise<string> {
    await ensureHermesAgentConfigured(spaceID);
    const sessionID = await appBridge()!.CreateHermesSession(spaceID);
    return sessionID;
}

export async function GetHermesChatSessionList(spaceID: string, page: number, pageSize: number): Promise<ChatSessionList> {
    await ensureHermesAgentConfigured(spaceID);
    return appBridge()!.ListHermesSessions(spaceID, page, pageSize);
}

export async function GetHermesChatSessionHistory(spaceID: string, sessionID: string, page: number, pageSize: number): Promise<ChatMessageList> {
    await ensureHermesAgentConfigured(spaceID);
    return appBridge()!.GetHermesSessionHistory(spaceID, sessionID, page, pageSize);
}

export function GenHermesChatMessageID(): string {
    if (window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }
    return `hermes-user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function SendHermesChatMessage(spaceID: string, sessionID: string, args: SendMessageArgs): Promise<SendMessageResponse> {
    console.info('[hermes] SendHermesChatMessage called', {
        spaceID,
        sessionID,
        messageID: args.messageID,
        messageLength: args.message.length
    });
    await ensureHermesAgentConfigured(spaceID);
    const resp = await appBridge()!.SendHermesMessage({
        spaceID,
        sessionID,
        messageID: args.messageID,
        message: args.message
    });
    console.info('[hermes] SendHermesChatMessage returned', resp);
    return resp;
}

export async function StopHermesChatStream(_spaceID: string, sessionID: string): Promise<void> {
    await appBridge()!.StopHermesSession(sessionID);
}

export async function NamedHermesChatSession(spaceID: string, sessionID: string, firstMessage: string): Promise<{ session_id: string; name: string }> {
    await ensureHermesAgentConfigured(spaceID);
    return appBridge()!.RenameHermesSession(spaceID, sessionID, firstMessage);
}

export async function DeleteHermesChatSession(spaceID: string, sessionID: string): Promise<void> {
    await appBridge()!.DeleteHermesSession(spaceID, sessionID);
}

export async function GetHermesMessageExt(): Promise<ChatMessageExt> {
    return {
        rel_docs: [],
        tool_name: '',
        tool_args: ''
    };
}

export function SubscribeHermesChatStreamEvent(
    spaceID: string,
    sessionID: string,
    callback: (eventType: EventType, data: StreamMessage & { sequence?: number; space_id?: string }) => void
): () => void {
    const runtime = (window as ExtendedWindow).runtime;

    if (!runtime?.EventsOn) {
        console.warn('[hermes] runtime.EventsOn unavailable; cannot subscribe chat stream');
        return () => {};
    }

    console.info('[hermes] subscribing chat stream', { spaceID, sessionID });
    const unlisten = runtime.EventsOn(HERMES_EVENT_NAME, rawEvent => {
        const event = rawEvent as HermesRuntimeEvent;
        if (!event?.data || event.data.session_id !== sessionID) {
            return;
        }

        if (event.data.space_id && event.data.space_id !== spaceID) {
            return;
        }

        console.info('[hermes] chat stream event', {
            type: event.type,
            sessionID: event.data.session_id,
            messageID: event.data.message_id,
            messageLength: event.data.message?.length || 0,
            msgType: event.data.msg_type,
            agentRun: event.data.agent_run
        });
        callback(event.type, {
            ...event.data,
            msg_type: event.data.msg_type || (event.data.agent_run ? MessageType.MESSAGE_TYPE_AGENT_RUN : event.data.tool_tips ? MessageType.MESSAGE_TYPE_TOOL_TIPS : MessageType.MESSAGE_TYPE_TEXT)
        });
    });

    return typeof unlisten === 'function' ? unlisten : () => {};
}
