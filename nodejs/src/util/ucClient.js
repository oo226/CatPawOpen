import { panRequest } from './panHttp.js';

const API = 'https://pc-api.uc.cn/1/clouddrive/';
const PR =
    'pr=UCBrowser&fr=pc&sys=darwin&ve=1.8.6&ut=Nk27FcCv6q1eo6rXz8QHR/nIG6qLA3jh7KdL+agFgcOvww==';

export class UCClient {
    constructor(cookie = '') {
        this.cookie = cookie || '';
    }

    headers() {
        return {
            'User-Agent':
                'Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
            Referer: 'https://drive.uc.cn/',
            'Content-Type': 'application/json',
            Cookie: this.cookie,
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
