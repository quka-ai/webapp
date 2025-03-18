function errorMessage(message: string) {
    return {
        type: 'error',
        info: message
    };
}

// function successMessage(message: string) {
//     return {
//         type: 'success',
//         info: message
//     };
// }

export interface FireTowerMsg {
    topic: string;
    type: number;
    data: any;
}

export class FireTower {
    ws: WebSocket;

    publishOperation = 1;
    subscribeOperation = 2;
    unSubscribeOperation = 3;

    logging = false; // 开启log

    onmessage?: (event: MessageEvent) => void;

    onclose?: (event: CloseEvent) => void;

    readyState() {
        return this.ws.readyState;
    }

    constructor(addr: string, onopen: () => void, onclose: (event: CloseEvent) => void) {
        this.ws = new WebSocket(addr);
        this.ws.onopen = onopen;
        this.onclose = onclose;

        this.ws.onmessage = event => {
            if (this.logging) {
                this.logInfo('new message: ' + event.data);
            }

            if (event.data === 'heartbeat') {
                return;
            }

            if (this.onmessage) {
                this.onmessage(event);
            }
        };

        this.ws.onclose = event => {
            if (this.onclose) {
                this.onclose(event);
            }
        };
    }

    logInfo(data: any) {
        console.log('[FireTower] INFO', data);
    }

    publish(topic: string, data: string) {
        if (topic === '' || data === '') {
            return errorMessage('topic and message is required');
        }

        if (this.logging) {
            this.logInfo('publish topic:"' + topic + '", data:' + JSON.stringify(data));
        }

        this.ws.send(
            JSON.stringify({
                type: this.publishOperation,
                topic: topic,
                data: data
            })
        );
    }

    subscribe(topics: string[] | string) {
        if (!Array.isArray(topics)) {
            topics = [topics];
        }

        if (this.logging) {
            this.logInfo('subscribe:"' + topics.join(',') + '"');
        }

        if (this.ws) {
            this.ws.send(
                JSON.stringify({
                    type: this.subscribeOperation,
                    topic: topics.join(','),
                    data: ''
                })
            );
        }
    }

    unsubscribe(topics: string[] | string) {
        if (!Array.isArray(topics)) {
            topics = [topics];
        }

        if (this.logging) {
            this.logInfo('unSubscribe:"' + topics.join(',') + '"');
        }

        this.ws.send(
            JSON.stringify({
                type: this.unSubscribeOperation,
                topic: topics.join(','),
                data: ''
            })
        );
    }
}
