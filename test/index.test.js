import { test } from 'node:test';
import assert from 'node:assert';
import NodeCache from '../index.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const newCache = (opts) => new NodeCache({ checkperiod: 0, ...opts });

test('set and get', () => {
  const c = newCache();
  assert.equal(c.set('k', 'v'), true);
  assert.equal(c.get('k'), 'v');
});

test('get miss returns undefined', () => {
  const c = newCache();
  assert.equal(c.get('nope'), undefined);
});

test('invalid key type throws EKEYTYPE', () => {
  const c = newCache();
  assert.throws(() => c.get({}), /type/);
});

test('numeric and string keys address the same entry (object coercion)', () => {
  const c = newCache();
  c.set(5, 'five');
  assert.equal(c.get('5'), 'five');
  assert.deepEqual(c.keys(), ['5']); // keys() are always strings, like the original
});

test('mget / mset', () => {
  const c = newCache();
  c.mset([
    { key: 'a', val: 1 },
    { key: 'b', val: 2 },
  ]);
  assert.deepEqual(c.mget(['a', 'b']), { a: 1, b: 2 });
});

test('del returns number of deleted keys', () => {
  const c = newCache();
  c.mset([
    { key: 'a', val: 1 },
    { key: 'b', val: 2 },
  ]);
  assert.equal(c.del(['a', 'b', 'missing']), 2);
  assert.equal(c.get('a'), undefined);
});

test('take = get + del', () => {
  const c = newCache();
  c.set('otp', 123);
  assert.equal(c.take('otp'), 123);
  assert.equal(c.has('otp'), false);
});

test('has', () => {
  const c = newCache();
  c.set('k', 1);
  assert.equal(c.has('k'), true);
  assert.equal(c.has('x'), false);
});

test('keys', () => {
  const c = newCache();
  c.set('a', 1);
  c.set('b', 2);
  assert.deepEqual(c.keys().sort(), ['a', 'b']);
});

test('getStats tracks hits/misses/keys', () => {
  const c = newCache();
  c.set('k', 1);
  c.get('k'); // hit
  c.get('x'); // miss
  const s = c.getStats();
  assert.equal(s.hits, 1);
  assert.equal(s.misses, 1);
  assert.equal(s.keys, 1);
});

test('ttl expiry removes the value', async () => {
  const c = newCache();
  c.set('k', 'v', 0.05); // 50ms
  assert.equal(c.get('k'), 'v');
  await sleep(70);
  assert.equal(c.get('k'), undefined);
});

test('deleteOnExpire=false keeps value but reports expired', async () => {
  const c = newCache({ deleteOnExpire: false });
  c.set('k', 'v', 0.05);
  await sleep(70);
  c.get('k'); // triggers _check -> expired but not deleted
  assert.ok(c.data.has('k'));
});

test('ttl() resets, getTtl() reads', () => {
  const c = newCache();
  c.set('k', 'v', 100);
  assert.equal(c.ttl('k', 200), true);
  const t = c.getTtl('k');
  assert.ok(t > Date.now());
});

test('ttl() with negative deletes', () => {
  const c = newCache();
  c.set('k', 'v', 100);
  assert.equal(c.ttl('k', -1), true);
  assert.equal(c.has('k'), false);
});

test('flushAll resets data and stats', () => {
  const c = newCache();
  c.set('k', 1);
  c.get('k');
  c.flushAll();
  assert.deepEqual(c.keys(), []);
  assert.equal(c.getStats().keys, 0);
  assert.equal(c.getStats().hits, 0);
});

test('flushStats resets only stats', () => {
  const c = newCache();
  c.set('k', 1);
  c.get('k');
  c.flushStats();
  assert.equal(c.getStats().hits, 0);
  assert.equal(c.has('k'), true);
});

test('maxKeys throws ECACHEFULL', () => {
  const c = newCache({ maxKeys: 1 });
  c.set('a', 1);
  assert.throws(() => c.set('b', 2), /max keys/);
});

test('fetch: miss stores, hit returns cached', () => {
  const c = newCache();
  let calls = 0;
  const producer = () => {
    calls += 1;
    return 'val';
  };
  assert.equal(c.fetch('k', producer), 'val');
  assert.equal(c.fetch('k', producer), 'val');
  assert.equal(calls, 1);
});

test('forceString serializes values', () => {
  const c = newCache({ forceString: true });
  c.set('k', { a: 1 });
  assert.equal(c.get('k'), '{"a":1}');
});

// --- клонирование (useClones) ---

test('useClones=true returns an isolated copy', () => {
  const c = newCache();
  const obj = { nested: { n: 1 } };
  c.set('k', obj);
  const got = c.get('k');
  got.nested.n = 999;
  assert.equal(c.get('k').nested.n, 1); // кэш не мутирован
});

test('useClones=false returns the same reference', () => {
  const c = newCache({ useClones: false });
  const obj = { n: 1 };
  c.set('k', obj);
  assert.equal(c.get('k'), obj);
});

test('useClones=true handles objects with methods (vendored clone, not structuredClone)', () => {
  const c = newCache();
  class Widget {
    constructor() {
      this.id = 7;
    }
    label() {
      return `w${this.id}`;
    }
  }
  c.set('k', new Widget());
  const got = c.get('k');
  assert.equal(got.id, 7);
});

test('useClones=true clones circular references', () => {
  const c = newCache();
  const a = { name: 'a' };
  a.self = a;
  c.set('k', a);
  const got = c.get('k');
  assert.equal(got.self, got);
});

// --- события ---

test('emits set / del / expired / flush', async () => {
  const c = newCache();
  const seen = [];
  c.on('set', (k) => seen.push(`set:${k}`));
  c.on('del', (k) => seen.push(`del:${k}`));
  c.on('flush', () => seen.push('flush'));

  c.set('k', 1);
  c.del('k');
  c.flushAll();
  assert.deepEqual(seen, ['set:k', 'del:k', 'flush']);
});

test('emits expired on access after ttl', async () => {
  const c = newCache();
  let expiredKey = null;
  c.on('expired', (k) => {
    expiredKey = k;
  });
  c.set('k', 'v', 0.05);
  await sleep(70);
  c.get('k');
  assert.equal(expiredKey, 'k');
});

// --- прото-безопасность (Map-хранилище) ---

test('__proto__ as a key does not pollute prototypes', () => {
  const c = newCache();
  c.set('__proto__', 'evil');
  assert.equal(c.get('__proto__'), 'evil');
  assert.equal(({}).evil, undefined);
  assert.equal(c.keys().includes('__proto__'), true);
});

test('close stops without error', () => {
  const c = new NodeCache({ checkperiod: 1 });
  c.set('k', 1);
  c.close();
  assert.ok(true);
});
