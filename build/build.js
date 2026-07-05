// CJS-бандл из ESM-исходника. Footer разворачивает default в module.exports,
// чтобы require('@bybrave/node-cache2') отдавал класс напрямую — как оригинал.
import { build } from 'esbuild';

await build({
  entryPoints: ['index.js'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  outfile: 'dist/index.cjs',
  footer: {
    js: 'module.exports = module.exports.default;',
  },
});

console.log('built dist/index.cjs');
