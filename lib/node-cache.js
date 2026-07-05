// Simple and fast NodeJS internal caching. Ported from node-cache 5.1.2
// (CoffeeScript, MIT) to modern ESM. Storage backed by Map (#212), `clone`
// vendored in lib/clone.js (0 runtime deps).
import { EventEmitter } from 'node:events';
import clone from './clone.js';

const ERROR_TEMPLATES = {
  ENOTFOUND: 'Key `__key` not found',
  ECACHEFULL: 'Cache max keys amount exceeded',
  EKEYTYPE: 'The key argument has to be of type `string` or `number`. Found: `__key`',
  EKEYSTYPE: 'The keys argument has to be an array.',
  ETTLTYPE: 'The ttl argument has to be a number.',
};

const TTL_MULTIPLICATOR = 1000;
const VALID_KEY_TYPES = ['string', 'number'];

export default class NodeCache extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      forceString: false,
      objectValueSize: 80,
      promiseValueSize: 80,
      arrayValueSize: 40,
      // standard time to live in seconds. 0 = infinity
      stdTTL: 0,
      // seconds between automatic checks for expired keys
      checkperiod: 600,
      // return a clone of cached values instead of the reference
      useClones: true,
      // delete values automatically at expiration
      deleteOnExpire: true,
      enableLegacyCallbacks: false,
      // max amount of keys stored (-1 = unlimited)
      maxKeys: -1,
      ...options,
    };

    // Map keeps insertion order, is prototype-safe and faster than a plain
    // object for churny caches (#212, #286).
    this.data = new Map();

    this.stats = { hits: 0, misses: 0, keys: 0, ksize: 0, vsize: 0 };

    if (this.options.enableLegacyCallbacks) {
      // eslint-disable-next-line no-console
      console.warn('WARNING! node-cache legacy callback support will drop in v6.x');
      ['get', 'mget', 'set', 'del', 'ttl', 'getTtl', 'keys', 'has'].forEach((methodKey) => {
        const oldMethod = this[methodKey];
        this[methodKey] = (...args) => {
          const cb = args[args.length - 1];
          if (typeof cb === 'function') {
            try {
              const res = oldMethod(...args.slice(0, -1));
              cb(null, res);
            } catch (err) {
              cb(err);
            }
            return undefined;
          }
          return oldMethod(...args);
        };
      });
    }

    this._checkData();
  }

  // Normalize a key the way the original object-backed store did: object keys
  // are always strings, so `5` and `"5"` addressed the same entry.
  _key(key) {
    return typeof key === 'number' ? String(key) : key;
  }

  get = (key) => {
    const err = this._isInvalidKey(key);
    if (err != null) throw err;

    const k = this._key(key);
    const entry = this.data.get(k);
    if (entry != null && this._check(k, entry)) {
      this.stats.hits++;
      return this._unwrap(entry);
    }
    this.stats.misses++;
    return undefined;
  };

  mget = (keys) => {
    if (!Array.isArray(keys)) throw this._error('EKEYSTYPE');

    const oRet = {};
    for (const key of keys) {
      const err = this._isInvalidKey(key);
      if (err != null) throw err;

      const k = this._key(key);
      const entry = this.data.get(k);
      if (entry != null && this._check(k, entry)) {
        this.stats.hits++;
        oRet[key] = this._unwrap(entry);
      } else {
        this.stats.misses++;
      }
    }
    return oRet;
  };

  set = (key, value, ttl) => {
    if (this.options.maxKeys > -1 && this.stats.keys >= this.options.maxKeys) {
      throw this._error('ECACHEFULL');
    }

    if (this.options.forceString && typeof value !== 'string') {
      value = JSON.stringify(value);
    }

    if (ttl == null) ttl = this.options.stdTTL;

    const err = this._isInvalidKey(key);
    if (err != null) throw err;

    const k = this._key(key);
    let existent = false;

    if (this.data.has(k)) {
      existent = true;
      this.stats.vsize -= this._getValLength(this._unwrap(this.data.get(k), false));
    }

    this.data.set(k, this._wrap(value, ttl));
    this.stats.vsize += this._getValLength(value);

    if (!existent) {
      this.stats.ksize += this._getKeyLength(key);
      this.stats.keys++;
    }

    this.emit('set', key, value);
    return true;
  };

  fetch = (key, ttl, value) => {
    if (this.has(key)) return this.get(key);
    if (typeof value === 'undefined') {
      value = ttl;
      ttl = undefined;
    }
    const _ret = typeof value === 'function' ? value() : value;
    this.set(key, _ret, ttl);
    return _ret;
  };

  mset = (keyValueSet) => {
    if (
      this.options.maxKeys > -1 &&
      this.stats.keys + keyValueSet.length >= this.options.maxKeys
    ) {
      throw this._error('ECACHEFULL');
    }

    for (const { key, ttl } of keyValueSet) {
      if (ttl && typeof ttl !== 'number') throw this._error('ETTLTYPE');
      const err = this._isInvalidKey(key);
      if (err != null) throw err;
    }

    for (const { key, val, ttl } of keyValueSet) {
      this.set(key, val, ttl);
    }
    return true;
  };

  del = (keys) => {
    if (!Array.isArray(keys)) keys = [keys];

    let delCount = 0;
    for (const key of keys) {
      const err = this._isInvalidKey(key);
      if (err != null) throw err;

      const k = this._key(key);
      const entry = this.data.get(k);
      if (entry != null) {
        this.stats.vsize -= this._getValLength(this._unwrap(entry, false));
        this.stats.ksize -= this._getKeyLength(key);
        this.stats.keys--;
        delCount++;
        this.data.delete(k);
        this.emit('del', key, entry.v);
      }
    }
    return delCount;
  };

  take = (key) => {
    const _ret = this.get(key);
    if (_ret != null) this.del(key);
    return _ret;
  };

  ttl = (key, ttl) => {
    ttl = ttl || this.options.stdTTL;
    if (!key) return false;

    const err = this._isInvalidKey(key);
    if (err != null) throw err;

    const k = this._key(key);
    const entry = this.data.get(k);
    if (entry != null && this._check(k, entry)) {
      if (ttl >= 0) {
        this.data.set(k, this._wrap(entry.v, ttl, false));
      } else {
        this.del(key);
      }
      return true;
    }
    return false;
  };

  getTtl = (key) => {
    if (!key) return undefined;

    const err = this._isInvalidKey(key);
    if (err != null) throw err;

    const k = this._key(key);
    const entry = this.data.get(k);
    if (entry != null && this._check(k, entry)) {
      return entry.t;
    }
    return undefined;
  };

  keys = () => [...this.data.keys()];

  has = (key) => {
    const k = this._key(key);
    const entry = this.data.get(k);
    return entry != null && this._check(k, entry);
  };

  getStats = () => this.stats;

  flushAll = (_startPeriod = true) => {
    this.data = new Map();
    this.stats = { hits: 0, misses: 0, keys: 0, ksize: 0, vsize: 0 };
    this._killCheckPeriod();
    this._checkData(_startPeriod);
    this.emit('flush');
  };

  flushStats = () => {
    this.stats = { hits: 0, misses: 0, keys: 0, ksize: 0, vsize: 0 };
    this.emit('flush_stats');
  };

  close = () => {
    this._killCheckPeriod();
  };

  _checkData = (startPeriod = true) => {
    for (const [key, value] of this.data) {
      this._check(key, value);
    }

    if (startPeriod && this.options.checkperiod > 0) {
      this.checkTimeout = setTimeout(
        this._checkData,
        this.options.checkperiod * 1000,
        startPeriod
      );
      if (this.checkTimeout && this.checkTimeout.unref) this.checkTimeout.unref();
    }
  };

  _killCheckPeriod = () => {
    if (this.checkTimeout != null) clearTimeout(this.checkTimeout);
  };

  _check = (key, data) => {
    let retval = true;
    if (data.t !== 0 && data.t < Date.now()) {
      if (this.options.deleteOnExpire) {
        retval = false;
        this.del(key);
      }
      this.emit('expired', key, this._unwrap(data));
    }
    return retval;
  };

  _isInvalidKey = (key) => {
    if (!VALID_KEY_TYPES.includes(typeof key)) {
      return this._error('EKEYTYPE', { type: typeof key });
    }
    return undefined;
  };

  _wrap = (value, ttl, asClone = true) => {
    if (!this.options.useClones) asClone = false;
    const now = Date.now();
    let livetime = 0;

    if (ttl === 0) {
      livetime = 0;
    } else if (ttl) {
      livetime = now + ttl * TTL_MULTIPLICATOR;
    } else if (this.options.stdTTL === 0) {
      livetime = this.options.stdTTL;
    } else {
      livetime = now + this.options.stdTTL * TTL_MULTIPLICATOR;
    }

    return { t: livetime, v: asClone ? clone(value) : value };
  };

  _unwrap = (value, asClone = true) => {
    if (!this.options.useClones) asClone = false;
    if (value.v != null) {
      return asClone ? clone(value.v) : value.v;
    }
    return null;
  };

  _getKeyLength = (key) => key.toString().length;

  _getValLength = (value) => {
    if (typeof value === 'string') {
      return value.length;
    }
    if (this.options.forceString) {
      return JSON.stringify(value).length;
    }
    if (Array.isArray(value)) {
      return this.options.arrayValueSize * value.length;
    }
    if (typeof value === 'number') {
      return 8;
    }
    if (value != null && typeof value.then === 'function') {
      return this.options.promiseValueSize;
    }
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
      return value.length;
    }
    if (value != null && typeof value === 'object') {
      return this.options.objectValueSize * Object.keys(value).length;
    }
    if (typeof value === 'boolean') {
      return 8;
    }
    return 0;
  };

  _error = (type, data = {}) => {
    const error = new Error();
    error.name = type;
    error.errorcode = type;
    error.message = ERROR_TEMPLATES[type]
      ? ERROR_TEMPLATES[type].replace('__key', data.type)
      : '-';
    error.data = data;
    return error;
  };
}
