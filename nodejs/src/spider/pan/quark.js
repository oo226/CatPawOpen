import { QuarkClient } from '../../util/quarkClient.js';
import { folderPic, formatSize, isVideo } from '../../util/panHttp.js';

let client = null;
const ROOT = '/q/0/';

async function init(inReq, _outResp) {
    const cookie = inReq.server.config?.quark?.cookie || '';
    client = new QuarkClient(cookie);
    return {};
}

function parsePath(path) {
    const m = String(path || '').match(/^\/q\/([^/]+)\/?$/);
    if (!m) return { fid: '0', parent: ROOT };
    return { fid: decodeURIComponent(m[1]), parent: `/q/${m[1]}/` };
}

async function dir(inReq, _outResp) {
    const dirPath = inReq.body.path;
    let pg = inReq.body.page || 1;
    pg = pg || 1;

    if (!client?.cookie) {
        return {
            parent: dirPath || '/',
            page: pg,
            pagecount: pg,
            list: [{ name: '请先在配置页扫码登录夸克网盘', path: '/', type: 0, thumb: folderPic() }],
        };
    }

    if (dirPath === '/' || dirPath === '' || dirPath == null) {
        return {
            parent: '/',
            page: pg,
            pagecount: pg,
            list: [{ name: '夸克网盘', path: ROOT, type: 0, thumb: folderPic() }],
        };
    }

    try {
        const { fid, parent } = parsePath(dirPath);
        const items = await client.listDir(fid);
        const list = [];
        for (const item of items) {
            const isDir = item.file === false || item.dir === true || item.file_type === 0;
            const name = item.file_name || item.name || '';
            const itemFid = item.fid || item.id || name;
            if (!isDir && !isVideo(name)) continue;
            list.push({
                name: name.replaceAll('$', '_').replaceAll('#', '_'),
                path: isDir ? `/q/${encodeURIComponent(itemFid)}/` : `/q/${encodeURIComponent(itemFid)}`,
                thumb: isDir ? folderPic() : item.thumbnail || '',
                type: isDir ? 0 : 10,
                size: formatSize(item.size),
                remark: '',
            });
        }
        return { parent, page: pg, pagecount: pg, list };
    } catch (e) {
        return {
            parent: dirPath,
            page: pg,
            pagecount: pg,
            list: [{ name: `夸克读取失败: ${e.message}`, path: '/', type: 0, thumb: folderPic() }],
        };
    }
}

async function file(inReq, _outResp) {
    const { fid } = parsePath(inReq.body.path);
    const url = await client.getDownload(fid);
    return {
        name: fid,
        url,
        size: '',
        remark: '',
        header: {},
        extra: { subt: [] },
    };
}

export default {
    meta: { key: 'quark', name: '夸克网盘', type: 40 },
    api: async (fastify) => {
        fastify.post('/init', init);
        fastify.post('/dir', dir);
        fastify.post('/file', file);
    },
};
