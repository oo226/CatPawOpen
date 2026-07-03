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

fs.mkdirSync(distDir, { recursive: true });
const buf = fs.readFileSync(vendorJs);
fs.writeFileSync(distJs, buf);

const md5 = createHash('md5').update(buf).digest('hex');
const pinned = fs.existsSync(vendorMd5) ? fs.readFileSync(vendorMd5, 'utf8').trim() : '';
if (pinned && pinned !== md5) {
    console.error(`vendor md5 mismatch: file=${md5} pinned=${pinned}`);
    console.error('Run: npm run vendor:refresh');
    process.exit(1);
}
fs.writeFileSync(distMd5, md5);

console.log(`runtime copied from vendor/douer/index.js (${(buf.length / 1024 / 1024).toFixed(2)} MB, md5=${md5})`);
