import { Redis, RedisOptions } from 'ioredis';
import PubSubHandler from './PubSubHandler';
import { IMessageChannel, IRequest, IResponse, MessageChannel } from './MessageChannel';

class RedisMessengerConfiguration {
    clientName: any;
    channelPrefix: any;
    defaultTimeoutMs: number= 5000;
    redisOptions: RedisOptions = {};

    /** @internal */
    channelHandlers: Map<string, (payload: any) => any> = new Map<string, (payload: any) => any>();

    addHandler(channelName: string, handler: (req: any) => Promise<any>) {
        if (this.channelHandlers.has(channelName))
            throw new Error(`A message handler with the name ${channelName} has already been registered`);

        this.channelHandlers.set(channelName, handler);
    }
}

interface IRedisMessenger {
    getMessageChannel: (channelName: string) => IMessageChannel;
}

class RedisMessenger implements IRedisMessenger {
    private pubClient: Redis;
    private subClient: Redis;
    private clientName: string;
    private channelPrefix: string = '';
    private defaultTimeoutMs: number;
    private pubsubHandler: PubSubHandler;

    constructor(config: RedisMessengerConfiguration)
    {
        this.pubClient = new Redis(config.redisOptions);
        this.subClient = new Redis(config.redisOptions);

        this.clientName = config.clientName;
        if (config.channelPrefix)
            this.channelPrefix = `${config.channelPrefix}_`;

        this.defaultTimeoutMs = config.defaultTimeoutMs;

        this.pubsubHandler = new PubSubHandler(this.pubClient, this.subClient);
        this.bindHandlers(config.channelHandlers);
    }

    getMessageChannel(channelName: string): IMessageChannel {
        return new MessageChannel(this.pubsubHandler, this.channelPrefix, channelName, this.clientName, this.defaultTimeoutMs);
    }

    private async bindHandlers(handlers: Map<string, (payload: any) => any>) {
        for (const channelName in handlers) {
            const handler = handlers.get(channelName);
            if (!handler)
                continue;

            const redisRequestChannel = RedisMessenger.createRequestChannelName(this.channelPrefix, channelName);
            await this.pubsubHandler.subscribe(redisRequestChannel, this.createMessageHandlerWrapper(channelName, handler));
        }
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
