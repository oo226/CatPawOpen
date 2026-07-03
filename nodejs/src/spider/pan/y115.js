import { Y115Client } from '../../util/y115Client.js';
import { folderPic, formatSize, isVideo } from '../../util/panHttp.js';

let client = null;
const ROOT = '/115/0/';

function isFolder(item) {
    if (item.pc) return false;
    if (item.fc === 1 || item.ns === 'folder') return true;
    const name = item.n || item.name || '';
    return !isVideo(name) && !item.pc;
}

async function init(inReq, _outResp) {
    const cookie = inReq.server.config?.y115?.cookie || '';
    client = new Y115Client(cookie);
    return {};
}

function parsePath(path) {
    const m = String(path || '').match(/^\/115\/([^/]+)\/?$/);
    if (!m) return { cid: '0', pickcode: '', parent: ROOT };
    const id = decodeURIComponent(m[1]);
    if (id.includes(':')) {
        const [cid, pickcode] = id.split(':');
        return { cid, pickcode, parent: `/115/${id}` };
    }
    return { cid: id, pickcode: '', parent: `/115/${id}/` };
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
            list: [{ name: '请先在配置页扫码登录115网盘', path: '/', type: 0, thumb: folderPic() }],
        };
    }

    if (dirPath === '/' || dirPath === '' || dirPath == null) {
        return {
            parent: '/',
            page: pg,
            pagecount: pg,
            list: [{ name: '115网盘', path: ROOT, type: 0, thumb: folderPic() }],
        };
    }

    try {
        const { cid, parent } = parsePath(dirPath);
        const items = await client.listDir(cid);
        const list = [];
        for (const item of items) {
            const name = item.n || item.name || '';
            const folder = isFolder(item);
            if (!folder && !isVideo(name)) continue;
            const fid = String(item.fid || item.cid || name);
            const pickcode = item.pc || '';
            const pathId = folder ? fid : `${fid}:${pickcode}`;
            list.push({
                name: name.replaceAll('$', '_').replaceAll('#', '_'),
                path: folder ? `/115/${encodeURIComponent(fid)}/` : `/115/${encodeURIComponent(pathId)}`,
                thumb: folder ? folderPic() : item.u || '',
                type: folder ? 0 : 10,
                size: formatSize(item.s || item.size),
                remark: pickcode ? '' : '',
            });
        }
        return { parent, page: pg, pagecount: pg, list };
    } catch (e) {
        return {
            parent: dirPath,
            page: pg,
            pagecount: pg,
            list: [{ name: `115读取失败: ${e.message}`, path: '/', type: 0, thumb: folderPic() }],
        };
    }
}

async function file(inReq, _outResp) {
    const { pickcode } = parsePath(inReq.body.path);
    const url = pickcode ? await client.getDownload(pickcode) : '';
    return {
        name: pickcode,
        url,
        size: '',
        remark: url ? '' : '无法获取115下载地址',
        header: {},
        extra: { subt: [] },
    };
}

export default {
    meta: { key: 'y115', name: '115网盘', type: 40 },
    api: async (fastify) => {
        fastify.post('/init', init);
        fastify.post('/dir', dir);
        fastify.post('/file', file);
    },
};
