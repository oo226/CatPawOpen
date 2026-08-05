/**
 * 上游 douer 地址与下载工具（check / fetch 共用）。
 * 手机实际加载的是本仓库 dist，不依赖上游在线；
 * 上游只用于「可选自动更新」vendor 快照。
 */
import https from 'https';
import http from 'http';

export const UPSTREAM_MD5_URLS = [
    'https://raw.githubusercontent.com/Darklessing/catvod/main/douer/index.js.md5',
    'https://ghfast.top/https://raw.githubusercontent.com/Darklessing/catvod/main/douer/index.js.md5',
    'https://ghproxy.net/https://raw.githubusercontent.com/Darklessing/catvod/main/douer/index.js.md5',
];

export const UPSTREAM_JS_URLS = [
    'https://raw.githubusercontent.com/Darklessing/catvod/main/douer/index.js',
    'https://ghfast.top/https://raw.githubusercontent.com/Darklessing/catvod/main/douer/index.js',
    'https://ghproxy.net/https://raw.githubusercontent.com/Darklessing/catvod/main/douer/index.js',
];

/** 过小几乎一定是错误页/截断，拒绝覆盖本地 vendor */
export const MIN_RUNTIME_BYTES = 1_000_000;

export function normalizeMd5(s) {
    return String(s || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-f0-9]/g, '');
}

export function fetchUrl(url, timeout = 60000) {
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

export async function fetchFirst(urls, timeout) {
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
