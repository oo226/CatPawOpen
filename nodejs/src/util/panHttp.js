import req from './req.js';

export async function panRequest(url, options = {}) {
    if (options.method === 'POST' && options.data) {
        options.data = options.data;
        options.headers = Object.assign({ 'content-type': 'application/json' }, options.headers);
    }
    const res = await req(url, options);
    return res.data;
}

export function isVideo(name) {
    return /\.(mp4|mkv|avi|mov|wmv|flv|m4v|ts|m3u8|mpg|mpeg|webm|rmvb|3gp)$/i.test(name);
}

export function formatSize(sz) {
    sz = Number(sz) || 0;
    if (sz <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let u = 0;
    while (sz >= 1024 && u < units.length - 1) {
        sz /= 1024;
        u++;
    }
    return `${sz.toFixed(u ? 2 : 0)}${units[u]}`;
}

export function folderPic() {
    return 'http://img1.3png.com/281e284a670865a71d91515866552b5f172b.png';
}
