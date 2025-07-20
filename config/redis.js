const { createClient } = require('redis');

const redis = createClient({
    socket: {
        host: "43.0.2.30",
        port: 6379
    }
});

redis.connect()
    .then(() => {
        console.log('Redis client connected successfully');
    })
    .catch((err) => {
        console.error('Error connecting to Redis:', err);
    });

module.exports = redis;