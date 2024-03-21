import { Redis } from 'ioredis';

type Callback = {
    [key: string]: (channel: string, message: string) => any;
}

class MessageChannelInternal {
    private subClient: Redis;
    private pubClient: Redis;
    private callbacks: Callback = {};

    constructor(pubClient: Redis, subClient: Redis) {
        this.pubClient = pubClient;
        this.subClient = subClient;

        this.subClient.on('message', (channel, message) => {
            if (!(channel in this.callbacks))
                throw new Error("Received message from unknown channel");

            const callback = this.callbacks[channel];
            callback(channel, message);
        });
    }

    subscribe(redisChannelName: string, callback: (channel: string, message: string) => any) {
        this.subClient.subscribe(redisChannelName);
        this.subClient.on('message', callback);
    }

    async publish(redisChannelName: string, message: object) {
        await this.pubClient.publish(redisChannelName, JSON.stringify(message));
    }
}

export default MessageChannelInternal;
