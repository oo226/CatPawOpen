import req from '../../util/req.js';
import { load } from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SITE = 'https://movie.douban.com';

const TAGS = [
    { type_id: 'top250', type_name: 'Top250电影' },
    { type_id: 'movie|热门', type_name: '热门电影' },
    { type_id: 'movie|经典', type_name: '经典电影' },
    { type_id: 'movie|豆瓣高分', type_name: '豆瓣高分' },
    { type_id: 'movie|冷门佳片', type_name: '冷门佳片' },
    { type_id: 'movie|最新', type_name: '最新电影' },
    { type_id: 'tv|热门', type_name: '热门剧集' },
    { type_id: 'tv|国产剧', type_name: '国产剧' },
    { type_id: 'tv|美剧', type_name: '美剧' },
    { type_id: 'tv|韩剧', type_name: '韩剧' },
    { type_id: 'tv|日剧', type_name: '日剧' },
    { type_id: 'tv|动画', type_name: '动画剧集' },
    { type_id: 'tv|纪录片', type_name: '纪录片' },
];

function headers() {
    return {
        'User-Agent': UA,
        Referer: SITE + '/',
        'Accept-Language': 'zh-CN,zh;q=0.9',
    };
}

async function request(url) {
    const resp = await req.get(url, { headers: headers() });
    return resp.data;
}

function mapSubject(item, rank) {
    const remarks = [item.rate, item.regions?.[0], item.release_date?.slice(0, 4)].filter(Boolean).join(' · ');
    return {
        vod_id: String(item.id),
        vod_name: item.title,
        vod_pic: item.cover_url || item.cover || item.pic || '',
        vod_remarks: rank ? `#${rank} ${remarks}` : remarks,
    };
}

async function fetchTop250(page) {
    const start = (page - 1) * 25;
    const html = String(await request(`${SITE}/top250?start=${start}&filter=`));
    const $ = load(html);
    const list = [];
    $('.grid_view .item').each((i, el) => {
        const item = $(el);
        const href = item.find('.pic a').attr('href') || '';
        const id = href.match(/subject\/(\d+)/)?.[1];
        if (!id) return;
        list.push({
            vod_id: id,
            vod_name: item.find('.title').text().trim(),
            vod_pic: item.find('.pic img').attr('src') || '',
            vod_remarks: `#${start + i + 1} ${item.find('.rating_num').text()}分`,
        });
    });
    return {
        page,
        pagecount: list.length > 0 && start + list.length < 250 ? page + 1 : page,
        list,
    };
}

async function fetchTagList(kind, tag, page) {
    const pageStart = (page - 1) * 20;
    const data = await request(
        `${SITE}/j/search_subjects?type=${kind}&tag=${encodeURIComponent(tag)}&page_limit=20&page_start=${pageStart}`
    );
    const list = (data.subjects || []).map((item) => ({
        vod_id: String(item.id),
        vod_name: item.title,
        vod_pic: item.cover,
        vod_remarks: `${item.rate}分 · ${item.year || ''}`.trim(),
    }));
    return {
        page,
        pagecount: list.length >= 20 ? page + 1 : page,
        list,
    };
}

async function init(_inReq, _outResp) {
    return {};
}

async function home(_inReq, _outResp) {
    return { class: TAGS };
}

async function category(inReq, _outResp) {
    const tid = inReq.body.id;
    let page = inReq.body.page || 1;
    if (page == 0) page = 1;

    if (tid === 'top250') {
        return fetchTop250(page);
    }
    const parts = tid.split('|');
    if (parts.length === 2) {
        return fetchTagList(parts[0], parts[1], page);
    }
    return { page, pagecount: page, list: [] };
}

async function detail(inReq, _outResp) {
    const ids = !Array.isArray(inReq.body.id) ? [inReq.body.id] : inReq.body.id;
    const videos = [];
    for (const id of ids) {
        const data = await request(`${SITE}/j/subject_abstract?subject_id=${id}`);
        const s = data.subject || {};
        const actors = (s.actors || []).slice(0, 8).join(' / ');
        const directors = (s.directors || []).join(' / ');
        const intro = s.short_comment?.content || '';
        let vod_pic = '';
        try {
            const suggest = await request(`${SITE}/j/subject_suggest?q=${encodeURIComponent((s.title || '').split(/[\s(（]/)[0])}`);
            vod_pic = (Array.isArray(suggest) ? suggest.find((x) => String(x.id) === String(id)) : null)?.img || '';
        } catch (_) {
            /* ignore */
        }
        videos.push({
            vod_id: id,
            vod_name: (s.title || '').replace(/\s*\(\d{4}\)\s*$/, '').trim(),
            vod_pic,
            vod_year: s.release_year || '',
            vod_area: s.region || '',
            vod_remarks: `${s.rate || ''}分`,
            vod_director: directors,
            vod_actor: actors,
            vod_content: intro,
            vod_play_from: '找片提示',
            vod_play_url: `请用全局搜索找片$${(s.title || '').split(' ')[0]}`,
        });
    }
    return { list: videos };
}

async function play(_inReq, _outResp) {
    return {
        parse: 0,
        url: '',
        msg: '豆瓣仅提供榜单信息，请使用全局搜索在其他源播放',
    };
}

async function search(inReq, _outResp) {
    const wd = inReq.body.wd;
    const data = await request(`${SITE}/j/subject_suggest?q=${encodeURIComponent(wd)}`);
    const list = (Array.isArray(data) ? data : []).slice(0, 20).map((item) => ({
        vod_id: String(item.id),
        vod_name: item.title,
        vod_pic: item.img || '',
        vod_remarks: `${item.type || ''} · ${item.year || ''}`.trim(),
    }));
    return { list };
}

async function test(inReq, outResp) {
    try {
        const prefix = inReq.server.prefix;
        const result = {};
        let resp = await inReq.server.inject().post(`${prefix}/home`);
        result.home = resp.json();
        resp = await inReq.server.inject().post(`${prefix}/category`).payload({ id: 'top250', page: 1 });
        result.category = resp.json();
        if (result.category.list?.[0]) {
            resp = await inReq.server.inject().post(`${prefix}/detail`).payload({ id: result.category.list[0].vod_id });
            result.detail = resp.json();
        }
        resp = await inReq.server.inject().post(`${prefix}/search`).payload({ wd: '肖申克' });
        result.search = resp.json();
        return result;
    } catch (err) {
        outResp.code(500);
        return { err: err.message };
    }
}

export default {
    meta: {
        key: 'douban',
        name: '豆瓣榜单',
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
