// apps/api/src/plugins/redis.ts
import Redis from 'ioredis'

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  lazyConnect: true,
})

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message)
})

redis.on('connect', () => {
  console.info('[Redis] Connected')
})
