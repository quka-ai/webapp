import { proxy } from 'valtio';

import { FireTower, type FireTowerMsg } from '@/lib/firetower';
import userStore from '@/stores/user';

export const CONNECTION_OK = 'ok';
export const CONNECTION_FAIL = 'fail';

const socketStore = proxy<SocketStore>({
    connectionStatus: CONNECTION_FAIL,
    subscribe: undefined
});

var tower: FireTower;

type CallBackFunc = Map<string, (msg: FireTowerMsg) => void>;

export function closeSocket() {
    tower?.ws.close(3000);
}

export function buildTower(userId: string, token: string, onConnected: () => void) {
    const host = userStore.host;
    let endpoint = host + '/connect?token=' + token;

    endpoint = endpoint.replace('http://', 'ws://');
    endpoint = endpoint.replace('https://', 'wss://');

    if (!endpoint) {
        console.warn('socket not allowed');

        return;
    }

    const callbacks = new Map<string, CallBackFunc>();

    tower = new FireTower(
        endpoint,
        () => {
            tower.onmessage = event => {
                const msg = JSON.parse(event.data) as FireTowerMsg;

                switch (msg.type) {
                    case tower.publishOperation:
                        const handlers: CallBackFunc | undefined = callbacks.get(msg.topic);

                        if (!handlers) {
                            return;
                        }

                        handlers.forEach(f => {
                            if (f) {
                                f(msg);
                            }
                        });

                        break;
                    default:
                }
            };

            socketStore.subscribe = (topics: string[], callback: (msg: FireTowerMsg) => void): (() => void) => {
                const unRegister: {
                    key: string;
                    rand: string;
                }[] = [];

                for (const item of topics) {
                    const rand = Math.random();

                    unRegister.push({
                        key: item,
                        rand: rand + ''
                    });
                    const exist = callbacks.get(item);

                    if (!exist) {
                        const m = new Map();

                        m.set(rand + '', callback);
                        callbacks.set(item, m);
                    } else {
                        exist.set(rand + '', callback);
                    }
                }

                tower.subscribe(topics);

                return () => {
                    for (const item of unRegister) {
                        const registed = callbacks.get(item.key);

                        if (registed) {
                            registed.delete(item.rand);
                        }
                    }

                    tower.unsubscribe(topics);
                };
            };

            tower.subscribe(['/user/' + userId]);
            socketStore.connectionStatus = CONNECTION_OK;
            onConnected();
        },
        (e: CloseEvent) => {
            if (e.code === 3000) {
                console.log('ws close', e);

                return;
            }
            socketStore.connectionStatus = CONNECTION_FAIL;
            setTimeout(() => {
                buildTower(userId, token, onConnected);
            }, 1000);
        }
    );
}

export default socketStore;
