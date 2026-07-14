import fs from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const vendorJs = path.join(root, 'vendor/douer/index.js');
const vendorMd5 = path.join(root, 'vendor/douer/index.js.md5');
const hubCjs = path.join(root, 'dist/cmshub.cjs');
const distDir = path.join(root, 'dist');
const distJs = path.join(distDir, 'index.js');
const distMd5 = path.join(distDir, 'index.js.md5');

// douer 2026-07-14 minify symbols (was Hce/Vce/Fce/FIr/H0t)
const CMS_FOREACH = '(await Wde(t)).forEach(o=>{r.push(Fde(o.name,o.address))});';
const CMS_FOREACH_PATCH = '(await Wde(t)).length>0&&r.push(__catpawCmshub);';

const HCE_FALLBACK = 'return Dde(r.length>0?r:JDr)';
const HCE_FALLBACK_PATCH = 'return Dde(r)';

const SERVER_ANCHOR = 'var oxt=Object.create';

if (!fs.existsSync(vendorJs)) {
    console.error('Missing vendor/douer/index.js — run: npm run vendor:refresh');
    process.exit(1);
}
if (!fs.existsSync(hubCjs)) {
    console.error('Missing dist/cmshub.cjs — run: node esbuild-cmshub.js');
    process.exit(1);
}

const pinned = fs.existsSync(vendorMd5) ? fs.readFileSync(vendorMd5, 'utf8').trim().toLowerCase() : '';
const vendorBuf = fs.readFileSync(vendorJs);
const vendorHash = createHash('md5').update(vendorBuf).digest('hex');
if (pinned && pinned !== vendorHash) {
    console.error(`vendor md5 mismatch: file=${vendorHash} pinned=${pinned}`);
    console.error('Run: npm run vendor:refresh');
    process.exit(1);
}

let runtime = fs.readFileSync(vendorJs, 'utf8');
const hubBody = fs.readFileSync(hubCjs, 'utf8').replace(/\s+/g, ' ').trim();
const hubCode = `(function(){var module={exports:{}};var exports=module.exports;${hubBody}return module.exports.default||module.exports;})()`;

if (!runtime.includes(CMS_FOREACH)) {
    console.error('vendor patch failed: CMS foreach anchor not found');
    process.exit(1);
}
if (!runtime.includes(HCE_FALLBACK)) {
    console.error('vendor patch failed: Hce fallback anchor not found');
    process.exit(1);
}
if (!runtime.includes(SERVER_ANCHOR)) {
    console.error('vendor patch failed: server bundle anchor not found');
    process.exit(1);
}

runtime = runtime.replace(SERVER_ANCHOR, `var __catpawCmshub=${hubCode};${SERVER_ANCHOR}`);
runtime = runtime.replace(CMS_FOREACH, CMS_FOREACH_PATCH);
runtime = runtime.replace(HCE_FALLBACK, HCE_FALLBACK_PATCH);

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(distJs, runtime);

const md5 = createHash('md5').update(runtime).digest('hex');
fs.writeFileSync(distMd5, md5);

console.log(
    `runtime patched: vendor douer + cmshub inject (${(runtime.length / 1024 / 1024).toFixed(2)} MB, md5=${md5})`
);
