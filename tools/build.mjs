import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
await build({stdin:{contents:"export {createClient,BetterAuthVanillaAdapter} from '@neondatabase/neon-js';",resolveDir:process.cwd(),sourcefile:'neon-sdk-entry.js'},bundle:true,format:'esm',platform:'browser',target:['es2022'],minify:true,legalComments:'eof',sourcemap:false,outfile:'dist/vendor/neon.js',define:{'process.env.NODE_ENV':'"production"'}});
const bundle=await readFile('dist/vendor/neon.js','utf8');
await writeFile('dist/vendor/neon.js',bundle.replace(/\r?\n/g,'\r\n'),'utf8');
console.log('Bundled pinned Neon browser SDK; no environment values embedded.');
