import { panRequest, folderPic, formatSize, isVideo } from '../../util/panHttp.js';

const API = 'https://openapi.alipan.com';
let token = '';
const ROOT = '/a/root/';

async function init(inReq, _outResp) {
    token = inReq.server.config?.ali?.token || inReq.server.config?.ali?.token280 || '';
    return {};
}

function headers() {
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

async function aliPost(path, data) {
    return panRequest(`${API}${path}`, { method: 'POST', data, headers: headers(), timeout: 15000 });
}

function parsePath(path) {
    const m = String(path || '').match(/^\/a\/([^/]+)\/?$/);
    if (!m) return { fileId: 'root', parent: ROOT };
    return { fileId: decodeURIComponent(m[1]), parent: `/a/${m[1]}/` };
}

async function dir(inReq, _outResp) {
    const dirPath = inReq.body.path;
    let pg = inReq.body.page || 1;
    pg = pg || 1;

    if (!token) {
        return {
            parent: dirPath || '/',
            page: pg,
            pagecount: pg,
            list: [{ name: '请先在配置页登录阿里云盘', path: '/', type: 0, thumb: folderPic() }],
        };
    }

    if (dirPath === '/' || dirPath === '' || dirPath == null) {
        return {
            parent: '/',
            page: pg,
            pagecount: pg,
            list: [{ name: '阿里云盘', path: ROOT, type: 0, thumb: folderPic() }],
        };
    }

    try {
        const { fileId, parent } = parsePath(dirPath);
        const json = await aliPost('/adrive/v1.0/openFile/list', {
            parent_file_id: fileId,
            limit: 200,
            order_by: 'name',
            order_direction: 'ASC',
        });
        const items = json?.items || [];
        const list = [];
        for (const item of items) {
            const isDir = item.type === 'folder';
            const name = item.name || '';
            const id = item.file_id || name;
            if (!isDir && !isVideo(name)) continue;
            list.push({
                name: name.replaceAll('$', '_').replaceAll('#', '_'),
                path: isDir ? `/a/${encodeURIComponent(id)}/` : `/a/${encodeURIComponent(id)}`,
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
            list: [{ name: `阿里读取失败: ${e.message}`, path: '/', type: 0, thumb: folderPic() }],
        };
    }
}

async function file(inReq, _outResp) {
    const { fileId } = parsePath(inReq.body.path);
    const json = await aliPost('/adrive/v1.0/openFile/getDownloadUrl', {
        file_id: fileId,
    });
    return {
        name: fileId,
        url: json?.url || '',
        size: '',
        remark: '',
        header: {},
        extra: { subt: [] },
    };
}

export default {
    meta: { key: 'ali', name: '阿里云盘', type: 40 },
    api: async (fastify) => {
        fastify.post('/init', init);
        fastify.post('/dir', dir);
        fastify.post('/file', file);
    },
};
