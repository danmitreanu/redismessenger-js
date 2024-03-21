import { Redis, RedisOptions } from 'ioredis';

interface ChannelHandler {
    channelName: string,
    handlerFn: (req: object) => object
}

class RedisMessengerConfiguration {
    clientName: any;
    channelPrefix: any;
    redisOptions: RedisOptions = {};

    /** @internal */
    channelHandlers: ChannelHandler[] = [];

    addHandler(channelName: string, handlerFn: (req: object) => object) {
        const channelHandler: ChannelHandler = {
            channelName,
            handlerFn
        };

        this.channelHandlers.push(channelHandler);
    }
}

class RedisMessenger {
    private pubClient: Redis;
    private subClient: Redis;
    private psubClient: Redis;
    private clientName: string;
    private channelPrefix: string = '';

    constructor(config: RedisMessengerConfiguration)
    {
        this.pubClient = new Redis(config.redisOptions);
        this.subClient = new Redis(config.redisOptions);
        this.psubClient = new Redis(config.redisOptions);

        this.clientName = config.clientName;
        if (config.channelPrefix)
            this.channelPrefix = `${config.channelPrefix}_`;

        this.bindHandlers();
    }

    private bindHandlers(): void {
        
    }

    static createRequestChannelName(channelPrefix: string, channelName: string, clientName: string): string {
        return `${channelPrefix}${channelName}:req-${clientName}`;
    }

    static createResponseChannelName(channelPrefix: string, channelName: string, clientName: string): string {
        return `${channelPrefix}${channelName}:res-${clientName}`;
    }

    static createHandlerRequestChannelPattern(channelPrefix: string, channelName: string): string {
        return `${channelPrefix}${channelName}:req-*`;
    }
}

export default { RedisMessenger, RedisMessengerConfiguration };