import req from './req.js';

const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export class Y115Client {
    constructor(cookie = '') {
        this.cookie = cookie || '';
    }

    headers() {
        return {
            'User-Agent': UA,
            Referer: 'https://115.com/',
            Cookie: this.cookie,
        };
    }

    async listDir(cid = '0') {
        const res = await req.get('https://webapi.115.com/files', {
            params: {
                aid: 1,
                cid,
                o: 'user_ptime',
                asc: 0,
                offset: 0,
                show_dir: 1,
                limit: 200,
            },
            headers: this.headers(),
            timeout: 15000,
        });
        if (res.data?.state === false) {
            throw new Error(res.data?.error || res.data?.message || '115 list failed');
        }
        return res.data?.data || [];
    }

    async getDownload(pickcode) {
        const res = await req.get('https://webapi.115.com/files/download', {
            params: { pickcode },
            headers: this.headers(),
            timeout: 15000,
        });
        return res.data?.file_url || res.data?.url || '';
    }
}
