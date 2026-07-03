import req from '../../util/req.js';
import { load } from 'cheerio';

const SITE = 'https://www.xgcartoon.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REFERER = 'https://pframe.xgcartoon.com/';

async function request(reqUrl) {
    const resp = await req.get(reqUrl, {
        headers: {
            'User-Agent': UA,
            Referer: SITE,
        },
        maxRedirects: 5,
    });
    return resp.data;
}

function parseList(html) {
    const $ = load(html);
    const list = [];
    const seen = new Set();
    $('.topic-list-box').each((_, el) => {
        const box = $(el);
        const href = box.find('a[href^="/detail/"]').first().attr('href');
        if (!href || seen.has(href)) return;
        seen.add(href);
        const name = box.find('.h3').first().text().trim();
        const pic = box.find('amp-img').first().attr('src') || '';
        const remarks = box.find('.topic-list-item--author').first().text().trim() || box.find('.author').first().text().trim();
        list.push({
            vod_id: href.replace('/detail/', ''),
            vod_name: name,
            vod_pic: pic,
            vod_remarks: remarks,
        });
    });
    return list;
}

function hasNextPage(html, page) {
    const $ = load(html);
    const next = $(`a[href*="page=${page + 1}"]`).length > 0;
    return next;
}

async function resolvePlayVid(cartoonId, chapterId) {
    const pageDirect = `${SITE}/user/page_direct?cartoon_id=${encodeURIComponent(cartoonId)}&chapter_id=${encodeURIComponent(chapterId)}`;
    const html = String(await request(pageDirect));
    const iframeMatch = html.match(/pframe\.xgcartoon\.com\/player\.htm\?vid=([a-f0-9-]+)/i);
    if (!iframeMatch) {
        throw new Error('player iframe not found');
    }
    return iframeMatch[1];
}

async function init(_inReq, _outResp) {
    return {};
}

async function home(_inReq, _outResp) {
    const html = await request(SITE);
    const $ = load(html);
    const classes = [];
    const seen = new Set();
    $('.index-tab a[href*="classify?type="]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const m = href.match(/type=([^&]+)/);
        if (!m || seen.has(m[1])) return;
        seen.add(m[1]);
        classes.push({
            type_id: m[1],
            type_name: $(el).text().trim() || m[1],
        });
    });
    return { class: classes };
}

async function category(inReq, _outResp) {
    const tid = inReq.body.id;
    const pg = inReq.body.page;
    let page = pg || 1;
    if (page == 0) page = 1;

    const html = await request(`${SITE}/classify?type=${encodeURIComponent(tid)}&page=${page}`);
    const list = parseList(html);
    return {
        page,
        pagecount: hasNextPage(html, page) ? page + 1 : page,
        list,
    };
}

async function detail(inReq, _outResp) {
    const ids = !Array.isArray(inReq.body.id) ? [inReq.body.id] : inReq.body.id;
    const videos = [];
    for (const id of ids) {
        const html = await request(`${SITE}/detail/${id}`);
        const $ = load(html);
        const eps = [];
        $('a.goto-chapter').each((_, el) => {
            const a = $(el);
            const href = a.attr('href') || '';
            const m = href.match(/cartoon_id=([^&]+).*chapter_id=([^&]+)/);
            const name = a.attr('title') || a.text().trim();
            if (m) eps.push(`${name}$${m[1]}|${m[2]}`);
        });
        videos.push({
            vod_id: id,
            vod_name: $('h1.h1').first().text().trim(),
            vod_pic: $('.detail-sider amp-img').first().attr('src') || `https://static-a.xgcartoon.com/cover/${id}.jpg`,
            vod_remarks: $('.detail-sider').text().includes('更新至') ? '更新中' : '',
            vod_content: $('.detail-right__desc p').first().text().trim(),
            vod_play_from: '西瓜卡通',
            vod_play_url: eps.join('#'),
        });
    }
    return { list: videos };
}

async function play(inReq, _outResp) {
    const id = inReq.body.id;
    const [cartoonId, chapterId] = id.split('|');
    if (!cartoonId || !chapterId) {
        throw new Error('invalid play id');
    }
    const vid = await resolvePlayVid(cartoonId, chapterId);
    return {
        parse: 0,
        url: `https://xgct-video.vzcdn.net/${vid}/playlist.m3u8`,
        header: {
            'User-Agent': UA,
            Referer: REFERER,
        },
    };
}

async function search(inReq, _outResp) {
    const wd = inReq.body.wd;
    const pg = inReq.body.page;
    let page = pg || 1;
    if (page == 0) page = 1;

    const html = await request(`${SITE}/search?q=${encodeURIComponent(wd)}&page=${page}`);
    const list = parseList(html);
    return {
        page,
        pagecount: hasNextPage(html, page) ? page + 1 : page,
        list,
    };
}

async function test(inReq, outResp) {
    try {
        const printErr = function (json) {
            if (json.statusCode && json.statusCode == 500) {
                console.error(json);
            }
        };
        const prefix = inReq.server.prefix;
        const dataResult = {};
        let resp = await inReq.server.inject().post(`${prefix}/init`);
        dataResult.init = resp.json();
        printErr(resp.json());
        resp = await inReq.server.inject().post(`${prefix}/home`);
        dataResult.home = resp.json();
        printErr(resp.json());
        if (dataResult.home.class.length > 0) {
            resp = await inReq.server.inject().post(`${prefix}/category`).payload({
                id: dataResult.home.class[0].type_id,
                page: 1,
            });
            dataResult.category = resp.json();
            printErr(resp.json());
            if (dataResult.category.list.length > 0) {
                resp = await inReq.server.inject().post(`${prefix}/detail`).payload({
                    id: dataResult.category.list[0].vod_id,
                });
                dataResult.detail = resp.json();
                printErr(resp.json());
                if (dataResult.detail.list?.[0]?.vod_play_url) {
                    const ep = dataResult.detail.list[0].vod_play_url.split('#')[0];
                    resp = await inReq.server.inject().post(`${prefix}/play`).payload({
                        flag: '西瓜卡通',
                        id: ep.split('$')[1],
                    });
                    dataResult.play = resp.json();
                    printErr(resp.json());
                }
            }
        }
        resp = await inReq.server.inject().post(`${prefix}/search`).payload({
            wd: '盘龙',
            page: 1,
        });
        dataResult.search = resp.json();
        printErr(resp.json());
        return dataResult;
    } catch (err) {
        console.error(err);
        outResp.code(500);
        return { err: err.message, tip: 'check debug console output' };
    }
}

export default {
    meta: {
        key: 'xgcartoon',
        name: '西瓜卡通',
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
