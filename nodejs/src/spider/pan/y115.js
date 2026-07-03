import { folderPic } from '../../util/panHttp.js';

let cookie = '';

async function init(inReq, _outResp) {
    cookie = inReq.server.config?.y115?.cookie || '';
    return {};
}

async function dir(inReq, _outResp) {
    const dirPath = inReq.body.path || '/';
    const pg = inReq.body.page || 1;
    if (!cookie) {
        return {
            parent: dirPath,
            page: pg,
            pagecount: pg,
            list: [{ name: '请先在配置页扫码登录115网盘', path: '/', type: 0, thumb: folderPic() }],
        };
    }
    return {
        parent: dirPath,
        page: pg,
        pagecount: pg,
        list: [{ name: '115网盘（Cookie已配置，浏览功能完善中）', path: '/', type: 0, thumb: folderPic() }],
    };
}

async function file(inReq, _outResp) {
    return { name: '', url: '', size: '', remark: '115播放完善中', header: {}, extra: { subt: [] } };
}

export default {
    meta: { key: 'y115', name: '115网盘', type: 40 },
    api: async (fastify) => {
        fastify.post('/init', init);
        fastify.post('/dir', dir);
        fastify.post('/file', file);
    },
};
