const { createRedisMessenger } = require('../dist/index');
const express = require('express');

const redisMessenger = createRedisMessenger({
    clientName: "node-client",
    channelPrefix: "test",
    redisOptions: {
        host: "localhost"
    }
});

redisMessenger.addHandler('node-test-channel', (payload) => {
    console.log('We received', payload);
    return {
        message: "Got your message, thanks, it looks like " + JSON.stringify(payload)
    }
});

const dotnetChannel = redisMessenger.getMessageChannel('dotnet-test-channel');

const app = express();

app.get('/', async (req, res) => {
    const message = req.query['message'];

    try {
        const response = await dotnetChannel.query({
            message
        });
        res.send(JSON.stringify(response));
    }
    catch (err)
    {
        res.send({ error: err.message });
    }
});

app.listen(8080, () => {
    console.log('Listening');
});
