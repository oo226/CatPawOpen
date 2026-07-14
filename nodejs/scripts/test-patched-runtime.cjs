const fs = require('fs');
const path = require('path');
const { createServer } = require('http');

globalThis.catServerFactory = (handle) => createServer(handle);
globalThis.catDartServerPort = () => 0;
process.env.DEV_HTTP_PORT = '3041';

const root = path.join(__dirname, '..');
const cmsSources = [
    { name: '非凡资源', address: 'https://cj.ffzyapi.com/api.php/provide/vod/from/ffm3u8' },
    { name: '量子资源', address: 'https://cj.lziapi.com/api.php/provide/vod/at/json' },
];

const config = {
    ali: { token: '', prefix: '阿里' },
    quark: { cookie: '' },
    uc: { cookie: '', token: '', ut: '' },
    y115: { cookie: '' },
    baidu: { cookie: '' },
    sites: { list: [] },
    pans: { list: [] },
    danmu: { urls: [], autoPush: true, debug: false },
    t4: { list: [] },
    cms: { list: cmsSources },
    customSpiders: { enabled: false, dir: '', urls: [] },
    color: [],
    live2vod: { sources: [], showMode: 'groups', def_pic: '' },
    alist: [],
};

eval(fs.readFileSync(path.join(root, 'dist/index.js'), 'utf8'));

const start = typeof WMr === 'function' ? WMr : typeof lOr === 'function' ? lOr : null;
const stop = typeof $Mr === 'function' ? $Mr : typeof dOr === 'function' ? dOr : null;
if (!start || !stop) {
    console.error('start/stop not found after eval', { WMr: typeof WMr, $Mr: typeof $Mr, lOr: typeof lOr, dOr: typeof dOr });
    process.exit(1);
}

start(config)
    .then(async () => {
        await new Promise((r) => setTimeout(r, 3500));
        const res = await fetch('http://127.0.0.1:3041/config');
        const data = await res.json();
        const sites = data.video?.sites || [];
        const cms = sites.filter((s) => s.cms || (s.name || '').includes('采'));
        cms.forEach((s) => console.log(`  ${s.key} | ${s.name} | cms=${s.cms}`));
        const dytt = sites.filter((s) => (s.name || '').includes('电影天堂'));
        console.log('cms count:', cms.length, '电影天堂 count:', dytt.length);
        await stop();
        process.exit(cms.length === 1 && dytt.length === 0 ? 0 : 2);
    })
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
