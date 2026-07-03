import { panRequest, folderPic, formatSize, isVideo } from '../../util/panHttp.js';

const API = 'https://openapi.alipan.com';
let token = '';

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
    const p = String(path || '').replace(/^\/+/, '');
    if (!p) return { driveId: 'root', fileId: 'root', prefix: '/' };
    const parts = p.split('/');
    const fileId = parts.pop();
    const driveId = parts.length ? parts[parts.length - 1] : 'root';
    return { driveId, fileId, prefix: '/' + parts.join('/') + (parts.length ? '/' : '') };
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
            list: [{ name: '阿里云盘', path: '/root/', type: 0, thumb: folderPic() }],
        };
    }

    const { driveId, fileId } = parsePath(dirPath);
    const json = await aliPost('/adrive/v1.0/openFile/list', {
        drive_id: driveId === 'root' ? undefined : driveId,
        parent_file_id: fileId,
        limit: 200,
        order_by: 'name',
        order_direction: 'ASC',
    });
    const items = json?.items || [];
    const parent = dirPath.endsWith('/') ? dirPath : dirPath + '/';
    const list = [];
    for (const item of items) {
        const isDir = item.type === 'folder';
        const name = item.name || '';
        if (!isDir && !isVideo(name)) continue;
        list.push({
            name: name.replaceAll('$', '_').replaceAll('#', '_'),
            path: parent + name + (isDir ? '/' : ''),
            thumb: isDir ? folderPic() : item.thumbnail || '',
            type: isDir ? 0 : 10,
            size: formatSize(item.size),
            remark: '',
        });
    }
    return { parent, page: pg, pagecount: pg, list };
}

async function file(inReq, _outResp) {
    const filePath = inReq.body.path;
    const { driveId, fileId, prefix } = parsePath(filePath);
    const name = filePath.slice(prefix.length).replace(/\/$/, '');
    const json = await aliPost('/adrive/v1.0/openFile/getDownloadUrl', {
        drive_id: driveId === 'root' ? undefined : driveId,
        file_id: fileId,
    });
    return {
        name,
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
