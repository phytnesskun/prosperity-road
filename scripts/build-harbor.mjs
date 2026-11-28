// Build the same street game as a single file for offline classroom computers.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
  root, configFile: false, publicDir: false,
  build: {
    write: false, target: 'es2022', minify: true,
    lib: { entry: path.join(root, 'src/harbor/offline.ts'), name: 'FogHarbor', formats: ['iife'] },
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
const files = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output);
if (files.length !== 1 || files[0].type !== 'chunk') throw new Error('The offline game must be one script.');
const script = files[0].code.replace(/<\/script/gi, '<\\/script');
const theme = await readFile(path.join(root, 'public/audio/town-theme.mp3'));
function page(chapter, title) { return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'">
<meta name="theme-color" content="#152622"><title>${title} · 繁荣之路</title>
</head><body data-chapter="${chapter}"><div id="app"></div><noscript>请启用 JavaScript 以游玩。</noscript>
<script id="harbor-theme" type="audio/mpeg">${theme.toString('base64')}</script>
<script>${script}</script></body></html>`; }
await mkdir(path.join(root, 'dist'), { recursive: true });
await writeFile(path.join(root, 'dist/fog-harbor.html'), page('harbor', '雾港的最后一炉'));
await writeFile(path.join(root, 'dist/rice-market.html'), page('rice', '谁把西岸的粮买空了？'));
await writeFile(path.join(root, 'dist/fog-harbor-journeys.html'), page('mill', '风起磨坊'));
await writeFile(path.join(root, 'dist/first-ferry.html'), page('morning', '雾港第一班早船'));
await writeFile(path.join(root, 'dist/harbor-season.html'), page('ch7', '桥开那天'));
console.log('Built five standalone entry files for all twenty harbor chapters.');
