import req from '../../util/req.js';

const http = async function (url, options = {}) {
    if (options.method == 'POST' && options.data) {
        options.body = JSON.stringify(options.data);
        options.headers = Object.assign({ 'content-type': 'application/json' }, options.headers);
    }
    const res = await req(url, options);
    res.json = () => (res.data ? res.data : null);
    res.text = () => res.content;
    return res;
};
['get', 'post'].forEach((method) => {
    http[method] = function (url, options = {}) {
        return http(url, Object.assign(options, { method: method.toUpperCase() }));
    };
});

const __drives = {};
const __subtitle_cache = {};

async function get_drives_path(tid) {
    const index = tid.indexOf('/', 1);
    const name = tid.substring(1, index);
    const path = tid.substring(index);
    return { drives: await get_drives(name), path };
}

async function get_drives(name) {
    const { settings, api, server } = __drives[name];
    if (settings.v3 == null) {
        //获取 设置
        settings.v3 = false;
        const data = (await http.get(server + '/api/public/settings')).json().data;
        if (Array.isArray(data)) {
            settings.title = data.find((x) => x.key == 'title')?.value;
            settings.v3 = false;
            settings.version = data.find((x) => x.key == 'version')?.value;
            settings.enableSearch = data.find((x) => x.key == 'enable search')?.value == 'true';
        } else {
            settings.title = data.title;
            settings.v3 = true;
            settings.version = data.version;
            settings.enableSearch = false; //v3 没有找到 搜索配置
        }
        //不同版本 接口不一样
        api.path = settings.v3 ? '/api/fs/list' : '/api/public/path';
        api.file = settings.v3 ? '/api/fs/get' : '/api/public/path';
        api.search = settings.v3 ? '/api/public/search' : '/api/public/search';
        api.other = settings.v3 ? '/api/fs/other' : null;
    }
    return __drives[name];
}

async function init(inReq, _outResp) {
    const items = [...(inReq.server.config.alist || [])];
    const cfg = inReq.server.config;
    if (cfg.muou?.url) items.push({ name: '🎬木偶', server: cfg.muou.url });
    if (cfg.wogg?.url) items.push({ name: '🐶玩偶', server: cfg.wogg.url });
    if (cfg.leijing?.url) items.push({ name: '⚡雷静', server: cfg.leijing.url });
    items.forEach(
        (item) =>
            (__drives[item.name] = {
                name: item.name,
                server: item.server.endsWith('/') ? item.server.substring(0, item.server.length - 1) : item.server,
                startPage: item.startPage || '/', //首页
                showAll: item.showAll === true, //默认只显示 视频和文件夹，如果想显示全部 showAll 设置true
                params: item.params || {},
                _path_param: item.params
                    ? Object.keys(item.params).sort(function (x, y) {
                          return y.length - x.length;
                      })
                    : [],
                settings: {},
                api: {},
                getParams(path) {
                    const key = this._path_param.find((x) => path.startsWith(x));
                    return Object.assign({}, this.params[key], { path });
                },
                async getPath(path) {
                    const res = (await http.post(this.server + this.api.path, { data: this.getParams(path) })).json();
                    return this.settings.v3 ? res.data.content : res.data.files;
                },
                async getFile(path) {
                    const res = (await http.post(this.server + this.api.file, { data: this.getParams(path) })).json();
                    const data = this.settings.v3 ? res.data : res.data.files[0];
                    if (!this.settings.v3) data.raw_url = data.url; //v2 的url和v3不一样
                    return data;
                },
                async getOther(method, path) {
                    const data = this.getParams(path);
                    data.method = method;
                    const res = (await http.post(this.server + this.api.other, { data: data })).json();
                    return res;
                },
                isFolder(data) {
                    return data.type == 1;
                },
                isVideo(data) {
                    //判断是否是 视频文件
                    return this.settings.v3 ? data.type == 2 : data.type == 3;
                },
                isSubtitle(data) {
                    if (data.type == 1) return false;
                    const ext = ['.srt', '.ass', '.scc', '.stl', '.ttml'];
                    return ext.some((x) => data.name.endsWith(x));
                },
                getType(data) {
                    const isVideo = this.isVideo(data);
                    return this.isFolder(data) ? 0 : isVideo ? 10 : 1;
                },
                getPic(data) {
                    let pic = this.settings.v3 ? data.thumb : data.thumbnail;
                    return pic || (this.isFolder(data) ? 'http://img1.3png.com/281e284a670865a71d91515866552b5f172b.png' : '');
                },
                getSize(data) {
                    let sz = data.size || 0;
                    if (sz <= 0) return '';
                    let filesize = '';
                    if (sz > 1024 * 1024 * 1024 * 1024.0) {
                        sz /= 1024 * 1024 * 1024 * 1024.0;
                        filesize = 'TB';
                    } else if (sz > 1024 * 1024 * 1024.0) {
                        sz /= 1024 * 1024 * 1024.0;
                        filesize = 'GB';
                    } else if (sz > 1024 * 1024.0) {
                        sz /= 1024 * 1024.0;
                        filesize = 'MB';
                    } else {
                        sz /= 1024.0;
                        filesize = 'KB';
                    }
                    return sz.toFixed(2) + filesize;
                },
                getRemark(_data) {
                    return '';
                },
            })
    );
    // const deviceKey = inReq.server.prefix + '/device';
    // device = await inReq.server.db.getObjectDefault(deviceKey, {});
    // if (!device.id) {
    //     device = randDeviceWithId(32);
    //     device.id = device.id.toLowerCase();
    //     device.ua = 'Dalvik/2.1.0 (Linux; U; Android ' + device.release + '; ' + device.model + ' Build/' + device.buildId + ')';
    //     await inReq.server.db.push(deviceKey, device);
    // }
    return {};
}

async function dir(inReq, _outResp) {
    const dir = inReq.body.path;
    let pg = inReq.body.page || 1;
    for (const k in __subtitle_cache) {
        delete __subtitle_cache[k];
    }
    pg = pg || 1;
    if (pg == 0) pg == 1;
    if (dir === '/' || dir === '') {
        const result = Object.keys(__drives).map(function (n) {
            const d = __drives[n];
            return { name: d.name, path: '/' + d.name + d.startPage, type: 0, thumb: '' };
        });
        return {
            parent: '',
            page: pg,
            pagecount: pg,
            list: result,
        };
    }

    let { drives, path } = await get_drives_path(dir);
    const id = dir.endsWith('/') ? dir : dir + '/';
    const list = await drives.getPath(path);
    let subtList = [];
    let videos = [];
    let allList = [];
    list.forEach((item) => {
        if (drives.isSubtitle(item)) subtList.push(item.name);
        const isVideo = drives.isVideo(item);
        if (!drives.showAll && !drives.isFolder(item) && !isVideo) return;
        const file = {
            name: item.name.replaceAll('$', '_').replaceAll('#', '_'),
            path: id + item.name + (drives.isFolder(item) ? '/' : ''),
            thumb: drives.getPic(item),
            type: drives.getType(item),
            size: drives.getSize(item),
            remark: drives.getRemark(item),
        };
        if (drives.isVideo(item)) videos.push(file);
        allList.push(file);
    });
    if (subtList.length > 0) {
        videos.forEach((item) => {
            var sbust = findBestLCS(item.name, subtList);
            if (sbust.bestMatch) __subtitle_cache[item.path] = [id + sbust.bestMatch.target];
        });
    }
    return {
        parent: id,
        page: pg,
        pagecount: pg,
        list: allList,
    };
}

async function file(inReq, _outResp) {
    const file = inReq.body.path;
    let { drives, path } = await get_drives_path(file);
    const item = await drives.getFile(path);
    const subs = [];
    if (__subtitle_cache[file]) {
        for (const sub of __subtitle_cache[file]) {
            try {
                let subP = await get_drives_path(sub);
                const subItem = await drives.getFile(subP.path);
                subs.push(subItem.raw_url);
            } catch (error) {}
        }
    }
    if ((item.provider === 'AliyundriveShare2Open' || item.provider == 'AliyundriveOpen') && drives.api.other) {
        const urls = ['原画', item.raw_url];
        try {
            const res = await drives.getOther('video_preview', path);
            for (const live of res.data.video_preview_play_info.live_transcoding_task_list) {
                if (live.status === 'finished') {
                    urls.push(live.template_id);
                    urls.push(live.url);
                }
            }
        } catch (error) {}
        const result = {
            name: item.name,
            url: urls,
            size: drives.getSize(item),
            remark: drives.getRemark(item),
            header: {},
            extra: {
                subt: subs,
            },
        };
        return result;
    } else if (item.provider === '123Pan') {
        let url = item.raw_url;
        try {
            url = (await http.get(url)).json().data.redirect_url;
        } catch (error) {}
        const result = {
            name: item.name,
            url: url,
            size: drives.getSize(item),
            remark: drives.getRemark(item),
            header: {},
            extra: {
                subt: subs,
            },
        };
        return result;
    } else {
        const result = {
            name: item.name,
            url: item.raw_url,
            size: drives.getSize(item),
            remark: drives.getRemark(item),
            header: {},
            extra: {
                subt: subs,
            },
        };
        return result;
    }
}

async function test(inReq, outResp) {
    try {
        const printErr = function (json) {
            if (json.statusCode && json.statusCode == 500) {
                console.error(json);
            }
        };
        const prefix = inReq.server.prefix;
        const dataResult = {};
        let resp = await inReq.server.inject().post(`${prefix}/init`);
        dataResult.init = resp.json();
        printErr(resp.json());
        resp = await inReq.server.inject().post(`${prefix}/dir`).payload({
            path: '/',
            page: 1,
        });
        dataResult.dir = resp.json();
        printErr(resp.json());
        resp = await inReq.server.inject().post(`${prefix}/file`).payload({
            path: '/🐉神族九帝/天翼云盘/音乐/周杰伦 - 七里香.flac',
        });
        dataResult.file = resp.json();
        printErr(resp.json());
        return dataResult;
    } catch (err) {
        console.error(err);
        outResp.code(500);
        return { err: err.message, tip: 'check debug console output' };
    }
}

export default {
    meta: {
        key: 'alist',
        name: 'Alist',
        type: 40,
    },
    api: async (fastify) => {
        fastify.post('/init', init);
        fastify.post('/dir', dir);
        fastify.post('/file', file);
        fastify.get('/test', test);
    },
};
