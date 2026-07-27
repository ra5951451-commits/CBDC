/**
 * Upstash Redis client + helper functions.
 * Uses @upstash/redis REST client (works in serverless environments).
 */

const { Redis } = require('@upstash/redis');

// Singleton client — reused across warm invocations
let redis = null;

function getClient() {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN environment variables');
    }

    redis = new Redis({ url, token });
  }
  return redis;
}

// ── JSON Helpers ─────────────────────────────────────────────────────────────

/**
 * Get a JSON-parsed value from Redis.
 * @param {string} key
 * @returns {Promise<any|null>}
 */
async function getJSON(key) {
  const client = getClient();
  const data = await client.get(key);
  if (data === null || data === undefined) return null;
  // @upstash/redis auto-parses JSON, but handle string fallback
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return data; }
  }
  return data;
}

/**
 * Store a value as JSON string in Redis, with optional TTL.
 * @param {string} key
 * @param {any} value
 * @param {number} [ttlSeconds] - Optional expiry in seconds
 */
async function setJSON(key, value, ttlSeconds) {
  const client = getClient();
  if (ttlSeconds) {
    await client.set(key, JSON.stringify(value), { ex: ttlSeconds });
  } else {
    await client.set(key, JSON.stringify(value));
  }
}

/**
 * Delete a key from Redis.
 * @param {string} key
 */
async function deleteKey(key) {
  const client = getClient();
  await client.del(key);
}

/**
 * Check if a key exists in Redis.
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function exists(key) {
  const client = getClient();
  const result = await client.exists(key);
  return result === 1;
}

// ── Set Helpers ──────────────────────────────────────────────────────────────

/**
 * Get all members of a Redis Set.
 * @param {string} key
 * @returns {Promise<string[]>}
 */
async function sMembers(key) {
  const client = getClient();
  const members = await client.smembers(key);
  return members || [];
}

/**
 * Add one or more members to a Redis Set.
 * @param {string} key
 * @param  {...string} members
 */
async function sAdd(key, ...members) {
  const client = getClient();
  if (members.length === 1) {
    await client.sadd(key, members[0]);
  } else {
    await client.sadd(key, ...members);
  }
}

// ── List Helpers ─────────────────────────────────────────────────────────────

/**
 * Push a value to the left of a Redis List and trim to maxLength.
 * @param {string} key
 * @param {any} value - Will be JSON-stringified
 * @param {number} maxLength - Keep only this many entries
 */
async function lPushAndTrim(key, value, maxLength) {
  const client = getClient();
  const pipeline = client.pipeline();
  pipeline.lpush(key, JSON.stringify(value));
  pipeline.ltrim(key, 0, maxLength - 1);
  await pipeline.exec();
}

/**
 * Get a range of entries from a Redis List.
 * @param {string} key
 * @param {number} start
 * @param {number} end
 * @returns {Promise<any[]>}
 */
async function lRange(key, start, end) {
  const client = getClient();
  const items = await client.lrange(key, start, end);
  if (!items) return [];
  return items.map(item => {
    if (typeof item === 'string') {
      try { return JSON.parse(item); } catch { return item; }
    }
    return item;
  });
}

// ── Counter/Rate Limit Helpers ───────────────────────────────────────────────

/**
 * Increment a counter with TTL. Returns the new count.
 * @param {string} key
 * @param {number} windowSeconds
 * @returns {Promise<number>}
 */
async function incrementCounter(key, windowSeconds) {
  const client = getClient();
  const pipeline = client.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, windowSeconds);
  const results = await pipeline.exec();
  return results[0]; // the incremented count
}

module.exports = {
  getClient,
  getJSON,
  setJSON,
  deleteKey,
  exists,
  sMembers,
  sAdd,
  lPushAndTrim,
  lRange,
  incrementCounter,
};
