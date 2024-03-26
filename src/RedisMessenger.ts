import { Redis, RedisOptions } from 'ioredis';
import PubSubHandler from './PubSubHandler';
import { IMessageChannel, IRequest, IResponse, MessageChannel } from './MessageChannel';

class RedisMessengerConfiguration {
    clientName: any;
    channelPrefix: any;
    defaultTimeoutMs: number = 5000;
    redisOptions: RedisOptions = {};
}

interface IRedisMessenger {
    getMessageChannel: (channelName: string) => IMessageChannel;
    addHandler: (channelName: string, handler: (payload: any) => any) => Promise<void>;
}

class RedisMessenger implements IRedisMessenger {
    private pubClient: Redis;
    private subClient: Redis;
    private clientName: string;
    private channelPrefix: string = '';
    private defaultTimeoutMs: number = 5000;
    private pubsubHandler: PubSubHandler;

    constructor(config: RedisMessengerConfiguration)
    {
        this.pubClient = new Redis(config.redisOptions);
        this.subClient = new Redis(config.redisOptions);

        this.clientName = config.clientName;
        if (config.channelPrefix)
            this.channelPrefix = `${config.channelPrefix}_`;

        if (config.defaultTimeoutMs)
            this.defaultTimeoutMs = config.defaultTimeoutMs;

        this.pubsubHandler = new PubSubHandler(this.pubClient, this.subClient);
    }

    getMessageChannel(channelName: string): IMessageChannel {
        return new MessageChannel(this.pubsubHandler, this.channelPrefix, channelName, this.clientName, this.defaultTimeoutMs);
    }

    async addHandler(channelName: string, handler: (payload: any) => any) {
        const redisRequestChannel = RedisMessenger.createRequestChannelName(this.channelPrefix, channelName);
        await this.pubsubHandler.subscribe(redisRequestChannel, this.createMessageHandlerWrapper(channelName, handler));
    }

    private createMessageHandlerWrapper(channelName: string, handler: (payload: any) => any): (message: object) => Promise<void> {
        return async (message: object): Promise<void> => {
            const request = message as IRequest;
            if (!request || !request.requestId || !request.clientName)
                return;

            const replyTo = request.requestId;
            const responseChannel = RedisMessenger.createResponseChannelName(this.channelPrefix, channelName, request.clientName);
            let responsePayload: any;
            let success: boolean = true;
            let errorMessage: string | null = null;

            try {
                responsePayload = await handler(request.payload);
            } catch (err) {
                success = false;
                errorMessage = err instanceof Error ?
                    (<Error>err).message :
                    JSON.stringify(err, null, 2);
            }

            const response: IResponse = {
                replyTo,
                success,
                errorMessage,
                payload: responsePayload
            };

            await this.pubsubHandler.publish(responseChannel, response);
        }
    }

    static createRequestChannelName = (channelPrefix: string, channelName: string): string => {
        return `${channelPrefix}${channelName}:req`;
    }

    static createResponseChannelName = (channelPrefix: string, channelName: string, clientName: string): string => {
        return `${channelPrefix}${channelName}:res_${clientName}`;
    }
}

export {
    RedisMessenger,
    IRedisMessenger,
    RedisMessengerConfiguration,
    IMessageChannel
}
