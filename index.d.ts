/// <reference types="node" />
import { EventEmitter } from 'node:events';

export type Key = string | number;

export interface Options {
  /** Stringify all values on set. */
  forceString?: boolean;
  objectValueSize?: number;
  promiseValueSize?: number;
  arrayValueSize?: number;
  /** Standard time to live in seconds. 0 = infinity. */
  stdTTL?: number;
  /** Seconds between automatic checks for expired keys. */
  checkperiod?: number;
  /** Store/return clones of values instead of references. Default true. */
  useClones?: boolean;
  /** Delete values automatically at expiration. Default true. */
  deleteOnExpire?: boolean;
  /** Enable legacy callbacks (deprecated). */
  enableLegacyCallbacks?: boolean;
  /** Max amount of keys stored (-1 = unlimited). */
  maxKeys?: number;
}

export interface Stats {
  hits: number;
  misses: number;
  keys: number;
  ksize: number;
  vsize: number;
}

export type ValueSetItem<T = unknown> = {
  key: Key;
  val: T;
  ttl?: number;
};

export interface WrappedValue<T> {
  /** expiration timestamp (ms), 0 = never */
  t: number;
  /** value */
  v: T;
}

export type NodeCacheEvent = 'set' | 'del' | 'expired' | 'flush' | 'flush_stats';

/**
 * Simple and fast in-memory cache.
 *
 * The optional type parameter sets the default value type, so a typed cache
 * (`new NodeCache<MyType>()`) returns `MyType` from `get`/`take` and accepts it
 * in `set` (#273). Per-call type parameters still override it.
 */
export default class NodeCache<TData = unknown> extends EventEmitter {
  data: Map<string, WrappedValue<TData>>;
  options: Options;
  stats: Stats;

  constructor(options?: Options);

  get<T = TData>(key: Key): T | undefined;
  mget<T = TData>(keys: Key[]): { [key: string]: T };

  set<T = TData>(key: Key, value: T, ttl?: number | string): boolean;
  mset<T = TData>(keyValueSet: ValueSetItem<T>[]): boolean;

  fetch<T = TData>(key: Key, ttl: number | string, value: () => T | T): T;
  fetch<T = TData>(key: Key, value: () => T | T): T;

  del(keys: Key | Key[]): number;
  take<T = TData>(key: Key): T | undefined;

  ttl(key: Key, ttl?: number): boolean;
  getTtl(key: Key): number | undefined;

  keys(): string[];
  has(key: Key): boolean;

  getStats(): Stats;
  flushAll(): void;
  flushStats(): void;
  close(): void;

  on(event: 'set', listener: (key: Key, value: TData) => void): this;
  on(event: 'del', listener: (key: Key, value: TData) => void): this;
  on(event: 'expired', listener: (key: Key, value: TData) => void): this;
  on(event: 'flush', listener: () => void): this;
  on(event: 'flush_stats', listener: () => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this;
}
