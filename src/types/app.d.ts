declare type Resource = {
    id: string;
    title: string;
    cycle: number;
    tag: string;
    space_id: string;
    description: string;
};

declare type Session = {
    key: string;
    title: string;
    space_id: string;
};

declare type SessionNamedEvent = {
    sessionID: string;
    name: string;
};

declare type SessionStore = {
    currentSelectedSession: Session | undefined;
    sessionNamedEvent: SessionNamedEvent | undefined;
    sessionReload: string;
};

declare type ResourceStore = {
    currentSelectedResource: Resource | undefined;
    currentSpaceResources: Resource[] | undefined;
    onResourceUpdate: boolean;
    resourceTags: string[];
};

type callbackFunc = (msg: FireTowerMsg) => void;
type subscribeFunc = (topics: string[], callback: callbackFunc) => () => void;

declare type SocketStore = {
    connectionStatus: string;
    subscribe: subscribeFunc | undefined;
};

declare type UserSpace = {
    space_id: string;
    user_id: string;
    role: string;
    title: string;
    description: string;
    base_prompt: string;
    chat_prompt: string;
    created_at: number;
};

declare type SpaceStore = {
    spaces: UserSpace[];
    currentSelectedSpace: string;
    spaceRole: string;
};

declare type UserInfo = {
    userID: string;
    userName: string;
    email: string;
    avatar: string;
    planID: string;
    serviceMode: string;
};

declare type UserStore = {
    accessToken: string | null;
    loginToken: string | null;
    userInfo: UserInfo;
    host: string;
};

declare type TaskInfo = {
    id: string;
    title: string;
    description: string;
    status: string;
};

declare type EventStore = {
    themeChange: string;
    taskModify: TaskInfo;
};

declare type KnowledgeStore = {
    searchKeywords: string;
    onKnowledgeSearch: string;
};

declare type Size = 'sm' | 'md' | 'lg' | 'xs' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full' | undefined;

declare type Attach = {
    type: string;
    url: string;
};
