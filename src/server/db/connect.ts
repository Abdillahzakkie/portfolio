import mongoose from 'mongoose';

/**
 * Cached Mongoose connection, Next.js serverless-safe.
 *
 * In dev, Next's hot-reload re-evaluates modules on every change; in a
 * serverless/lambda runtime a warm container reuses module scope across
 * invocations. Either way, a naive `mongoose.connect()` at import time would
 * open a new pool each time and exhaust connections. We cache the connection
 * (and the in-flight promise, so concurrent callers await the same connect) on
 * `globalThis`, which survives both hot-reload and warm reuse.
 *
 * Connection string comes from `process.env.MONGODB_URI`. Dev default points at
 * the shared Docker Mongo on localhost:27018, database `portfolio` (its own
 * namespace). Prod sets MONGODB_URI to the Atlas URI — same code, env-driven.
 */

const DEFAULT_URI = 'mongodb://localhost:27018/portfolio';
const MONGODB_URI = process.env.MONGODB_URI ?? DEFAULT_URI;

// Guarantee the `portfolio` namespace even if a bare URI (no path db) is given,
// so this app never collides with other apps on the shared instance.
const MONGODB_DB = process.env.MONGODB_DB ?? 'portfolio';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Reuse a single cache slot across hot-reloads / warm lambdas.
const globalWithMongoose = globalThis as typeof globalThis & {
  _mongoose?: MongooseCache;
};

const cache: MongooseCache =
  globalWithMongoose._mongoose ??
  (globalWithMongoose._mongoose = { conn: null, promise: null });

/**
 * Returns a live, cached Mongoose connection, opening it on first call.
 * Idempotent and safe to call from every request/handler.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    // Fail fast if someone strips the default and forgets the env var.
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is not set and no default is available.');
    }

    cache.promise = mongoose
      .connect(MONGODB_URI, {
        dbName: MONGODB_DB,
        // Buffering off => surfaces "not connected" as a real error instead of
        // hanging a request forever; each handler awaits connect() first anyway.
        bufferCommands: false,
      })
      .then((m) => m);
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    // Reset the promise so the next call retries instead of caching a rejection.
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}

/** Closes the cached connection and clears the cache (tests / graceful shutdown). */
export async function disconnectFromDatabase(): Promise<void> {
  if (cache.conn) {
    await cache.conn.disconnect();
    cache.conn = null;
    cache.promise = null;
  }
}

export default connectToDatabase;
