import MessageChannelInternal from './MessageChannelInternal';

class MessageChannel {
    private internal: MessageChannelInternal;

    constructor(internal: MessageChannelInternal) {
        this.internal = internal;
    }
}

export default MessageChannel;
