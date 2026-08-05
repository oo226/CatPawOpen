/**
 * 检测上游 douer 是否有更新。
 *
 * npm run vendor:check
 * 退出码: 0=检测完成（含「上游不可达，保留本地」）, 1=本地 vendor 损坏
 *
 * CI 通过 GITHUB_OUTPUT 读取 changed/local/remote/reachable。
 * 上游删库/网络失败时：reachable=false, changed=false，不打断日常构建；
 * 手机继续用本仓库已固化的 vendor/dist。
 */
import fs from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    UPSTREAM_MD5_URLS,
    UPSTREAM_JS_URLS,
    MIN_RUNTIME_BYTES,
    normalizeMd5,
    fetchFirst,
} from './upstream-source.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const vendorJsPath = path.join(root, 'vendor/douer/index.js');
const vendorMd5Path = path.join(root, 'vendor/douer/index.js.md5');

function writeOutputs(obj) {
    if (!process.env.GITHUB_OUTPUT) return;
    const lines = Object.entries(obj).map(([k, v]) => `${k}=${v}`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
}

function localVendorOk() {
    if (!fs.existsSync(vendorJsPath) || !fs.existsSync(vendorMd5Path)) {
        return { ok: false, reason: 'missing vendor/douer/index.js or .md5' };
    }
    const pinned = normalizeMd5(fs.readFileSync(vendorMd5Path, 'utf8'));
    if (!pinned || pinned.length !== 32) {
        return { ok: false, reason: 'invalid local md5 pin' };
    }
    const buf = fs.readFileSync(vendorJsPath);
    if (buf.length < MIN_RUNTIME_BYTES) {
        return { ok: false, reason: `local vendor too small (${buf.length} bytes)` };
    }
    const actual = createHash('md5').update(buf).digest('hex');
    if (actual !== pinned) {
        return { ok: false, reason: `local md5 mismatch file=${actual} pinned=${pinned}` };
    }
    return { ok: true, local: pinned, bytes: buf.length };
}

async function resolveRemote() {
    try {
        const { buf, url } = await fetchFirst(UPSTREAM_MD5_URLS, 30000);
        const remote = normalizeMd5(buf.toString('utf8'));
        if (remote.length === 32) {
            console.log(`remote md5 file via ${url}: ${remote}`);
            return remote;
        }
        console.warn(`md5 file malformed via ${url}: ${JSON.stringify(buf.toString('utf8').slice(0, 80))}`);
    } catch (e) {
        console.warn(`md5 file fetch failed: ${e.message}`);
    }

    console.warn('falling back to hashing remote index.js');
    const { buf, url } = await fetchFirst(UPSTREAM_JS_URLS, 180000);
    if (buf.length < MIN_RUNTIME_BYTES) {
        throw new Error(`remote index.js too small (${buf.length} bytes) via ${url}`);
    }
    const remote = createHash('md5').update(buf).digest('hex');
    console.log(`remote index.js via ${url}: ${remote} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
    return remote;
}

async function main() {
    const local = localVendorOk();
    if (!local.ok) {
        console.error(`local vendor broken: ${local.reason}`);
        writeOutputs({ local: '', remote: '', changed: 'false', reachable: 'false' });
        process.exit(1);
    }

    console.log(`local:  ${local.local} (${(local.bytes / 1024 / 1024).toFixed(2)} MB)`);

    let remote = '';
    try {
        remote = await resolveRemote();
    } catch (e) {
        console.warn(`upstream unreachable: ${e.message}`);
        console.warn('keeping pinned vendor — phone/dist still work offline from this repo.');
        if (process.env.GITHUB_ACTIONS === 'true') {
            console.log('::warning title=Upstream unreachable::Could not reach Darklessing/catvod; kept local vendor snapshot.');
        }
        writeOutputs({
            local: local.local,
            remote: '',
            changed: 'false',
            reachable: 'false',
        });
        process.exit(0);
    }

    if (!remote || remote.length !== 32) {
        console.warn('could not resolve upstream md5; treating as unreachable');
        writeOutputs({
            local: local.local,
            remote: '',
            changed: 'false',
            reachable: 'false',
        });
        process.exit(0);
    }

    console.log(`remote: ${remote}`);
    const changed = local.local !== remote;
    writeOutputs({
        local: local.local,
        remote,
        changed: changed ? 'true' : 'false',
        reachable: 'true',
    });

    if (!changed) {
        console.log('upstream: unchanged');
        process.exit(0);
    }

    console.log('upstream: UPDATED — CI will vendor:refresh, commit, build, and deploy dist.');
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
