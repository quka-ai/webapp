export enum EventType {
    EVENT_UNKNOWN = 0,
    EVENT_ASSISTANT_INIT = 1,
    /** EVENT_ASSISTANT_CONTINUE - match StreamMessage */
    EVENT_ASSISTANT_CONTINUE = 2,
    EVENT_ASSISTANT_DONE = 3,
    EVENT_ASSISTANT_FAILED = 4,
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
    MESSAGE_TYPE_TOOL_TIPS = 2
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
}

// ToolTips 接口 - 对应Go中的ToolTips结构体
export interface ToolTips {
    id: string;
    tool_name: string;
    status: ToolStatus;
    content: string;
}
