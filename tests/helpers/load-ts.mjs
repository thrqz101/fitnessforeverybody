// Minimal TypeScript module loader for tests: transpiles on the fly and resolves extensionless relative
// imports and the "@/" alias, so library code can be tested without a bundler.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(new URL('../../', import.meta.url).pathname);
const cache = new Map();

function resolveFile(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`Cannot resolve ${base}`);
}

export function loadTs(file) {
  const full = resolveFile(path.resolve(file));
  if (cache.has(full)) return cache.get(full).exports;
  const module = { exports: {} };
  cache.set(full, module);
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const requireFrom = (id) => {
    if (id.startsWith('@/')) return loadTs(path.join(root, 'src', id.slice(2)));
    if (id.startsWith('.')) return loadTs(path.resolve(path.dirname(full), id));
    throw new Error(`Unsupported import "${id}" in ${full}`);
  };
  new Function('exports', 'require', 'module', code)(module.exports, requireFrom, module);
  return module.exports;
}

export const lib = (name) => loadTs(path.join(root, 'src', name));
