import { db } from '@database/db';
import {
  SQLiteBindParams,
  SQLiteBindValue,
  SQLiteRunResult,
} from 'expo-sqlite';
import { noop } from 'lodash-es';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

const helpersLog = createRateLimitedLogger('DBHelpers', { windowMs: 1500 });

interface DatabaseError extends Error {
  code?: number;
}

function isDatabaseError(error: unknown): error is DatabaseError {
  return (
    error instanceof Error ||
    (typeof error === 'object' && error !== null && 'message' in error)
  );
}

function logError(error: unknown) {
  if (isDatabaseError(error)) {
    helpersLog.error('query-error', 'Database query error:', error);
  } else {
    helpersLog.error('query-error', 'Unknown database error:', String(error));
  }
}

type query = string;
type SQLiteResultFunction<T> = (data: T) => void;
type SQLiteErrorFunction = (error: unknown) => void;

export type QueryObject<T = unknown> =
  | [query, SQLiteBindParams, SQLiteResultFunction<T>, SQLiteErrorFunction]
  | [query, SQLiteBindParams, SQLiteResultFunction<T>]
  | [query, SQLiteBindParams]
  | [query];

function defaultQuerySync<T = unknown, Array extends boolean = false>(
  fn: 'getAllSync' | 'getFirstSync' | 'runSync',
  queryObject: QueryObject<Array extends true ? T[] : T>,
  errorReturn: Array extends true ? [] : null,
) {
  const [query, params = [], callback = noop, catchCallback = logError] =
    queryObject;

  try {
    // @ts-ignore
    const result = db[fn](query, params) as Array extends true ? T[] : T;
    callback(result);
    return result;
  } catch (e: unknown) {
    catchCallback(e);
    return errorReturn;
  }
}
async function defaultQueryAsync<T = unknown, Array extends boolean = false>(
  fn: 'getAllAsync' | 'getFirstAsync' | 'runAsync',
  queryObject: QueryObject<Array extends true ? T[] : T>,
  errorReturn: Array extends true ? [] : null,
) {
  const [query, params = [], callback = noop, catchCallback = logError] =
    queryObject;
  // Retry on transient 'database is locked' errors
  const maxAttempts = 3;
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      // @ts-ignore
      const result = (await db[fn](query, params)) as Array extends true
        ? T[]
        : T;
      callback(result);
      return result;
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? String(e.message ?? e)
          : typeof e === 'string'
            ? e
            : String(e ?? '');
      // If it's a database locked error, retry with backoff
      if (msg.includes('database is locked') && attempt < maxAttempts - 1) {
        const wait = 50 * Math.pow(2, attempt); // 50ms, 100ms, 200ms

        await new Promise(r => setTimeout(r, wait));
        attempt += 1;
        continue;
      }

      catchCallback(e);
      return errorReturn;
    }
  }
  return errorReturn;
}

export async function runAsync(queryObjects: QueryObject<SQLiteRunResult>[]) {
  const promises = [];
  for (const queryObject of queryObjects) {
    promises.push(
      defaultQueryAsync<SQLiteRunResult, false>('runAsync', queryObject, null),
    );
  }
  await Promise.all(promises);
}

export function runSync(queryObjects: QueryObject<SQLiteRunResult>[]) {
  for (const queryObject of queryObjects) {
    defaultQuerySync<SQLiteRunResult, false>('runSync', queryObject, null);
  }
}

export async function getAllAsync<T = unknown>(queryObject: QueryObject<T[]>) {
  return defaultQueryAsync<T, true>('getAllAsync', queryObject, []);
}
export function getAllSync<T = unknown>(queryObject: QueryObject<T[]>) {
  return defaultQuerySync<T, true>('getAllSync', queryObject, []);
}

export function getFirstAsync<T = unknown>(queryObject: QueryObject<T>) {
  return defaultQueryAsync<T, false>('getFirstAsync', queryObject, null);
}
export function getFirstSync<T = unknown>(queryObject: QueryObject<T>) {
  return defaultQuerySync<T, false>('getFirstSync', queryObject, null);
}

type params = SQLiteBindValue[];
type TransactionObject = [query, ...params];

export async function transactionAsync(transactionObject: TransactionObject[]) {
  await db.withTransactionAsync(async () => {
    const promises = transactionObject.map(([query, ...params]) => {
      return db.runAsync(query, ...params);
    });
    await Promise.all(promises);
  });
}
