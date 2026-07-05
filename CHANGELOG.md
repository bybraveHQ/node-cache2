# Changelog

Maintained fork of [node-cache/node-cache](https://github.com/node-cache/node-cache). All notable changes to this fork are documented here.

## 6.0.0 — 2026-07-05

First release of the maintained `@bybrave/node-cache2` fork. Drop-in replacement for `node-cache`.

### Added
- Modern ESM class implementation, rewritten from the original CoffeeScript source (#69).
- Generic TypeScript types `NodeCache<T>` with per-call generic overrides preserved (#273).
- Dual ESM + CJS distribution (esbuild footer) so both `import` and `require` work.

### Fixed
- Map-backed storage instead of a plain object, improving performance and providing prototype-pollution safety, including `__proto__` keys (#212, #286).
- Vendored the `clone` dependency into `lib/clone.js`, bringing the runtime dependency count to zero (#230).
- Numeric keys are normalized to strings to match the original object-coercion semantics: `set(5)` is retrievable via `get('5')`, and `keys()` returns strings.

### Unchanged
- Full original API surface: `get`, `set`, `mget`, `mset`, `fetch`, `del`, `take`, `ttl`, `getTtl`, `keys`, `has`, `getStats`, `flushAll`, and the `EventEmitter` events.
- `useClones: true` clone isolation behavior, fully compatible with functions, classes, and circular references.
- `maxKeys` enforcement still throws `ECACHEFULL` — eviction / LRU (#232), wildcards (#255), and the Map interface (#292) remain out of scope.
