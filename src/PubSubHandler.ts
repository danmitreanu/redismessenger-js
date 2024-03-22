import { Redis } from 'ioredis';

class PubSubHandler {
    private subClient: Redis;
    private pubClient: Redis;
    private callbacks: Map<string, (message: object) => Promise<void>>;

    constructor(pubClient: Redis, subClient: Redis) {
        this.pubClient = pubClient;
        this.subClient = subClient;
        this.callbacks = new Map<string, (message: object) => Promise<void>>();

        this.subClient.on('message', async (channel: Buffer, message: Buffer) => {
            const channelName = channel.toString();
            const messageStr = message.toString();
            const messagePayload = JSON.parse(messageStr);

            const callback = this.callbacks.get(channelName);
            if (!callback)
                throw new Error("Received message from unknown channel");

            await callback(messagePayload);
        });
    }

    async subscribe(redisChannelName: string, callback: (message: object) => Promise<void>): Promise<void> {
        await this.subClient.subscribe(redisChannelName);
        this.callbacks.set(redisChannelName, callback);
    }

    async publish(redisChannelName: string, message: any): Promise<void> {
        await this.pubClient.publish(redisChannelName, JSON.stringify(message));
    }
}

export default PubSubHandler;
