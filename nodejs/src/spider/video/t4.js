import req from '../../util/req.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function baseUrl(inReq) {
    return String(inReq.body.ext || inReq.body.flag || '').trim().replace(/\/$/, '');
}

function isTvboxApi(url) {
    return /api\.php/i.test(url) || /\/tvbox/i.test(url);
}

async function tvboxGet(url, params) {
    const resp = await req.get(url, { params, headers: { 'User-Agent': UA }, timeout: 20000 });
    return resp.data;
}

async function catvodProxy(base, endpoint, body) {
    const cfg = await req.get(`${base}/config`, { timeout: 15000 });
    const site = cfg.data?.video?.sites?.[0];
    if (!site?.api) throw new Error('no catvod site');
    const resp = await req.post(`${base}${site.api}${endpoint}`, { data: body, timeout: 20000 });
    return resp.data;
}

async function init(_inReq, _outResp) {
    return {};
}

async function home(inReq, _outResp) {
    const base = baseUrl(inReq);
    if (!base) return { class: [] };

    if (isTvboxApi(base)) {
        const data = await tvboxGet(base, { ac: 'list', pg: 1 });
        if (data.class) {
            return {
                class: data.class.map((c) => ({
                    type_id: String(c.type_id),
                    type_name: String(c.type_name),
                })),
            };
        }
        if (Array.isArray(data.list)) {
            return {
                class: [{ type_id: '1', type_name: '全部' }],
                list: data.list.map((v) => ({
                    vod_id: String(v.vod_id),
                    vod_name: String(v.vod_name),
                    vod_pic: v.vod_pic,
                    vod_remarks: v.vod_remarks || '',
                })),
            };
        }
    }

    try {
        return await catvodProxy(base, '/home', {});
    } catch {
        return { class: [{ type_id: '1', type_name: '全部' }] };
    }
}

async function category(inReq, _outResp) {
    const base = baseUrl(inReq);
    const tid = inReq.body.id;
    let page = inReq.body.page || 1;
    if (page == 0) page = 1;

    if (isTvboxApi(base)) {
        const data = await tvboxGet(base, { ac: 'detail', t: tid, pg: page });
        return {
            page,
            pagecount: data.pagecount || page,
            total: data.total,
            list: (data.list || []).map((v) => ({
                vod_id: String(v.vod_id),
                vod_name: String(v.vod_name),
                vod_pic: v.vod_pic,
                vod_remarks: v.vod_remarks || '',
            })),
        };
    }

    return catvodProxy(base, '/category', { id: tid, page });
}

async function detail(inReq, _outResp) {
    const base = baseUrl(inReq);
    const ids = !Array.isArray(inReq.body.id) ? [inReq.body.id] : inReq.body.id;

    if (isTvboxApi(base)) {
        const data = await tvboxGet(base, { ac: 'detail', ids: ids.join(',') });
        return {
            list: (data.list || []).map((v) => ({
                vod_id: v.vod_id,
                vod_name: v.vod_name,
                vod_pic: v.vod_pic,
                vod_content: v.vod_content,
                vod_play_from: v.vod_play_from,
                vod_play_url: v.vod_play_url,
            })),
        };
    }

    return catvodProxy(base, '/detail', { id: ids });
}

async function play(inReq, _outResp) {
    const base = baseUrl(inReq);
    const id = inReq.body.id;
    const flag = inReq.body.flag;

    if (isTvboxApi(base)) {
        const data = await tvboxGet(base, { ac: 'play', flag, id });
        if (typeof data === 'string') {
            try {
                return JSON.parse(data);
            } catch {
                return { parse: 0, url: data };
            }
        }
        return data;
    }

    return catvodProxy(base, '/play', { flag, id });
}

async function search(inReq, _outResp) {
    const base = baseUrl(inReq);
    const wd = inReq.body.wd;
    let page = inReq.body.page || 1;
    if (page == 0) page = 1;

    if (isTvboxApi(base)) {
        const data = await tvboxGet(base, { ac: 'detail', wd, pg: page });
        return {
            page,
            pagecount: data.pagecount || page,
            total: data.total,
            list: (data.list || []).map((v) => ({
                vod_id: String(v.vod_id),
                vod_name: String(v.vod_name),
                vod_pic: v.vod_pic,
                vod_remarks: v.vod_remarks || '',
            })),
        };
    }

    return catvodProxy(base, '/search', { wd, page });
}

export default {
    meta: { key: 't4', name: '站源', type: 3 },
    api: async (fastify) => {
        fastify.post('/init', init);
        fastify.post('/home', home);
        fastify.post('/category', category);
        fastify.post('/detail', detail);
        fastify.post('/play', play);
        fastify.post('/search', search);
    },
};
