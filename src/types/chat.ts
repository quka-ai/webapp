export enum EventType {
    EVENT_UNKNOWN = 0,
    EVENT_ASSISTANT_INIT = 1,
    /** EVENT_ASSISTANT_CONTINUE - match StreamMessage */
    EVENT_ASSISTANT_CONTINUE = 2,
    EVENT_ASSISTANT_DONE = 3,
    EVENT_ASSISTANT_FAILED = 4,
    EVENT_TOOL_INIT = 5,
    EVENT_TOOL_CONTINUE = 6,
    EVENT_TOOL_DONE = 7,
    EVENT_TOOL_FAILED = 8,
    EVENT_TURN_START = 9,
    EVENT_TURN_DONE = 10,
    EVENT_AGENT_INIT = 11,
    EVENT_AGENT_DONE = 12,
    EVENT_AGENT_FAILED = 13,
    EVENT_AGENT_UPDATE = 14,
    /** EVENT_MESSAGE_PUBLISH - match MessageDetail */
    EVENT_MESSAGE_PUBLISH = 100,
    /** EVENT_MESSAGE_ACK - match SendMessageReply */
    EVENT_MESSAGE_ACK = 101,
    EVENT_SYSTEM_ONSUBSCRIBE = 300,
    UNRECOGNIZED = -1
}

// MessageType 枚举 - 对应Go中的MessageType
export enum MessageType {
    MESSAGE_TYPE_UNKNOWN = 0,
    MESSAGE_TYPE_TEXT = 1,
    MESSAGE_TYPE_TOOL_TIPS = 2,
    MESSAGE_TYPE_AGENT_RUN = 3
}

// ToolStatus 枚举 - 对应Go中的ToolTips状态
export enum ToolStatus {
    TOOL_STATUS_NONE = 0,
    TOOL_STATUS_RUNNING = 1,
    TOOL_STATUS_SUCCESS = 2,
    TOOL_STATUS_FAILED = 3
}

// StreamMessage 接口 - 对应Go中的StreamMessage结构体
export interface StreamMessage {
    message_id: string;
    session_id: string;
    message?: string;
    tool_tips?: ToolTips; // 对应json.RawMessage
    start_at: number;
    complete: number;
    msg_type: MessageType;
    agent_run?: AgentRun;
}

export interface AgentRun {
    run_id?: string;
    node_id?: string;
    agent_id?: string;
    title?: string;
    status?: string;
    task?: string;
    expected_output?: string;
    summary?: string;
    result?: string;
    error?: string;
    warning?: string;
    events?: AgentRunEvent[];
    messages?: AgentRunMessage[];
    trace_path?: string;
    trace_dir?: string;
    tool_policy?: string;
    started_at?: string;
    completed_at?: string;
    [key: string]: unknown;
}

export interface AgentRunEvent {
    type?: string;
    text?: string;
    time?: string;
    name?: string;
    id?: string;
    message?: string;
    arguments?: unknown;
    arguments_text?: string;
    result?: unknown;
    result_text?: string;
    [key: string]: unknown;
}

export interface AgentRunMessage {
    role?: string;
    content?: string;
    name?: string;
    tool_name?: string;
    tool_call_id?: string;
    tool_calls?: unknown[];
    finish_reason?: string;
    [key: string]: unknown;
}

// ToolTips 接口 - 对应Go中的ToolTips结构体
export interface ToolTips {
    id: string;
    tool_name: string;
    status: ToolStatus;
    content: string;
    arguments?: unknown;
    arguments_text?: string;
    result?: unknown;
    result_text?: string;
}
