import req from '../../util/req.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PAGE_SIZE = 50;
const CACHE_TTL = 60 * 60 * 1000;

const DEFAULT_SOURCES = [
    'https://raw.githubusercontent.com/fanmingming/live/main/tv/m3u/itv.m3u',
    'https://raw.githubusercontent.com/fanmingming/live/main/tv/m3u/index.m3u',
    'https://raw.githubusercontent.com/fanmingming/live/main/tv/m3u/ipv6.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/cn.m3u',
];

const GROUP_ORDER = ['央视', '卫视', '央视高清', '卫视高清', '地方', 'NewTV', 'SiTV', 'iHOT', '其他', '央视备用', '卫视备用', '未分类'];

let cache = { at: 0, groups: {}, flat: [] };

function parseM3u(text) {
    const lines = String(text).split(/\r?\n/);
    const groups = {};
    let name = '';
    let group = '未分类';
    let logo = '';
    for (const line of lines) {
        if (line.startsWith('#EXTINF')) {
            const gm = line.match(/group-title="([^"]*)"/i);
            group = gm?.[1]?.trim() || '未分类';
            const nm = line.match(/,(.+)$/);
            name = nm ? nm[1].trim() : '';
            const lm = line.match(/tvg-logo="([^"]*)"/i);
            logo = lm?.[1] || '';
        } else if (line && !line.startsWith('#') && name) {
            if (!groups[group]) groups[group] = [];
            groups[group].push({ name, url: line.trim(), logo, group });
            name = '';
        }
    }
    return groups;
}

function mergeGroups(target, source) {
    for (const [group, items] of Object.entries(source)) {
        if (!target[group]) target[group] = [];
        const seen = new Set(target[group].map((x) => x.name));
        for (const item of items) {
            if (!seen.has(item.name)) {
                target[group].push(item);
                seen.add(item.name);
            }
        }
    }
}

function sortGroups(groups) {
    const keys = Object.keys(groups);
    keys.sort((a, b) => {
        const ia = GROUP_ORDER.indexOf(a);
        const ib = GROUP_ORDER.indexOf(b);
        if (ia >= 0 && ib >= 0) return ia - ib;
        if (ia >= 0) return -1;
        if (ib >= 0) return 1;
        return a.localeCompare(b, 'zh-CN');
    });
    return keys;
}

function chId(group, index) {
    return `live://${encodeURIComponent(group)}/${index}`;
}

function parseChId(id) {
    const m = String(id).match(/^live:\/\/([^/]+)\/(\d+)$/);
    if (!m) return null;
    return { group: decodeURIComponent(m[1]), index: parseInt(m[2], 10) };
}

async function loadChannels(extraSources = []) {
    if (cache.at && Date.now() - cache.at < CACHE_TTL && cache.flat.length) {
        return cache;
    }
    const sources = [...DEFAULT_SOURCES, ...extraSources].filter(Boolean);
    const groups = {};
    for (const url of sources) {
        try {
            const resp = await req.get(url, {
                headers: { 'User-Agent': UA },
                timeout: 30000,
                validateStatus: () => true,
            });
            if (resp.status === 200) {
                mergeGroups(groups, parseM3u(resp.data));
            }
        } catch (_) {
            /* skip failed source */
        }
    }
    const flat = [];
    for (const group of sortGroups(groups)) {
        groups[group].forEach((item, index) => {
            flat.push({ ...item, index, id: chId(group, index) });
        });
    }
    cache = { at: Date.now(), groups, flat };
    return cache;
}

async function init(inReq, _outResp) {
    const sources = inReq.server.config.live?.sources;
    if (Array.isArray(sources)) {
        await loadChannels(sources);
    } else {
        await loadChannels();
    }
    return {};
}

async function home(_inReq, _outResp) {
    const { groups } = await loadChannels();
    return {
        class: sortGroups(groups).map((group) => ({
            type_id: group,
            type_name: `${group}(${groups[group].length})`,
        })),
    };
}

async function category(inReq, _outResp) {
    const group = inReq.body.id;
    let page = inReq.body.page || 1;
    if (page == 0) page = 1;
    const { groups } = await loadChannels();
    const items = groups[group] || [];
    const start = (page - 1) * PAGE_SIZE;
    const slice = items.slice(start, start + PAGE_SIZE);
    const list = slice.map((item, i) => ({
        vod_id: chId(group, start + i),
        vod_name: item.name,
        vod_pic: item.logo || '',
        vod_remarks: group,
    }));
    return {
        page,
        pagecount: start + PAGE_SIZE < items.length ? page + 1 : page,
        total: items.length,
        list,
    };
}

async function detail(inReq, _outResp) {
    const ids = !Array.isArray(inReq.body.id) ? [inReq.body.id] : inReq.body.id;
    const { groups } = await loadChannels();
    const videos = [];
    for (const id of ids) {
        const parsed = parseChId(id);
        if (!parsed) continue;
        const item = groups[parsed.group]?.[parsed.index];
        if (!item) continue;
        videos.push({
            vod_id: id,
            vod_name: item.name,
            vod_pic: item.logo || '',
            vod_remarks: parsed.group,
            vod_play_from: '直播',
            vod_play_url: `直播$${id}`,
        });
    }
    return { list: videos };
}

async function play(inReq, _outResp) {
    const parsed = parseChId(inReq.body.id);
    if (!parsed) {
        throw new Error('invalid channel id');
    }
    const { groups } = await loadChannels();
    const item = groups[parsed.group]?.[parsed.index];
    if (!item?.url) {
        throw new Error('channel not found');
    }
    return {
        parse: 0,
        url: item.url,
        header: {
            'User-Agent': UA,
        },
    };
}

async function search(inReq, _outResp) {
    const wd = inReq.body.wd?.trim();
    if (!wd) return { list: [] };
    const { flat } = await loadChannels();
    const list = flat
        .filter((item) => item.name.includes(wd) || item.group.includes(wd))
        .slice(0, 100)
        .map((item) => ({
            vod_id: item.id,
            vod_name: item.name,
            vod_pic: item.logo || '',
            vod_remarks: item.group,
        }));
    return { list };
}

async function test(inReq, outResp) {
    try {
        const prefix = inReq.server.prefix;
        const result = {};
        let resp = await inReq.server.inject().post(`${prefix}/init`);
        result.init = resp.json();
        resp = await inReq.server.inject().post(`${prefix}/home`);
        result.home = resp.json();
        const firstClass = result.home.class?.[0];
        if (firstClass) {
            resp = await inReq.server.inject().post(`${prefix}/category`).payload({ id: firstClass.type_id, page: 1 });
            result.category = resp.json();
            if (result.category.list?.[0]) {
                resp = await inReq.server.inject().post(`${prefix}/play`).payload({ id: result.category.list[0].vod_id });
                result.play = resp.json();
            }
        }
        resp = await inReq.server.inject().post(`${prefix}/search`).payload({ wd: '央视' });
        result.search = resp.json();
        result.totalChannels = (await loadChannels()).flat.length;
        return result;
    } catch (err) {
        outResp.code(500);
        return { err: err.message };
    }
}

export default {
    meta: {
        key: 'live',
        name: 'IPTV直播',
        type: 3,
    },
    api: async (fastify) => {
        fastify.post('/init', init);
        fastify.post('/home', home);
        fastify.post('/category', category);
        fastify.post('/detail', detail);
        fastify.post('/play', play);
        fastify.post('/search', search);
        fastify.get('/test', test);
    },
};
