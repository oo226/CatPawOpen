/**
 * 从上游下载 douer 引擎到 vendor/douer/（仅手动更新时用，日常 build 不跑此脚本）
 *
 * npm run vendor:refresh
 * 可选: CATPAW_RUNTIME_URL=https://.../index.js
 */
import fs from 'fs';
import https from 'https';
import http from 'http';
import { createHash } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const vendorDir = path.join(root, 'vendor/douer');
const vendorJs = path.join(vendorDir, 'index.js');
const vendorMd5 = path.join(vendorDir, 'index.js.md5');

const DEFAULT_URLS = [
    'https://raw.githubusercontent.com/Darklessing/catvod/main/douer/index.js',
    'https://ghproxy.net/https://raw.githubusercontent.com/Darklessing/catvod/main/douer/index.js',
];

function fetchUrl(url, timeout = 120000) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const req = mod.get(url, { timeout }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchUrl(res.headers.location, timeout).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`timeout: ${url}`));
        });
    });
}

async function main() {
    const urls = process.env.CATPAW_RUNTIME_URL
        ? [process.env.CATPAW_RUNTIME_URL]
        : DEFAULT_URLS;

    let buf = null;
    let from = '';
    for (const url of urls) {
        try {
            console.log(`fetching ${url} ...`);
            buf = await fetchUrl(url, 600000);
            from = url;
            break;
        } catch (e) {
            console.warn(`failed: ${e.message}`);
        }
    }
    if (!buf || buf.length < 100000) {
        console.error('Could not download runtime (need ~4MB index.js)');
        process.exit(1);
    }

    fs.mkdirSync(vendorDir, { recursive: true });
    fs.writeFileSync(vendorJs, buf);
    const md5 = createHash('md5').update(buf).digest('hex').toLowerCase();
    fs.writeFileSync(vendorMd5, md5);

    console.log(`saved vendor/douer/index.js (${(buf.length / 1024 / 1024).toFixed(2)} MB, md5=${md5})`);
    console.log(`source: ${from}`);
    console.log('commit vendor/douer/ then run npm run build');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
