import req from '../../util/req.js';

function apiUrl(inReq) {
    return String(inReq.body.ext || inReq.body.flag || '').trim();
}

async function request(url, reqUrl) {
    const resp = await req.get(reqUrl);
    return resp.data;
}

async function init(_inReq, _outResp) {
    return {};
}

async function home(inReq, _outResp) {
    const url = apiUrl(inReq);
    if (!url) return { class: [] };
    const data = await request(url, url);
    const classes = (data.class || []).map((cls) => ({
        type_id: cls.type_id.toString(),
        type_name: cls.type_name.toString().trim(),
    }));
    return { class: classes };
}

async function category(inReq, _outResp) {
    const url = apiUrl(inReq);
    const tid = inReq.body.id;
    let page = inReq.body.page || 1;
    if (page == 0) page = 1;
    const data = await request(url, `${url}?ac=detail&t=${tid}&pg=${page}`);
    const videos = (data.list || []).map((vod) => ({
        vod_id: vod.vod_id.toString(),
        vod_name: vod.vod_name.toString(),
        vod_pic: vod.vod_pic,
        vod_remarks: vod.vod_remarks,
    }));
    return {
        page: parseInt(data.page) || page,
        pagecount: data.pagecount || page,
        total: data.total,
        list: videos,
    };
}

async function detail(inReq, _outResp) {
    const url = apiUrl(inReq);
    const ids = !Array.isArray(inReq.body.id) ? [inReq.body.id] : inReq.body.id;
    const videos = [];
    for (const id of ids) {
        const data = (await request(url, `${url}?ac=detail&ids=${id}`)).list[0];
        videos.push({
            vod_id: data.vod_id,
            vod_name: data.vod_name,
            vod_pic: data.vod_pic,
            vod_year: data.vod_year,
            vod_area: data.vod_area,
            vod_remarks: data.vod_remarks,
            vod_actor: data.vod_actor,
            vod_director: data.vod_director,
            vod_content: (data.vod_content || '').trim(),
            vod_play_from: data.vod_play_from,
            vod_play_url: data.vod_play_url,
        });
    }
    return { list: videos };
}

async function play(inReq, _outResp) {
    return { parse: 0, url: inReq.body.id };
}

async function search(inReq, _outResp) {
    const url = apiUrl(inReq);
    const wd = inReq.body.wd;
    let page = inReq.body.page || 1;
    if (page == 0) page = 1;
    const data = await request(url, `${url}?ac=detail&wd=${encodeURIComponent(wd)}&pg=${page}`);
    const videos = (data.list || []).map((vod) => ({
        vod_id: vod.vod_id.toString(),
        vod_name: vod.vod_name.toString(),
        vod_pic: vod.vod_pic,
        vod_remarks: vod.vod_remarks,
    }));
    return {
        page: parseInt(data.page) || page,
        pagecount: data.pagecount || page,
        total: data.total,
        list: videos,
    };
}

export default {
    meta: { key: 'cms', name: '采集站', type: 3 },
    api: async (fastify) => {
        fastify.post('/init', init);
        fastify.post('/home', home);
        fastify.post('/category', category);
        fastify.post('/detail', detail);
        fastify.post('/play', play);
        fastify.post('/search', search);
    },
};
