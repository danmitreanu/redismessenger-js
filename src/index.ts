import { RedisMessenger, IRedisMessenger, RedisMessengerConfiguration, IMessageChannel } from "./RedisMessenger";

export const createRedisMessenger = (config: RedisMessengerConfiguration): IRedisMessenger => {
    return new RedisMessenger(config);
}

export {
    IRedisMessenger,
    RedisMessengerConfiguration,
    IMessageChannel
}
