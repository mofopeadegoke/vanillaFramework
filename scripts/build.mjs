// Builds src/ into dist/: compiles Sass and copies static files.
// `--watch` rebuilds on change and serves dist/ at http://localhost:3000.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, watch, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import * as sass from 'sass';

const root = resolve(import.meta.dirname, '..');
const src = join(root, 'src');
const dist = join(root, 'dist');
const watchMode = process.argv.includes('--watch');

function buildCss() {
  const result = sass.compile(join(src, 'scss', 'main.scss'), {
    loadPaths: [join(root, 'node_modules')],
    style: watchMode ? 'expanded' : 'compressed',
    // Vanilla still uses @import and global built-ins; silence noise from the dependency.
    quietDeps: true,
    silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
  });
  mkdirSync(join(dist, 'css'), { recursive: true });
  writeFileSync(join(dist, 'css', 'main.css'), result.css);
}

function copyStatic() {
  cpSync(src, dist, {
    recursive: true,
    filter: (path) => !path.startsWith(join(src, 'scss')),
  });
}

function build({ clean = false } = {}) {
  const started = performance.now();
  if (clean) rmSync(dist, { recursive: true, force: true });
  copyStatic();
  buildCss();
  console.log(`Built dist/ in ${Math.round(performance.now() - started)}ms`);
}

function safeBuild() {
  try {
    build();
  } catch (error) {
    console.error(error.message);
  }
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

function serve(port = 3000) {
  createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = normalize(join(dist, urlPath));
    if (!file.startsWith(dist)) {
      res.writeHead(403).end();
      return;
    }
    if (urlPath.endsWith('/')) file = join(file, 'index.html');
    if (!existsSync(file)) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  }).listen(port, () => console.log(`Serving dist/ at http://localhost:${port}`));
}

build({ clean: true });

if (watchMode) {
  let timer;
  watch(src, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(safeBuild, 100);
  });
  serve(Number(process.env.PORT) || 3000);
}
