import fs from 'fs';
import https from 'https';
import http from 'http';
import { createHash } from 'crypto';

const BASES = [
    process.env.CATPAW_RUNTIME_URL,
    'https://raw.githubusercontent.com/Darklessing/catvod/main/douer',
    'https://ghproxy.net/https://raw.githubusercontent.com/Darklessing/catvod/main/douer',
].filter(Boolean);

function download(url, redirects = 0) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        lib
            .get(url, { timeout: 120000 }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
                    download(res.headers.location, redirects + 1).then(resolve, reject);
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                    res.resume();
                    return;
                }
                const chunks = [];
                res.on('data', (c) => chunks.push(c));
                res.on('end', () => resolve(Buffer.concat(chunks)));
            })
            .on('error', reject);
    });
}

async function fetchWithRetry(url, tries = 3) {
    let lastErr;
    for (let i = 0; i < tries; i++) {
        try {
            return await download(url);
        } catch (err) {
            lastErr = err;
            await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
        }
    }
    throw lastErr;
}

async function main() {
    fs.mkdirSync('dist', { recursive: true });
    let jsBuf = null;
    let usedBase = '';

    for (const base of BASES) {
        try {
            console.log(`Fetching runtime from ${base}`);
            jsBuf = await fetchWithRetry(`${base}/index.js`);
            usedBase = base;
            break;
        } catch (err) {
            console.warn(`Failed ${base}: ${err.message}`);
        }
    }

    if (!jsBuf || jsBuf.length < 1000000) {
        throw new Error('Could not download douer index.js (need ~4MB runtime)');
    }

    fs.writeFileSync('dist/index.js', jsBuf);
    const md5 = createHash('md5').update(jsBuf).digest('hex');
    fs.writeFileSync('dist/index.js.md5', md5);
    console.log(`OK ${usedBase} -> index.js ${(jsBuf.length / 1024 / 1024).toFixed(2)} MB md5=${md5}`);
}

main().catch((err) => {
    console.error('fetch-runtime failed:', err.message);
    process.exit(1);
});
