import req from '../../util/req.js';
import { folderPic } from '../../util/panHttp.js';

const DEFAULT_PANS = [
    { name: 'PanSou', address: 'https://so.252035.xyz' },
    { name: '趣盘搜', address: 'https://api.funletu.com' },
];

let sources = [];

async function init(inReq, _outResp) {
    const list = inReq.server.config?.pans?.list || [];
    sources = list.length ? [...list] : [...DEFAULT_PANS];
    const tg = inReq.server.config?.tgsou;
    if (tg?.url) {
        sources.push({ name: 'TG搜', address: tg.url });
    }
    return {};
}

async function searchPan(base, wd) {
    const url = base.replace(/\/$/, '');
    if (url.includes('252035') || url.includes('pansou')) {
        const res = await req.get(`${url}/api/search`, {
            params: { kw: wd, cloud_types: ['quark', 'aliyun', 'uc', '115'], res: 'merge' },
            timeout: 15000,
        });
        const merged = res.data?.data?.merged_by_type || {};
        const out = [];
        for (const type of Object.keys(merged)) {
            for (const item of merged[type] || []) {
                out.push({
                    name: `[${type}] ${item.note || item.title || wd}`,
                    path: item.url || item.link || '',
                    type: 10,
                    thumb: folderPic(),
                    remark: item.source || type,
                });
            }
        }
        return out;
    }
    try {
        const res = await req.get(url, { params: { wd, q: wd, keyword: wd }, timeout: 12000 });
        const data = res.data;
        if (Array.isArray(data)) {
            return data.map((item) => ({
                name: item.name || item.title || item.note || wd,
                path: item.url || item.link || item.shareurl || '',
                type: 10,
                thumb: folderPic(),
                remark: item.remark || '',
            }));
        }
        if (data?.list) {
            return data.list.map((item) => ({
                name: item.name || item.title || item.note || wd,
                path: item.url || item.link || item.shareurl || '',
                type: 10,
                thumb: folderPic(),
                remark: item.remark || '',
            }));
        }
    } catch {
        /* ignore */
    }
    return [];
}

async function dir(inReq, _outResp) {
    const dirPath = inReq.body.path || '/';
    const pg = inReq.body.page || 1;

    if (dirPath === '/' || dirPath === '') {
        return {
            parent: '/',
            page: pg,
            pagecount: pg,
            list: sources.map((s) => ({
                name: s.name,
                path: `/${encodeURIComponent(s.name)}/`,
                type: 0,
                thumb: folderPic(),
            })),
        };
    }

    const m = dirPath.match(/^\/([^/]+)\/?$/);
    if (m) {
        const name = decodeURIComponent(m[1]);
        const src = sources.find((s) => s.name === name);
        if (src) {
            return {
                parent: dirPath,
                page: pg,
                pagecount: pg,
                list: [{ name: '在此源搜索：输入关键词到搜索框', path: dirPath, type: 0, thumb: folderPic() }],
            };
        }
    }

    return { parent: dirPath, page: pg, pagecount: pg, list: [] };
}

async function search(inReq, _outResp) {
    const wd = inReq.body.wd;
    const pg = inReq.body.page || 1;
    const list = [];
    for (const src of sources) {
        try {
            const items = await searchPan(src.address, wd);
            list.push(...items);
        } catch {
            /* ignore */
        }
    }
    return { page: pg, pagecount: 1, total: list.length, list: list.slice(0, 100) };
}

async function file(inReq, _outResp) {
    const path = inReq.body.path;
    return {
        name: path,
        url: path.startsWith('http') ? path : '',
        size: '',
        remark: '网盘分享链接，请用对应网盘源打开',
        header: {},
        extra: { subt: [] },
    };
}

export default {
    meta: { key: 'pans', name: '搜盘', type: 40 },
    api: async (fastify) => {
        fastify.post('/init', init);
        fastify.post('/dir', dir);
        fastify.post('/search', search);
        fastify.post('/file', file);
    },
};
