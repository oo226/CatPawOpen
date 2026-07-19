/**
 * 将 vendor/douer 原样复制到 dist/（不再打 cmshub 补丁）。
 * 上游更新可直接 vendor:refresh 后构建，无需改锚点。
 */
import fs from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const vendorJs = path.join(root, 'vendor/douer/index.js');
const vendorMd5 = path.join(root, 'vendor/douer/index.js.md5');
const distDir = path.join(root, 'dist');
const distJs = path.join(distDir, 'index.js');
const distMd5 = path.join(distDir, 'index.js.md5');

if (!fs.existsSync(vendorJs)) {
    console.error('Missing vendor/douer/index.js — run: npm run vendor:refresh');
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

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(distJs, vendorBuf);
fs.writeFileSync(distMd5, vendorHash);

console.log(
    `runtime copied: vendor douer (${(vendorBuf.length / 1024 / 1024).toFixed(2)} MB, md5=${vendorHash})`
);
