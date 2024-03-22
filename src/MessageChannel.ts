import PubSubHandler from './PubSubHandler';
import { RedisMessenger } from './RedisMessenger';
import { v4 as uuidv4 } from 'uuid';

interface IMessageChannel {
    send: (mesage: any) => Promise<void>;
    query: (message: any, timeoutMs?: Number) => Promise<any>;
}

interface IRequest {
    requestId: string;
    clientName: string;
    payload: any;
}

interface IResponse {
    replyTo: string;
    success: boolean;
    errorString: string | undefined;
    payload: any;
}

interface IPromiseResolver {
    resolve: (payload: any) => void;
    reject: (error: any) => void;
}

class MessageChannel implements IMessageChannel {
    private pubsub: PubSubHandler;
    private channelPrefix: string;
    private channelName: string;
    private clientName: string;
    private defaultTimeout: number;
    private subscribed: boolean = false;

    private responsePromises: Map<string, IPromiseResolver> = new Map<string, IPromiseResolver>();

    constructor(internal: PubSubHandler, channelPrefix: string, channelName: string, clientName: string, defaultTimeout: number) {
        this.pubsub = internal;
        this.channelPrefix = channelPrefix;
        this.channelName = channelName;
        this.clientName = clientName;
        this.defaultTimeout = defaultTimeout;
    }

    async send(message: any): Promise<void> {
        const requestId = uuidv4();
        const request: IRequest = {
            requestId,
            clientName: this.clientName,
            payload: message
        };

        const redisChannel = RedisMessenger.createRequestChannelName(this.channelPrefix, this.channelName, this.clientName);
        await this.pubsub.publish(redisChannel, request);
    }

    async query(message: any): Promise<any> {
        await this.ensureSubsribed();

        const requestId = uuidv4();
        const request: IRequest = {
            requestId,
            clientName: this.clientName,
            payload: message
        };

        let promiseResolve: any, promiseReject: any;

        const promise = new Promise<any>((resolve, reject) => {
            promiseResolve = resolve;
            promiseReject = reject;
        });

        let rejectTimeout: NodeJS.Timeout | undefined;
        const resolver: IPromiseResolver = {
            resolve: payload => {
                clearTimeout(rejectTimeout);
                promiseResolve(payload);
            },
            reject: error => {
                clearTimeout(rejectTimeout);
                promiseReject(error);
            }
        };

        this.responsePromises.set(requestId, resolver);

        const redisChannel = RedisMessenger.createRequestChannelName(this.channelPrefix, this.channelName, this.clientName);
        await this.pubsub.publish(redisChannel, request);

        rejectTimeout = setTimeout(() => promiseReject(new Error("Query timed out")), this.defaultTimeout);

        try {
            return await promise;
        } finally {
            this.responsePromises.delete(requestId);
        }
    }

    private async ensureSubsribed(): Promise<void> {
        if (this.subscribed)
            return;

        const redisChannel = RedisMessenger.createResponseChannelName(this.channelPrefix, this.channelName, this.clientName);
        await this.pubsub.subscribe(redisChannel, async (message: object): Promise<void>  => {
            const response = message as IResponse;
            const resolver = this.responsePromises.get(response.replyTo);
            if (!resolver)
                return;

            if (!response.success) {
                resolver.reject(new Error(response.errorString));
                return;
            }

            resolver.resolve(response.payload);
        });

        this.subscribed = true;
    }
}

export {
    IMessageChannel
}
