import req from '../../util/req.js';
import {
    CMS_PREFIX,
    cmsDisplayName,
    decodeVodRef,
    encodeVodRef,
    resolveCmsSources,
    stripCmsPrefix,
} from '../../util/cmsHubUtil.js';

const HUB_KEY = `${CMS_PREFIX}采集`;

function sourceId(address, index) {
    return encodeURIComponent(address || String(index));
}

function resolveSource(sources, id) {
    const raw = String(id || '');
    const byAddress = sources.find((item) => sourceId(item.address) === raw);
    if (byAddress) return byAddress;
    const idx = Number.parseInt(raw, 10);
    if (Number.isFinite(idx) && sources[idx]) return sources[idx];
    try {
        const address = decodeURIComponent(raw);
        return sources.find((item) => item.address === address) || null;
    } catch {
        return null;
    }
}

async function fetchCms(url, params = {}) {
    const resp = await req.get(url, { params, timeout: 12000 });
    return resp.data;
}

function mapVideos(list = [], sourceName = '') {
    return list.map((vod) => ({
        vod_id: vod.vod_id?.toString() || '',
        vod_name: vod.vod_name?.toString() || '',
        vod_pic: vod.vod_pic,
        vod_remarks: sourceName || vod.vod_remarks,
    }));
}

async function init(_inReq, _outResp) {
    return {};
}

async function home(inReq, _outResp) {
    const sources = await resolveCmsSources(inReq.server);
    return {
        class: sources.map((item, index) => ({
            type_id: sourceId(item.address, index),
            type_name: stripCmsPrefix(cmsDisplayName(item.name)),
        })),
    };
}

async function category(inReq, _outResp) {
    const sources = await resolveCmsSources(inReq.server);
    const rawId = String(inReq.body.id || '');
    let page = Number(inReq.body.page) || 1;
    if (page <= 0) page = 1;

    if (rawId.includes('@@')) {
        const { address, vodId: typeId } = decodeVodRef(rawId);
        const source = sources.find((item) => item.address === address);
        if (!source?.address || !typeId) return { list: [] };
        const data = await fetchCms(source.address, { ac: 'detail', t: typeId, pg: page });
        const label = stripCmsPrefix(cmsDisplayName(source.name));
        const videos = (data.list || []).map((vod) => ({
            vod_id: encodeVodRef(source.address, vod.vod_id),
            vod_name: vod.vod_name?.toString() || '',
            vod_pic: vod.vod_pic,
            vod_remarks: label,
        }));
        return {
            page: Number.parseInt(data.page, 10) || page,
            pagecount: data.pagecount || page,
            total: data.total,
            list: videos,
        };
    }

    const source = resolveSource(sources, rawId);
    if (!source?.address) return { class: [] };

    const data = await fetchCms(source.address, { ac: 'class' });
    const classes = (data.class || []).map((cls) => ({
        type_id: encodeVodRef(source.address, cls.type_id),
        type_name: cls.type_name?.toString().trim() || '',
    }));
    return { class: classes };
}

async function detail(inReq, _outResp) {
    const ids = !Array.isArray(inReq.body.id) ? [inReq.body.id] : inReq.body.id;
    const videos = [];

    for (const ref of ids) {
        const { address, vodId } = decodeVodRef(ref);
        if (!address || !vodId) continue;
        const data = await fetchCms(address, { ac: 'detail', ids: vodId });
        const item = data.list?.[0];
        if (!item) continue;
        videos.push({
            vod_id: encodeVodRef(address, item.vod_id),
            vod_name: item.vod_name,
            vod_pic: item.vod_pic,
            vod_year: item.vod_year,
            vod_area: item.vod_area,
            vod_remarks: item.vod_remarks,
            vod_actor: item.vod_actor,
            vod_director: item.vod_director,
            vod_content: (item.vod_content || '').trim(),
            vod_play_from: item.vod_play_from,
            vod_play_url: item.vod_play_url,
        });
    }
    return { list: videos };
}

async function play(inReq, _outResp) {
    const { vodId } = decodeVodRef(inReq.body.id);
    return { parse: 0, url: vodId || inReq.body.id };
}

async function search(inReq, _outResp) {
    const wd = String(inReq.body.wd || '').trim();
    let page = Number(inReq.body.page) || 1;
    if (page <= 0) page = 1;

    const sources = await resolveCmsSources(inReq.server);
    if (!wd) {
        return {
            class: sources.map((item, index) => ({
                type_id: sourceId(item.address, index),
                type_name: stripCmsPrefix(cmsDisplayName(item.name)),
            })),
        };
    }

    const settled = await Promise.allSettled(
        sources.map(async (item) => {
            const label = stripCmsPrefix(cmsDisplayName(item.name));
            const data = await fetchCms(item.address, {
                ac: 'detail',
                wd,
                pg: page,
            });
            return (data.list || []).map((vod) => ({
                vod_id: encodeVodRef(item.address, vod.vod_id),
                vod_name: vod.vod_name?.toString() || '',
                vod_pic: vod.vod_pic,
                vod_remarks: label,
            }));
        })
    );

    const list = [];
    for (const result of settled) {
        if (result.status === 'fulfilled') list.push(...result.value);
    }

    return {
        page,
        pagecount: page,
        limit: 20,
        total: list.length,
        list,
    };
}

export default {
    meta: { key: HUB_KEY, name: HUB_KEY, type: 3, cms: true },
    api: async (fastify) => {
        fastify.post('/init', init);
        fastify.post('/home', home);
        fastify.post('/category', category);
        fastify.post('/detail', detail);
        fastify.post('/play', play);
        fastify.post('/search', search);
    },
};
