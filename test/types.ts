// Компилируется в CI (npm run test-types) — проверяет типы, включая generic (#273).
import NodeCache from '../index.js';

interface User {
  id: number;
  name: string;
}

// #273: типизированный кэш — get/set/take работают с User без явного параметра.
const users = new NodeCache<User>({ stdTTL: 60 });
users.set('u1', { id: 1, name: 'Ann' });
const u: User | undefined = users.get('u1');
const taken: User | undefined = users.take('u1');
users.mset([{ key: 'u2', val: { id: 2, name: 'Bo' }, ttl: 30 }]);
const many: { [key: string]: User } = users.mget(['u1', 'u2']);

// Нетипизированный кэш + per-call generic по-прежнему работает.
const generic = new NodeCache();
const s = generic.get<string>('k');
generic.set<number>('n', 5);

const ok: boolean = users.has('u1');
const n: number = users.del('u1');
const keys: string[] = users.keys();
const ttl: number | undefined = users.getTtl('u2');
const stats = users.getStats();

users.on('set', (key, value: User) => {
  void [key, value];
});

void [u, taken, many, s, ok, n, keys, ttl, stats];
