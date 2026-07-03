import { panRequest } from './panHttp.js';

const API = 'https://drive-pc.quark.cn/1/clouddrive/';
const PR = 'pr=ucpro&fr=pc';

export class QuarkClient {
    constructor(cookie = '') {
        this.cookie = cookie || '';
    }

    headers() {
        return {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) quark-cloud-drive/2.5.20 Chrome/100.0.4896.160 Safari/537.36',
            Referer: 'https://pan.quark.cn/',
            'Content-Type': 'application/json',
            Cookie: this.cookie,
            Host: 'drive-pc.quark.cn',
        };
    }

    async api(path, method = 'GET', data = null) {
        const url = `${API}${path}${path.includes('?') ? '&' : '?'}${PR}`;
        const res = await panRequest(url, {
            method,
            data,
            headers: this.headers(),
            timeout: 15000,
        });
        if (typeof res === 'string') {
            try {
                return JSON.parse(res);
            } catch {
                return { status: 500, message: res };
            }
        }
        return res;
    }

    async listDir(fid = '0') {
        const json = await this.api(
            `file/sort?pdir_fid=${encodeURIComponent(fid)}&_page=1&_size=200&_sort=file_type:asc,file_name:asc`,
            'GET'
        );
        return json?.data?.list || [];
    }

    async getDownload(fid) {
        const json = await this.api('file/download?uc_param_str=', 'POST', { fids: [fid] });
        return json?.data?.[0]?.download_url || '';
    }
}
