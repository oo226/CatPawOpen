/**
 * 示例爬虫 - 苹果 CMS (MacCMS) JSON 接口
 *
 * 这是最常用的爬虫类型之一：目标站提供标准 JSON API，直接请求解析即可。
 * 开发流程：
 *   1. 用浏览器/DevTools 找到数据接口（通常是 /api.php/provide/vod/...）
 *   2. 实现 home / category / detail / play / search 六个接口
 *   3. 在 router.js 注册
 *   4. npm run dev 热重载后测试
 */
import req from '../../util/req.js';

// 接口地址在 index.config.js 的 myvideo.url 中配置
let apiUrl = '';

async function request(reqUrl) {
    const resp = await req.get(reqUrl);
    return resp.data;
}

// 初始化：读取配置（部分源需要先 init 才能正常工作）
async function init(inReq, _outResp) {
    apiUrl = inReq.server.config.myvideo?.url || '';
    return {};
}

// 首页分类
async function home(_inReq, _outResp) {
    const data = await request(apiUrl);
    const classes = (data.class || []).map((cls) => ({
        type_id: cls.type_id.toString(),
        type_name: cls.type_name.toString().trim(),
    }));
    return { class: classes };
}

// 分类列表
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

// 视频详情
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

// 播放地址
async function play(inReq, _outResp) {
    const id = inReq.body.id;
    return {
        parse: 0,
        url: id,
    };
}

// 搜索
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

// 一键自测：浏览器访问 http://localhost:3006/spider/myvideo/3/test
async function test(inReq, outResp) {
    try {
        const prefix = inReq.server.prefix;
        const result = {};

        let resp = await inReq.server.inject().post(`${prefix}/init`);
        result.init = resp.json();

        resp = await inReq.server.inject().post(`${prefix}/home`);
        result.home = resp.json();

        const firstClass = result.home.class?.find((c) => c.type_id === '6') || result.home.class?.[0];
        if (firstClass) {
            resp = await inReq.server.inject().post(`${prefix}/category`).payload({
                id: firstClass.type_id,
                page: 1,
            });
            result.category = resp.json();

            const firstVod = result.category.list?.[0];
            if (firstVod) {
                resp = await inReq.server.inject().post(`${prefix}/detail`).payload({ id: firstVod.vod_id });
                result.detail = resp.json();

                const vod = result.detail.list?.[0];
                if (vod) {
                    const flag = vod.vod_play_from.split('$$$')[0];
                    const epUrl = vod.vod_play_url.split('$$$')[0].split('#')[0].split('$')[1];
                    resp = await inReq.server.inject().post(`${prefix}/play`).payload({ flag, id: epUrl });
                    result.play = resp.json();
                }
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

export default {
    meta: {
        key: 'myvideo',
        name: '我的影视',
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
