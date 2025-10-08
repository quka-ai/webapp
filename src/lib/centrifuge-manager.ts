import { Centrifuge, type PublicationContext, type Subscription } from 'centrifuge';

export interface CentrifugeMessage {
    subject: string;
    version?: string;
    type: string; // 现在是字符串形式
    data: any;
}

export class CentrifugeManager {
    private centrifuge: Centrifuge | null = null;
    private subscriptions: Map<string, Subscription> = new Map();
    private callbacks: Map<string, Array<(msg: CentrifugeMessage) => void>> = new Map();
    private logging: boolean = false;
    private endpoint: string = '';
    private appid: string = '';
    private tokenType: string = '';
    private token: string = '';
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 1000; // 初始重连延迟（毫秒）
    private maxReconnectDelay: number = 30000; // 最大重连延迟（毫秒）
    private isConnecting: boolean = false;
    private shouldReconnect: boolean = true; // 是否应该重连

    constructor() {}

    logInfo(data: any) {
        if (this.logging) {
            console.log('[CentrifugeManager] INFO', data);
        }
    }

    connect(endpoint: string, appid: string, token: string, tokenType: string): Promise<void> {
        // 防止重复连接
        if (this.isConnecting || this.isConnected()) {
            this.logInfo('Already connecting or connected, skipping connect attempt');
            return Promise.resolve();
        }

        // 保存连接参数用于重连
        this.endpoint = endpoint;
        this.appid = appid;
        this.tokenType = tokenType;
        this.token = token;
        this.isConnecting = true;
        this.shouldReconnect = true; // 重置重连标志

        return new Promise((resolve, reject) => {
            try {
                // 创建 Centrifuge 连接
                this.centrifuge = new Centrifuge(endpoint, {
                    token: token,
                    debug: this.logging,
                    // 配置重连参数
                    minReconnectDelay: this.reconnectDelay,
                    maxReconnectDelay: this.maxReconnectDelay,
                    headers: {
                        'x-appid': appid,
                        'x-auth-type': tokenType
                    }
                });

                this.centrifuge.on('connected', ctx => {
                    this.logInfo('Centrifuge connected');
                    this.reconnectAttempts = 0; // 重置重连计数
                    this.isConnecting = false;
                    resolve();
                });

                this.centrifuge.on('disconnected', ctx => {
                    this.logInfo('Centrifuge disconnected');
                    this.isConnecting = false;
                    // 只有在非主动断开的情况下才触发重连
                    if (this.shouldReconnect) {
                        // 延迟一点时间再处理重连，避免立即重连
                        setTimeout(() => {
                            this.handleDisconnection();
                        }, 100);
                    }
                });

                this.centrifuge.on('error', error => {
                    this.logInfo('Centrifuge error:' + error);
                    this.isConnecting = false;
                    // 不直接 reject，而是尝试重连
                    this.handleDisconnection();
                });

                this.centrifuge.connect();
            } catch (error) {
                this.isConnecting = false;
                reject(error);
            }
        });
    }

    disconnect() {
        this.shouldReconnect = false; // 主动断开连接，不需要重连
        this.isConnecting = false;
        if (this.centrifuge) {
            this.centrifuge.disconnect();
            this.centrifuge = null;
            this.subscriptions.clear();
            this.callbacks.clear();
        }
    }

    private handleDisconnection() {
        // 如果不应该重连（主动断开），直接返回
        if (!this.shouldReconnect) {
            this.logInfo('Connection was manually closed, not reconnecting');
            return;
        }

        // 如果达到最大重连次数，停止重连
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logInfo(`Max reconnect attempts reached (${this.maxReconnectAttempts}), giving up`);
            return;
        }

        // 增加重连计数
        this.reconnectAttempts++;

        // 计算重连延迟（指数退避）
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);

        this.logInfo(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        // 延迟重连
        setTimeout(() => {
            this.logInfo('Reconnecting to Centrifuge...');
            this.reconnect();
        }, delay);
    }

    private reconnect() {
        if (!this.endpoint || !this.appid || !this.token) {
            this.logInfo('Cannot reconnect: missing endpoint, appid or token');
            return;
        }

        // 防止重复重连
        if (this.isConnecting) {
            this.logInfo('Already attempting to reconnect, skipping');
            return;
        }

        // 清理旧的连接（不触发重连）
        if (this.centrifuge) {
            this.shouldReconnect = false; // 临时禁用重连
            this.centrifuge.disconnect();
            this.centrifuge = null;
            this.shouldReconnect = true; // 重新启用重连
        }

        // 重新创建连接
        this.connect(this.endpoint, this.appid, this.token)
            .then(() => {
                this.logInfo('Reconnected successfully');
                // 重新订阅所有频道
                this.resubscribeAll();
            })
            .catch(error => {
                this.logInfo(`Reconnection failed: ${error}`);
                // 继续尝试重连
                this.handleDisconnection();
            });
    }

    private resubscribeAll() {
        // 保存所有回调函数
        const savedCallbacks = new Map(this.callbacks);

        // 清理订阅状态
        this.subscriptions.clear();
        this.callbacks.clear();

        // 重新订阅每个频道和所有回调
        savedCallbacks.forEach((channelCallbacks, channel) => {
            if (channelCallbacks && channelCallbacks.length > 0) {
                // 为每个回调函数重新创建订阅
                channelCallbacks.forEach(callback => {
                    this.subscribe([channel], callback);
                });
            }
        });
    }

    isConnected(): boolean {
        return this.centrifuge !== null;
    }

    subscribe(channels: string[], callback: (msg: CentrifugeMessage) => void): () => void {
        if (!this.centrifuge) {
            throw new Error('Centrifuge not connected');
        }

        const unsubscribeFuncs: Array<() => void> = [];

        for (const channel of channels) {
            let subscription = this.subscriptions.get(channel);

            // 如果订阅不存在，创建新的订阅
            if (!subscription) {
                try {
                    subscription = this.centrifuge.newSubscription(channel);

                    subscription.on('publication', (ctx: PublicationContext) => {
                        this.handleMessage(channel, ctx);
                    });

                    subscription.on('subscribed', () => {
                        this.logInfo(`Subscribed to channel: ${channel}`);
                    });

                    subscription.on('unsubscribed', () => {
                        this.logInfo(`Unsubscribed from channel: ${channel}`);
                        // 清理回调函数
                        this.callbacks.delete(channel);
                    });

                    subscription.on('error', error => {
                        this.logInfo(`Subscription error for channel ${channel}: ${error}`);
                    });

                    subscription.subscribe();
                    this.subscriptions.set(channel, subscription);
                } catch (error: any) {
                    // 如果订阅已存在，尝试从 Centrifuge 获取已存在的订阅
                    if (error?.message && error.message.includes('already exists')) {
                        this.logInfo(`Subscription for channel ${channel} already exists, attempting to reuse existing subscription`);

                        // 尝试从 centrifuge 的内部订阅列表中获取已存在的订阅
                        const existingSubscriptions = (this.centrifuge as any)._subs;
                        if (existingSubscriptions && existingSubscriptions[channel]) {
                            subscription = existingSubscriptions[channel];
                            this.subscriptions.set(channel, subscription);
                            this.logInfo(`Reused existing subscription for channel: ${channel}`);
                        } else {
                            this.logInfo(`Could not find existing subscription for channel: ${channel}, skipping`);
                            continue;
                        }
                    } else {
                        throw error;
                    }
                }
            }

            // 注册回调函数
            let channelCallbacks = this.callbacks.get(channel);
            if (!channelCallbacks) {
                channelCallbacks = [];
                this.callbacks.set(channel, channelCallbacks);
            }

            channelCallbacks.push(callback);
            unsubscribeFuncs.push(() => {
                const index = channelCallbacks!.indexOf(callback);
                if (index > -1) {
                    channelCallbacks!.splice(index, 1);
                }
                // 如果没有回调函数了，取消订阅
                if (channelCallbacks!.length === 0) {
                    const sub = this.subscriptions.get(channel);
                    if (sub) {
                        sub.unsubscribe();
                        this.subscriptions.delete(channel);
                    }
                }
            });
        }

        // 返回取消订阅函数
        return () => {
            unsubscribeFuncs.forEach(unsub => unsub());
        };
    }

    private handleMessage(channel: string, ctx: PublicationContext) {
        try {
            const message: CentrifugeMessage = ctx.data as CentrifugeMessage;
            this.logInfo(`Received message on channel ${channel}: ${message}`);

            const callbacks = this.callbacks.get(channel);
            if (callbacks) {
                callbacks.forEach(callback => {
                    try {
                        callback(message);
                    } catch (error) {
                        console.error('Error in centrifuge message callback:', error);
                    }
                });
            }
        } catch (error) {
            console.error('Error handling centrifuge message:', error);
        }
    }

    // 获取连接状态
    getConnectionStatus(): string {
        if (!this.centrifuge) {
            return 'disconnected';
        }

        // Centrifuge 状态映射
        const state = this.centrifuge.state;
        if (state === 'disconnected') return 'disconnected';
        if (state === 'connecting') return 'connecting';
        if (state === 'connected') return 'connected';
        return 'unknown';
    }

    // 设置日志级别
    setLogging(enabled: boolean) {
        this.logging = enabled;
        if (this.centrifuge) {
            // 注意：运行时无法更改 debug 设置，需要重新连接
        }
    }

    // 重置重连计数
    resetReconnectAttempts() {
        this.reconnectAttempts = 0;
    }

    // 设置最大重连次数
    setMaxReconnectAttempts(max: number) {
        this.maxReconnectAttempts = max;
    }

    // 停止重连
    stopReconnecting() {
        this.shouldReconnect = false;
        this.reconnectAttempts = this.maxReconnectAttempts;
    }
}
