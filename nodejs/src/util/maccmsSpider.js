import req from './req.js';

/**
 * 苹果 CMS 标准 JSON 接口爬虫工厂
 * 适用于 /api.php/provide/vod/ 类资源站
 */
export function createMacCmsSpider({ key, name, configKey }) {
    let apiUrl = '';

    async function request(reqUrl) {
        const resp = await req.get(reqUrl);
        return resp.data;
    }

    async function init(inReq, _outResp) {
        apiUrl = inReq.server.config[configKey]?.url || '';
        return {};
    }

    async function home(_inReq, _outResp) {
        const data = await request(apiUrl);
        const classes = (data.class || []).map((cls) => ({
            type_id: cls.type_id.toString(),
            type_name: cls.type_name.toString().trim(),
        }));
        return { class: classes };
    }

    async function category(inReq, _outResp) {
        const tid = inReq.body.id;
        const pg = inReq.body.page;
        let page = pg || 1;
        if (page == 0) page = 1;

        const data = await request(`${apiUrl}?ac=detail&t=${tid}&pg=${page}`);
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
        const ids = !Array.isArray(inReq.body.id) ? [inReq.body.id] : inReq.body.id;
        const videos = [];
        for (const id of ids) {
            const data = (await request(`${apiUrl}?ac=detail&ids=${id}`)).list[0];
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
        const wd = inReq.body.wd;
        const pg = inReq.body.page;
        let page = pg || 1;
        if (page == 0) page = 1;

        const data = await request(`${apiUrl}?ac=detail&wd=${encodeURIComponent(wd)}&pg=${page}`);
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
                const firstVod = result.category.list?.[0];
                if (firstVod) {
                    resp = await inReq.server.inject().post(`${prefix}/detail`).payload({ id: firstVod.vod_id });
                    result.detail = resp.json();
                }
            }
            resp = await inReq.server.inject().post(`${prefix}/search`).payload({ wd: '爱', page: 1 });
            result.search = resp.json();
            return result;
        } catch (err) {
            outResp.code(500);
            return { err: err.message };
        }
    }

    return {
        meta: { key, name, type: 3 },
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
}
