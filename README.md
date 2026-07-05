# @bybrave/node-cache2

Maintained fork of [`node-cache`](https://www.npmjs.com/package/node-cache) — simple and fast in-memory caching.

Rewritten from CoffeeScript to modern **ESM**, **zero runtime dependencies**, **Map-backed** storage, dual **ESM + CommonJS**, and **generic TypeScript types**. Same API.

## Install

```sh
npm install @bybrave/node-cache2
```

## Usage

```js
import NodeCache from '@bybrave/node-cache2';

const cache = new NodeCache({ stdTTL: 100, checkperiod: 120 });

cache.set('myKey', { any: 'value' });
cache.get('myKey'); // { any: 'value' }
```

CommonJS works too — `require` returns the class directly:

```js
const NodeCache = require('@bybrave/node-cache2');
```

### Typed cache (#273)

The class takes an optional type parameter, so a typed cache infers `get`/`set`/`take` without per-call generics:

```ts
import NodeCache from '@bybrave/node-cache2';

interface User { id: number; name: string; }

const users = new NodeCache<User>();
users.set('u1', { id: 1, name: 'Ann' });
const u = users.get('u1'); // User | undefined
```

The full API — `get`, `mget`, `set`, `mset`, `fetch`, `del`, `take`, `ttl`, `getTtl`, `keys`, `has`, `getStats`, `flushAll`, `flushStats`, `close`, and the `set`/`del`/`expired`/`flush`/`flush_stats` events — is unchanged from `node-cache`.

### Options

`stdTTL`, `checkperiod`, `useClones`, `deleteOnExpire`, `forceString`, `maxKeys`, `enableLegacyCallbacks` — same defaults and meaning as node-cache.

## What's changed vs `node-cache@5.1.2`

| Issue | Change |
|---|---|
| [#69](https://github.com/node-cache/node-cache/issues/69) | Rewritten from CoffeeScript to modern ESM. Ships native ESM with a CommonJS build via the `exports` map. |
| [#212](https://github.com/node-cache/node-cache/issues/212), [#286](https://github.com/node-cache/node-cache/issues/286) | Storage is backed by a `Map` instead of a plain object — prototype-safe (a `__proto__` key is just a key) and faster for churny caches. |
| [#273](https://github.com/node-cache/node-cache/issues/273) | The class is generic: `new NodeCache<MyType>()` types `get`/`set`/`take`/`mget`. Per-call type parameters still work. |
| [#230](https://github.com/node-cache/node-cache/issues/230) | Zero runtime dependencies — `clone` is vendored and maintained in-tree, so there is no transitive dependency to audit. |

## Migration from `node-cache`

Drop-in — replace the import:

```diff
- const NodeCache = require('node-cache');
+ const NodeCache = require('@bybrave/node-cache2');
```

The public API and option defaults are unchanged. Notes for edge cases:

- `keys()` still returns strings, and numeric/string keys still address the same entry (`set(5, …)` then `get('5')`), matching the original object-backed behaviour.
- With `useClones: true` (the default), values are deep-cloned with the vendored `clone`, so objects with methods, circular references, `Map`/`Set`/`Date`/`RegExp`/`Buffer` all clone the same way as before.

## License

MIT. Copyright © mpneuried; vendored clone © Paul Vorbach, Blake Miner; fork © bybrave.
