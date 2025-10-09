import { proxy } from 'valtio';

import userStore from '@/stores/user';
import { CentrifugeManager, type CentrifugeMessage } from '@/lib/centrifuge-manager';

export const CONNECTION_OK = 'ok';
export const CONNECTION_FAIL = 'fail';

const socketStore = proxy<SocketStore>({
    connectionStatus: CONNECTION_FAIL,
    subscribe: undefined
});

// 保持与 FireTowerMsg 兼容的接口
export interface FireTowerMsg {
    topic: string;
    type: number;
    data: {
        subject: string;
        version?: string;
        type: number | string; // 兼容数字和字符串形式
        data: any;
    };
}

var centrifugeManager: CentrifugeManager;
var isBuilding = false; // 防止重复调用

export function closeSocket() {
    centrifugeManager?.disconnect();
    isBuilding = false;
}

export function buildTower(userId: string, appid: string, token: string, tokenType: string, onConnected: () => void) {
    // 防止重复调用
    if (isBuilding) {
        console.log('buildTower already in progress, skipping');
        return;
    }
    
    isBuilding = true;
    const host = userStore.host;
    // 使用 Centrifuge 的标准端点
    let endpoint = host.replace('http://', 'ws://').replace('https://', 'wss://') + '/connect';

    if (!endpoint) {
        console.warn('socket not allowed');
        isBuilding = false;
        return;
    }

    // 初始化 Centrifuge 管理器
    centrifugeManager = new CentrifugeManager();
    
    // 设置日志（与开发环境一致）
    centrifugeManager.setLogging(process.env.NODE_ENV === 'development');

    // 连接 Centrifuge
    centrifugeManager.connect(endpoint, appid, token, tokenType)
        .then(() => {
            // 订阅用户频道
            centrifugeManager.subscribe(['/user/' + userId], (msg) => {
                // 这里可以处理用户级别的消息
                console.log('User message received:', msg);
            });
            
            // 设置订阅函数
            socketStore.subscribe = (topics: string[], callback: (msg: FireTowerMsg) => void): (() => void) => {
                // 将消息从 Centrifuge 格式转换为 FireTower 格式
                const centrifugeCallback = (centrifugeMsg: CentrifugeMessage) => {
                    // 转换消息格式以保持兼容性
                    // 注意：Centrifuge 使用字符串形式的 type，而 FireTower 使用数字形式
                    // 我们需要确保 type 字段与 EventType 枚举值兼容
                    const fireTowerMsg: FireTowerMsg = {
                        topic: '', // Centrifuge 不使用 topic，但 FireTower 需要
                        type: 1, // publishOperation
                        data: {
                            subject: centrifugeMsg.subject,
                            version: centrifugeMsg.version,
                            // 保持 type 为原始值，让使用方处理字符串到数字的转换
                            type: centrifugeMsg.type,
                            data: centrifugeMsg.data
                        }
                    };
                    callback(fireTowerMsg);
                };
                
                // 使用 Centrifuge 管理器订阅
                const unsubscribe = centrifugeManager.subscribe(topics, centrifugeCallback);
                return unsubscribe;
            };
            
            socketStore.connectionStatus = CONNECTION_OK;
            isBuilding = false;
            onConnected();
        })
        .catch((error) => {
            console.error('Centrifuge connection failed:', error);
            socketStore.connectionStatus = CONNECTION_FAIL;
            isBuilding = false;
            
            // // 重连机制
            // setTimeout(() => {
            //     buildTower(userId, appid, token, onConnected);
            // }, 1000);
        });
}

export default socketStore;
