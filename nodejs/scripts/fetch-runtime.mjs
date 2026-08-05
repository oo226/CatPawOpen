/**
 * 从上游下载 douer 引擎到 vendor/douer/（仅更新时用，日常 build 不跑此脚本）
 *
 * npm run vendor:refresh
 * 可选:
 *   CATPAW_RUNTIME_URL=https://.../index.js
 *   EXPECTED_MD5=<32hex>   — 与 check-upstream 结果一致时才写入
 *
 * 失败时不覆盖已有 vendor（原子写入）。上游删库时本脚本失败，本地快照仍可用。
 */
import fs from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    UPSTREAM_JS_URLS,
    MIN_RUNTIME_BYTES,
    normalizeMd5,
    fetchUrl,
} from './upstream-source.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const vendorDir = path.join(root, 'vendor/douer');
const vendorJs = path.join(vendorDir, 'index.js');
const vendorMd5 = path.join(vendorDir, 'index.js.md5');

async function main() {
    const urls = process.env.CATPAW_RUNTIME_URL
        ? [process.env.CATPAW_RUNTIME_URL]
        : UPSTREAM_JS_URLS;
    const expected = normalizeMd5(process.env.EXPECTED_MD5 || '');

    let prevBytes = 0;
    if (fs.existsSync(vendorJs)) {
        prevBytes = fs.statSync(vendorJs).size;
    }

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

    if (!buf) {
        console.error('Could not download runtime — local vendor left untouched.');
        process.exit(1);
    }
    if (buf.length < MIN_RUNTIME_BYTES) {
        console.error(
            `Downloaded runtime too small (${buf.length} bytes < ${MIN_RUNTIME_BYTES}) — refusing to overwrite vendor.`
        );
        process.exit(1);
    }
    // 防截断：新包不应比现有快照小太多（除非首次安装）
    if (prevBytes > MIN_RUNTIME_BYTES && buf.length < Math.floor(prevBytes * 0.5)) {
        console.error(
            `Downloaded runtime suspiciously small vs local (${buf.length} vs ${prevBytes}) — refusing to overwrite.`
        );
        process.exit(1);
    }

    const md5 = createHash('md5').update(buf).digest('hex').toLowerCase();
    if (expected && expected !== md5) {
        console.error(`md5 mismatch: expected=${expected} got=${md5} — refusing to overwrite vendor.`);
        process.exit(1);
    }

    fs.mkdirSync(vendorDir, { recursive: true });
    const tmpJs = `${vendorJs}.tmp`;
    const tmpMd5 = `${vendorMd5}.tmp`;
    fs.writeFileSync(tmpJs, buf);
    fs.writeFileSync(tmpMd5, md5);
    fs.renameSync(tmpJs, vendorJs);
    fs.renameSync(tmpMd5, vendorMd5);

    console.log(`saved vendor/douer/index.js (${(buf.length / 1024 / 1024).toFixed(2)} MB, md5=${md5})`);
    console.log(`source: ${from}`);
    console.log('commit vendor/douer/ then run npm run build');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
