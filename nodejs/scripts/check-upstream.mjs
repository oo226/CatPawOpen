/**
 * 检测上游 douer 是否有更新（只检测，不自动合入）。
 *
 * npm run vendor:check
 * 退出码: 0=一致, 2=有更新, 1=检测失败
 */
import fs from 'fs';
import https from 'https';
import http from 'http';
import { createHash } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const vendorMd5Path = path.join(root, 'vendor/douer/index.js.md5');

const MD5_URLS = [
    'https://raw.githubusercontent.com/Darklessing/catvod/main/douer/index.js.md5',
    'https://ghfast.top/https://raw.githubusercontent.com/Darklessing/catvod/main/douer/index.js.md5',
];

const JS_URLS = [
    'https://raw.githubusercontent.com/Darklessing/catvod/main/douer/index.js',
    'https://ghfast.top/https://raw.githubusercontent.com/Darklessing/catvod/main/douer/index.js',
];

function fetchUrl(url, timeout = 60000) {
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

async function fetchFirst(urls, timeout) {
    let lastErr;
    for (const url of urls) {
        try {
            const buf = await fetchUrl(url, timeout);
            return { buf, url };
        } catch (e) {
            lastErr = e;
            console.warn(`failed ${url}: ${e.message}`);
        }
    }
    throw lastErr || new Error('all urls failed');
}

function normalizeMd5(s) {
    return String(s || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-f0-9]/g, '');
}

async function main() {
    const local = normalizeMd5(fs.existsSync(vendorMd5Path) ? fs.readFileSync(vendorMd5Path, 'utf8') : '');
    if (!local || local.length !== 32) {
        console.error('local vendor md5 missing or invalid');
        process.exit(1);
    }

    let remote = '';
    try {
        const { buf, url } = await fetchFirst(MD5_URLS, 30000);
        remote = normalizeMd5(buf.toString('utf8'));
        console.log(`remote md5 file via ${url}: ${remote}`);
    } catch {
        console.warn('md5 file fetch failed, hashing index.js instead');
        const { buf, url } = await fetchFirst(JS_URLS, 180000);
        remote = createHash('md5').update(buf).digest('hex');
        console.log(`remote index.js via ${url}: ${remote} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
    }

    if (!remote || remote.length !== 32) {
        console.error('could not resolve upstream md5');
        process.exit(1);
    }

    console.log(`local:  ${local}`);
    console.log(`remote: ${remote}`);

    const changed = local !== remote;
    if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(
            process.env.GITHUB_OUTPUT,
            `local=${local}\nremote=${remote}\nchanged=${changed ? 'true' : 'false'}\n`
        );
    }

    if (!changed) {
        console.log('upstream: unchanged');
        process.exit(0);
    }

    console.log('upstream: UPDATED — do NOT auto-merge; minify symbols may break CMS patches.');
    console.log('next: npm run vendor:refresh && adapt nodejs/scripts/copy-runtime.mjs anchors, then build/test.');
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
