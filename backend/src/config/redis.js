import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

redisConnection.on('connect', () => {
  console.log('Connecting to Redis');
});

redisConnection.on('ready', () => {
  console.log('Redis connection ready');
});

redisConnection.on('error', (error) => {
  console.error(`Redis connection error (${error.name})`);
});

redisConnection.on('close', () => {
  console.log('Redis connection closed');
});

export async function connectRedis() {
  if (redisConnection.status === 'ready') {
    return;
  }

  await Promise.race([
    redisConnection.ping(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Redis connection timed out')), 10000).unref();
    }),
  ]);
}
