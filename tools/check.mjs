import { readFile, readdir } from 'node:fs/promises';
import { resolve, extname, sep, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { WEEK_NUMBERS, buildCatalog } from '../dist/src/domain/content.js';
const root = resolve('dist'), decoder = new TextDecoder('utf-8', { fatal: true });
let count = 0;
async function walk(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = resolve(folder, entry.name);
    assert(!entry.isSymbolicLink(), 'No deployed symlinks');
    if (entry.isDirectory()) { await walk(path); continue; }
    assert(!/\.pdf$|\.env|\.map$|backup|secret/i.test(entry.name) || entry.name === 'backup.js', 'Unexpected public artifact');
    const buffer = await readFile(path); count++;
    if (!['.js', '.json', '.html', '.css', '.svg'].includes(extname(path))) continue;
    assert(!(buffer[0] === 239 && buffer[1] === 187 && buffer[2] === 191), `BOM: ${path}`);
    const source = decoder.decode(buffer); assert(!source.includes('\uFFFD'), `Replacement character: ${path}`);
    if (path.endsWith('.js')) { execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' }); assert(!/\beval\s*\(|new Function\s*\(|\.innerHTML\s*=|document\.write\s*\(/.test(source), 'Unsafe code execution or HTML sink'); }
    if (path.endsWith('.html')) {
      assert(source.includes('lang="ko"') && source.includes('name="viewport"'));
      assert(source.includes("connect-src 'self'") && source.includes("object-src 'none'"));
      assert(!/\son\w+=|<iframe\b|<script(?![^>]*\bsrc=)/i.test(source), 'Unexpected inline execution');
      for (const [, ref] of source.matchAll(/(?:src|href)="([^"#]+)"/g)) {
        if (/^(https?:|data:)/.test(ref)) continue;
        const target = resolve(dirname(path), ref); assert(target.startsWith(root + sep)); await readFile(target);
      }
    }
  }
}
await walk(root);
const weeks = await Promise.all(WEEK_NUMBERS.map(n => readFile(resolve(root, `content/week-${String(n).padStart(2, '0')}.json`), 'utf8').then(JSON.parse)));
const catalog = buildCatalog(weeks);
console.log(`PASS: ${count} public files; ${weeks.length} weeks; ${catalog.objectives.length} objectives; ${catalog.questions.length} questions; ${catalog.corrections.length} corrections. Syntax, UTF-8, safe DOM, source-page schema and assets checked.`);
