# 本地 JS Spider 编写规范

本文只描述通过 `js.js` 加载的本地上传 JS spider 应该怎么写。

重点有三条：

1. 只能导入白名单里的依赖。
2. 只能默认导出固定工厂函数。
3. 只注册约定的 spider 路由，特殊能力用可复用模式扩展。

内置仓库里的历史 spider 有些会直接 `export default { ... }`，或者导入更多项目内部文件。那是因为仓库源码运行时可以走原生文件 import。上传到设备、通过 `js.js` 走 bundle/data URL 加载时，不能按这个宽松规则写。新写、上传、复制改造的脚本，以本文为准。

---

## 1. 固定导出格式

本地 JS spider 必须是 ESM 文件，并且只默认导出一个工厂函数：

```js
export default function createSpider(name, config) {
  return {
    meta: {
      key: 'demo_key',
      name: '示例源',
      type: 3,
    },
    api: async (fastify) => {
      fastify.post('/init', init);
      fastify.post('/home', home);
      fastify.post('/category', category);
      fastify.post('/detail', detail);
      fastify.post('/play', play);
      fastify.post('/search', search);
    },
    check: async () => true,
  };
}
```

约束：

- `export default function createSpider(name, config) { ... }` 是新脚本的固定格式；函数名可以改，但必须是默认导出的函数。
- 工厂函数可以同步返回 spider 对象，也可以 `async` 返回 spider 对象。
- `name` 和 `config` 由 `JSFactory` 传入，主要用作上传配置兜底；不要依赖它们覆盖真实站点逻辑。
- `meta.key` 必须稳定、唯一，只能使用字母、数字、下划线、短横线。不要和已启用的内置 spider 使用同一个 key，除非你明确要替换/复用该 key。
- `meta.name` 是显示名，`meta.type` 点播源固定写 `3`。
- `api(fastify)` 里注册的路径必须是相对当前 spider 前缀的路径，例如 `/home`，不能写 `/spider/demo_key/3/home`。
- `check` 可选，只做轻量探活；不要在 `check` 里做大规模抓取。

不要这样写：

```js
// 不要：CommonJS 不适合当前 loader。
module.exports = {};

// 不要：只有具名导出，loader 找不到标准 spider。
export { home, category, detail, play };

// 不要：当前 loader 为旧脚本兼容直接导出对象，但新上传脚本统一禁止这种写法。
export default { meta, api };
```

---

## 2. 路由契约

标准 spider 至少注册这六个 POST 路由：

| 路由 | 入参位置 | 返回结构 |
|------|----------|----------|
| `/init` | `req.body` 通常不用 | 通常 `{}` |
| `/home` | `req.body` 通常不用 | `{ class, filters?, list? }` |
| `/category` | `{ id, page, filter?, filters?, extend?, ext? }` | `{ page, pagecount, limit, total, list }` |
| `/detail` | `{ id }`，可为单个 id 或数组 | `{ list: [vod] }` |
| `/play` | `{ flag, id }` | `{ parse, url, header? }` |
| `/search` | `{ wd, page, quick? }` | `{ page, pagecount, limit, total, list }` |

可选路由：

| 路由 | 用途 |
|------|------|
| `/homeVod` | 首页推荐列表，返回 `{ list }` |
| `/proxy/...` | 当前 spider 私有代理，例如图片、m3u8、网盘文件代理 |
| 其它管理路由 | 仅在确有需要时添加，路径仍必须相对当前 spider 前缀 |

常用字段：

- 列表项：`vod_id`、`vod_name`、`vod_pic`、`vod_remarks`。
- 详情项：在列表项基础上补 `vod_content`、`vod_year`、`vod_area`、`vod_actor`、`vod_director`、`vod_play_from`、`vod_play_url`。
- 多线路：`vod_play_from` 用 `$$$` 分隔线路名，`vod_play_url` 用 `$$$` 分隔线路内容。
- 单线路多集：`vod_play_url` 内部用 `#` 分隔集数，每集格式是 `集名$播放id`。
- `/play` 返回 `parse: 0` 表示 `url` 是播放器可直接播放的地址；`parse: 1` 表示交给客户端嗅探/解析。播放器不支持嗅探时，不能把 `parse: 1` 当作完成结果。

推荐把请求体统一归一化：

```js
function bodyOf(req) {
  return req?.body || {};
}

function pageOf(value) {
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function extendOf(req) {
  const body = bodyOf(req);
  return body.filters || body.extend || body.ext || body.filter || {};
}
```

---

## 3. 只能导入这些依赖

`js.js` 会把白名单里的 import 改写成 `globalThis.__CAT_JS_UTIL[...]`。设备 bundle 场景下，未进入白名单的第三方包和项目内部模块不会存在。

### 3.1 Node 内置模块

Node 内置模块可以直接导入，例如：

```js
import { URL } from 'url';
import crypto from 'crypto';
import { Readable } from 'node:stream';
```

优先使用全局对象时可以不导入，例如 `URL`、`URLSearchParams`、`Buffer`。

### 3.2 裸包名白名单

只能导入下表里的裸包名。其中 `crypto` 是 Node 内置模块，但也在 loader 注册表里做了兼容归一化。

| 包名 | 常用写法 |
|------|----------|
| `axios` | `import axios from 'axios';` |
| `cheerio` | `import { load } from 'cheerio';` 或 `import cheerio from 'cheerio';` |
| `crypto-js` | `import CryptoJS from 'crypto-js';` |
| `iconv-lite` | `import iconv from 'iconv-lite';` |
| `http2` | `import http2 from 'http2';` 或 `import * as http2 from 'http2';` |
| `jpeg-js` | `import jpeg from 'jpeg-js';` |
| `qs` | `import qs from 'qs';` |
| `crypto` | `import crypto from 'crypto';` 或 `import * as crypto from 'crypto';` |

不能导入未列出的包，例如 `qrcode`、`@marsaud/smb2`、`lru-cache`、`playwright`。如果确实需要新增包，必须先在 `src/spider/video/js.js` 顶部静态 import，并补到 `JS_IMPORT_REGISTRY`，重新打包后再使用。

### 3.3 项目内部模块白名单

只能导入下表里的 `core` / `util` 模块。推荐使用从 `spider/video/*.js` 出发的规范路径。

| 模块 | 允许写法 | 常用导出 |
|------|----------|----------|
| `util/req.js` | `import req, { getSharedAgents } from '../../util/req.js';` | 默认 axios 实例、共享 Agent |
| `util/htmlParser.js` | `import { jsoup, jsonpath, urljoin } from '../../util/htmlParser.js';` | HTML/JSON 解析辅助 |
| `util/home-cache.js` | `import { getHomeCache, setHomeCache, buildHomeCacheKey, HOME_CACHE_TTL } from '../../util/home-cache.js';` | 首页缓存 |
| `util/pan.js` | `import { init, detail, play, proxy, getPanInfos } from '../../util/pan.js';` | 网盘解析、播放、代理 |
| `util/concurrency-limiter.js` | `import { withConcurrencyControl, withInflightDedup, buildRequestKey } from '../../util/concurrency-limiter.js';` | 并发控制、请求去重 |
| `util/misc.js` | `import { delay, jsonParse, stripHtmlTag, fixUrl, IOS_UA } from '../../util/misc.js';` | 通用辅助 |
| `util/lru-cache.js` | `import LRUCache from '../../util/lru-cache.js';` | 本项目轻量 LRU |
| `core/runtime-context.js` | `import { getPans, getPanName, getPanEnabled } from '../../core/runtime-context.js';` | 运行时网盘配置 |

导入规则：

- 静态 `import ... from '...'` 才会被改写。
- 支持默认导入、具名导入、命名空间导入、默认 + 具名混合导入。
- 内部模块路径只按结尾识别：`.../util/req.js`、`.../core/runtime-context.js` 这类能命中；推荐仍写规范相对路径。
- 不支持 `require(...)`。
- 不支持动态 `import(...)` 加载项目内部文件。
- 不支持 `import './local-helper.js'` 这类本地副作用导入；上传脚本应尽量单文件化。
- 不要导入 未列出的项目文件。

如果日志出现：

```text
上传脚本依赖未内置的模块 util/xxx.js
```

说明脚本导入了未加入 `JS_IMPORT_REGISTRY` 的项目模块。解决方式不是改路径，而是补 `js.js` 的白名单并重新打包。

---

## 4. 普通站点示例

参考：`ptt.js`。

适合普通 HTML/JSON 视频站：分类、筛选、详情、播放都由站点页面或接口提供，不需要本地 proxy，也不走网盘解析。

```js
import req from '../../util/req.js';
import { jsoup } from '../../util/htmlParser.js';
import { URL } from 'url';

const KEY = 'demo_html';
const NAME = '普通示例';
const HOST = 'https://example.com';
const UA = 'Mozilla/5.0';

function pq(html) {
  return new jsoup().pq(html);
}

function abs(url, base = HOST) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return 'https:' + raw;
  return new URL(raw, base).toString();
}

async function getHtml(pathOrUrl) {
  const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : abs(pathOrUrl);
  const { data } = await req.get(url, {
    headers: { 'User-Agent': UA, Referer: HOST + '/' },
    timeout: 12000,
  });
  return String(data || '');
}

async function init() {
  return {};
}

async function home() {
  const classes = [
    { type_id: '1', type_name: '电影' },
    { type_id: '2', type_name: '剧集' },
  ];
  const filters = {
    '1': [],
    '2': [],
  };
  return { class: classes, filters, list: [] };
}

async function category(reqIn) {
  const body = reqIn?.body || {};
  const page = pageOf(body.page);
  const html = await getHtml(`/list/${body.id || '1'}-${page}.html`);
  const $ = pq(html);
  const list = [];

  $('.item').each((_, el) => {
    const a = $(el).find('a[href]').first();
    const href = a.attr('href');
    const name = a.attr('title') || a.text().trim();
    if (!href || !name) return;
    list.push({
      vod_id: abs(href),
      vod_name: name,
      vod_pic: abs($(el).find('img').attr('data-src') || $(el).find('img').attr('src')),
      vod_remarks: $(el).find('.note').text().trim(),
    });
  });

  return {
    page,
    pagecount: list.length > 0 ? page + 1 : page,
    limit: 24,
    total: list.length > 0 ? page * 24 + 1 : 0,
    list,
  };
}

async function detail(reqIn) {
  const ids = Array.isArray(reqIn?.body?.id) ? reqIn.body.id : [reqIn?.body?.id];
  const list = [];

  for (const id of ids.filter(Boolean)) {
    const html = await getHtml(id);
    const $ = pq(html);
    const playLinks = $('.playlist a[href]').map((_, a) => {
      const name = $(a).text().trim() || '播放';
      return `${name}$${abs($(a).attr('href'), id)}`;
    }).get();

    list.push({
      vod_id: id,
      vod_name: $('h1').first().text().trim(),
      vod_pic: abs($('.detail img').first().attr('src'), id),
      vod_content: $('.desc').text().trim(),
      vod_play_from: '默认',
      vod_play_url: playLinks.join('#'),
    });
  }

  return { list };
}

async function play(reqIn) {
  const id = String(reqIn?.body?.id || '').trim();
  const html = await getHtml(id);
  const $ = pq(html);
  const src = $('video source').attr('src') || $('video').attr('src') || '';
  if (src) {
    return {
      parse: 0,
      url: abs(src, id),
      header: { Referer: id, 'User-Agent': UA },
    };
  }
  return { parse: 0, url: '', message: '未提取到直链' };
}

async function search(reqIn) {
  const body = reqIn?.body || {};
  const page = pageOf(body.page);
  const wd = String(body.wd || '').trim();
  if (!wd) return { page, pagecount: page, limit: 24, total: 0, list: [] };
  const html = await getHtml(`/search/${encodeURIComponent(wd)}.html`);
  const $ = pq(html);
  const list = $('.item').map((_, el) => ({
    vod_id: abs($(el).find('a[href]').first().attr('href')),
    vod_name: $(el).find('a[title]').first().attr('title') || $(el).text().trim(),
    vod_pic: abs($(el).find('img').attr('src')),
    vod_remarks: $(el).find('.note').text().trim(),
  })).get().filter((item) => item.vod_id && item.vod_name);
  return { page, pagecount: page, limit: 24, total: list.length, list };
}

function pageOf(value) {
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export default function createSpider() {
  return {
    meta: { key: KEY, name: NAME, type: 3 },
    api: async (fastify) => {
      fastify.post('/init', init);
      fastify.post('/home', home);
      fastify.post('/category', category);
      fastify.post('/detail', detail);
      fastify.post('/play', play);
      fastify.post('/search', search);
    },
  };
}
```

普通站点注意点：

- 优先在 `/detail` 里拼好 `vod_play_from` / `vod_play_url`，`/play` 只负责把播放 id 变成可播放地址。
- 能拿到直链就返回 `parse: 0`。
- 只有客户端确实支持嗅探时才返回 `parse: 1`；否则提取失败就显式返回空直链/错误信息，不要伪装成成功。
- 筛选参数优先兼容 `filters`、`extend`、`ext` 三种名字。

---

## 5. 带本地 proxy 的示例

参考：`ymvid.js`。

适合 m3u8 需要补 header、播放地址需要解密、图片需要防盗链、或站点要求服务端代取的源。

核心规则：注册 proxy 路由可以写固定相对路径，但生成给客户端的 proxy URL 不能硬编码 `/spider/<内置key>/3/proxy/...`。复制/上传后 key 会变，必须从当前 request 的 Fastify prefix 推导。

下面只展示 proxy 相关骨架；`home`、`category`、`detail`、`search` 的站点解析按普通站点示例实现。

```js
import req from '../../util/req.js';
import { load } from 'cheerio';
import CryptoJS from 'crypto-js';

const KEY = 'demo_proxy';
const NAME = 'Proxy示例';
const HOST = 'https://example.com';
const UA = 'Mozilla/5.0';

function headers(referer = HOST + '/', accept = '*/*') {
  return {
    'User-Agent': UA,
    Accept: accept,
    Referer: referer,
  };
}

function encodeToken(payload) {
  return Buffer.from(JSON.stringify(payload || {}), 'utf8').toString('base64url');
}

function decodeToken(token) {
  try {
    return JSON.parse(Buffer.from(String(token || ''), 'base64url').toString('utf8')) || {};
  } catch {
    return {};
  }
}

function requestOrigin(request) {
  const proto = String(request?.headers?.['x-forwarded-proto'] || request?.protocol || 'http')
    .split(',')[0]
    .trim() || 'http';
  const host = String(request?.headers?.['x-forwarded-host'] || request?.headers?.host || '')
    .split(',')[0]
    .trim();
  return host ? `${proto}://${host}` : '';
}

function routePrefix(request) {
  if (request?.server && typeof request.server.prefix === 'string') {
    return request.server.prefix.replace(/\/+$/, '');
  }
  return `/spider/${KEY}/3`;
}

function buildProxyUrl(request, payload) {
  const origin = requestOrigin(request);
  if (!origin) return '';
  return `${origin}${routePrefix(request)}/proxy/playlist.m3u8?u=${encodeToken(payload)}`;
}

async function fetchText(url, referer = HOST + '/') {
  const res = await req.get(url, {
    headers: headers(referer, 'text/html,application/xhtml+xml,*/*'),
    timeout: 15000,
    responseType: 'text',
  });
  return typeof res.data === 'string' ? res.data : String(res.data || '');
}

async function decryptPlayUrl(playPageUrl) {
  const html = await fetchText(playPageUrl, HOST + '/');
  const $ = load(html);
  const encrypted = $('input[type="hidden"]').first().attr('value') || '';

  // 示例只展示模式：真实站点的 key/算法不要写进文档。
  const decrypted = CryptoJS.AES.decrypt(encrypted, CryptoJS.enc.Utf8.parse('[REDACTED_SECRET]'), {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  }).toString(CryptoJS.enc.Utf8);

  return String(decrypted || '').trim();
}

async function play(reqIn) {
  const playPageUrl = String(reqIn?.body?.id || '').trim();
  const mediaUrl = await decryptPlayUrl(playPageUrl);
  const proxyUrl = buildProxyUrl(reqIn, {
    url: mediaUrl,
    referer: playPageUrl,
  });

  return {
    parse: 0,
    url: proxyUrl || mediaUrl,
    header: proxyUrl ? {} : headers(playPageUrl, '*/*'),
  };
}

async function playlistProxy(request, reply) {
  const payload = decodeToken(request?.query?.u || '');
  const url = String(payload.url || '').trim();
  const referer = String(payload.referer || HOST + '/').startsWith(HOST) ? payload.referer : HOST + '/';

  if (!url || !url.startsWith(HOST)) {
    return reply.code(400).send('Invalid playlist url');
  }

  const res = await req.get(url, {
    headers: headers(referer, '*/*'),
    timeout: 15000,
    responseType: 'text',
    validateStatus: () => true,
  });
  const text = typeof res.data === 'string' ? res.data : String(res.data || '');
  if (res.status >= 400 || !text.includes('#EXTM3U')) {
    return reply.code(502).send(text || 'Fetch playlist failed');
  }

  reply
    .header('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8')
    .header('Access-Control-Allow-Origin', '*')
    .header('Cache-Control', 'no-cache');
  return reply.send(text);
}

async function home() {
  return { class: [], filters: {}, list: [] };
}

async function category(reqIn) {
  const page = Number.parseInt(reqIn?.body?.page, 10) || 1;
  return { page, pagecount: page, limit: 0, total: 0, list: [] };
}

async function detail() {
  return { list: [] };
}

async function search(reqIn) {
  const page = Number.parseInt(reqIn?.body?.page, 10) || 1;
  return { page, pagecount: page, limit: 0, total: 0, list: [] };
}

export default function createSpider() {
  return {
    meta: { key: KEY, name: NAME, type: 3 },
    api: async (fastify) => {
      fastify.post('/init', async () => ({}));
      fastify.post('/home', home);
      fastify.post('/category', category);
      fastify.post('/detail', detail);
      fastify.post('/play', play);
      fastify.post('/search', search);
      fastify.get('/proxy/playlist.m3u8', playlistProxy);
    },
  };
}
```

proxy 注意点：

- `fastify.get('/proxy/...')` 注册的是相对路径，会自动挂到 `/spider/<当前key>/3/proxy/...`。
- 返回给播放器的 URL 如果必须是绝对地址，用 `request.headers.host` + `request.server.prefix` 拼。
- 不要硬编码 `/spider/ymvid/3/proxy/...`，否则复制成其它 key 或上传后会打到错误路由。
- proxy 参数必须校验，至少限制目标 host、token 格式、响应类型和大小。
- proxy 只解决服务端代取/补 header，不要把无法播放的页面地址包装成播放成功。

---

## 6. 网盘源示例

参考：`libvio.js`。

适合详情页能提取夸克、UC、阿里、百度、天翼、115、123、迅雷、磁力等分享链接的源。站点本身不直接提供可播放视频，播放能力交给 `util/pan.js`。

下面只展示网盘接入骨架；`fetchSearchHtml`、`parseSearchResult`、`fetchDetailHtml`、`category` 这些站点抓取函数按目标站实际结构实现。

```js
import req from '../../util/req.js';
import { load } from 'cheerio';
import {
  init as panInit,
  detail as panDetail,
  play as panPlay,
  proxy as panProxy,
} from '../../util/pan.js';
import { getHomeCache, setHomeCache, buildHomeCacheKey, HOME_CACHE_TTL } from '../../util/home-cache.js';
import { withConcurrencyControl, buildRequestKey } from '../../util/concurrency-limiter.js';

const KEY = 'demo_pan';
const NAME = '网盘示例';
const HOST = 'https://example.com';

function isShareUrl(url = '') {
  return /magnet:|pan\.quark\.cn|drive\.uc\.cn|aliyundrive\.com|alipan\.com|pan\.baidu\.com|cloud\.189\.cn|115\.com|123pan\.com|xunlei\.com/i
    .test(String(url || ''));
}

function extractShareUrls($) {
  const set = new Set();

  $('a[href]').each((_, a) => {
    const href = String($(a).attr('href') || '').trim();
    if (isShareUrl(href)) set.add(href);
  });

  const text = $('body').text();
  const plain = text.match(/https?:\/\/[^\s"'<>，。；、]+/g) || [];
  plain.forEach((url) => {
    if (isShareUrl(url)) set.add(url);
  });

  return [...set];
}

async function home(reqIn) {
  const cacheKey = buildHomeCacheKey(KEY, reqIn || {});
  const cached = getHomeCache(cacheKey);
  if (cached) return cached;

  const result = {
    class: [
      { type_id: '1', type_name: '电影' },
      { type_id: '2', type_name: '剧集' },
    ],
    filters: {},
    list: [],
  };
  setHomeCache(cacheKey, result, HOME_CACHE_TTL.semiStatic);
  return result;
}

async function search(reqIn) {
  const body = reqIn?.body || {};
  const page = Number.parseInt(body.page, 10) || 1;
  const wd = String(body.wd || '').trim();
  if (!wd) return { page, pagecount: page, limit: 20, total: 0, list: [] };

  return withConcurrencyControl(
    KEY,
    'search',
    buildRequestKey('search', { wd, page }),
    async () => {
      const html = await fetchSearchHtml(wd, page);
      return parseSearchResult(html, page);
    },
    { timeout: 30000 },
  );
}

async function detail(reqIn) {
  const ids = Array.isArray(reqIn?.body?.id) ? reqIn.body.id : [reqIn?.body?.id];
  const list = [];

  for (const id of ids.filter(Boolean)) {
    const html = await fetchDetailHtml(id);
    const $ = load(html);
    const shareUrls = extractShareUrls($);

    const vod = {
      vod_id: id,
      vod_name: $('h1').first().text().trim(),
      vod_pic: '',
      vod_content: $('.desc').text().trim(),
    };

    if (shareUrls.length > 0) {
      const panVod = await panDetail(shareUrls, reqIn).catch((err) => {
        console.warn(`[${KEY}] panDetail failed:`, err?.message || err);
        return null;
      });
      if (panVod?.froms && panVod?.urls) {
        vod.vod_play_from = panVod.froms;
        vod.vod_play_url = panVod.urls;
        if (Array.isArray(panVod.links) && panVod.links.length > 0) {
          vod.vod_links = panVod.links;
        }
      }
    }

    list.push(vod);
  }

  return { list };
}

async function category(reqIn) {
  const page = Number.parseInt(reqIn?.body?.page, 10) || 1;
  return { page, pagecount: page, limit: 0, total: 0, list: [] };
}

export default function createSpider() {
  return {
    meta: { key: KEY, name: NAME, type: 3 },
    api: async (fastify) => {
      fastify.post('/init', panInit);
      fastify.post('/home', home);
      fastify.post('/category', category);
      fastify.post('/detail', detail);
      fastify.post('/play', panPlay);
      fastify.post('/search', search);
      fastify.get('/proxy/:site/:what/:flag/:shareId/:fileId/:end', panProxy);
    },
  };
}
```

网盘源注意点：

- `/detail` 负责把站点页面里的分享链接提取出来，并调用 `panDetail(shareUrls, req)`。
- `/play` 直接注册 `panPlay`，不要自己解析各网盘下载地址。
- `/proxy/:site/:what/:flag/:shareId/:fileId/:end` 直接注册 `panProxy`。
- `/init` 推荐注册 `panInit`，让网盘运行时先初始化。
- `panDetail` 可能返回空结果，应该保留基础详情，不要让单个网盘失败导致整个详情 500。

---

## 7. 网盘分组源示例

参考：`qwnull.js`。

适合一个影片详情页里有多个网盘分组、每组多个资源的站点。交互层级一般是：

```text
分类/搜索结果
  -> 影片条目 show
    -> 网盘分组 group
      -> 具体资源 resource
        -> panDetail / panPlay
```

这个模式的关键是用结构化 `vod_id` 表达当前层级。

下面只展示分层 `vod_id`、分类分支、详情分支和 pan 接入骨架；`home`、`homeVod`、`getDetailBundle`、`fetchCategoryShows`、`searchShows` 按目标站实际结构实现。

```js
import { getPans } from '../../core/runtime-context.js';
import {
  init as panInit,
  detail as panDetail,
  play as panPlay,
  proxy as panProxy,
  getPanInfos,
} from '../../util/pan.js';

const KEY = 'demo_pan_group';
const NAME = '网盘分组示例';

function encodeId(payload) {
  return JSON.stringify({ source: KEY, ...payload });
}

function decodeId(raw) {
  try {
    const parsed = JSON.parse(String(raw || ''));
    return parsed?.source === KEY ? parsed : null;
  } catch {
    return null;
  }
}

function showId(vodId, baseVod = {}) {
  return encodeId({ mode: 'show', vodId: String(vodId || ''), baseVod });
}

function groupId(vodId, groupKey, groupName, baseVod = {}) {
  return encodeId({
    mode: 'group',
    vodId: String(vodId || ''),
    groupKey: String(groupKey || ''),
    groupName: String(groupName || groupKey || ''),
    baseVod,
  });
}

function resourceId(item) {
  return encodeId({
    mode: 'resource',
    url: String(item.url || ''),
    name: String(item.title || item.name || '资源'),
    sourceName: String(item.groupName || '网盘资源'),
    pic: String(item.pic || ''),
    content: String(item.content || ''),
  });
}

function panTypeOf(text = '') {
  const raw = String(text || '').toLowerCase();
  if (/quark|夸克/.test(raw)) return 'quark';
  if (/(^|[^a-z])uc([^a-z]|$)|uc网盘|uc云盘/.test(raw)) return 'uc';
  if (/aliyun|alipan|阿里/.test(raw)) return 'ali';
  if (/baidu|百度/.test(raw)) return 'baidu';
  if (/115/.test(raw)) return '115';
  if (/123/.test(raw)) return '123';
  if (/xunlei|迅雷/.test(raw)) return 'xunlei';
  if (/magnet|磁力|bt/.test(raw)) return 'magnet';
  return '';
}

function panEnabled(type = '') {
  const key = panTypeOf(type);
  if (!key) return true;
  const runtimePans = getPans();
  if (!runtimePans.length) return true;
  return !!runtimePans.find((pan) => pan?.key === key)?.enable;
}

function panDisplayName(type = '') {
  const key = panTypeOf(type);
  if (!key) return type || '网盘资源';
  const runtimeName = getPans().find((pan) => pan?.key === key)?.name;
  const fallbackName = getPanInfos().find((pan) => pan?.key === key)?.name;
  return runtimeName || fallbackName || type || key;
}

function groupShareLinks(shareLinks = []) {
  const groups = new Map();
  for (const item of shareLinks) {
    const groupName = item.groupName || '网盘资源';
    if (!panEnabled(groupName)) continue;
    const groupKey = item.groupKey || groupName;
    const current = groups.get(groupKey) || {
      groupKey,
      groupName,
      items: [],
    };
    current.items.push(item);
    groups.set(groupKey, current);
  }
  return [...groups.values()];
}

async function category(reqIn) {
  const body = reqIn?.body || {};
  const tid = String(body.id || body.tid || '1');
  const page = Number.parseInt(body.page || body.pg, 10) || 1;
  const decoded = decodeId(tid);

  if (decoded?.mode === 'show') {
    if (page > 1) return pageResult(page, 1, []);
    const bundle = await getDetailBundle(decoded.vodId, decoded.baseVod, reqIn);
    const groups = groupShareLinks(bundle.shareLinks);
    const list = groups.map((group) => ({
      vod_id: groupId(bundle.vod.vod_id, group.groupKey, group.groupName, bundle.vod),
      vod_name: panDisplayName(group.groupName),
      vod_pic: bundle.vod.vod_pic,
      vod_remarks: `${group.items.length} 条资源`,
      type_name: '网盘分组',
      cate: {},
    }));
    return pageResult(1, 1, list);
  }

  if (decoded?.mode === 'group') {
    if (page > 1) return pageResult(page, 1, []);
    const bundle = await getDetailBundle(decoded.vodId, decoded.baseVod, reqIn);
    const list = bundle.shareLinks
      .filter((item) => (item.groupKey || item.groupName) === decoded.groupKey)
      .filter((item) => panEnabled(item.groupName))
      .map((item) => ({
        vod_id: resourceId({ ...item, pic: bundle.vod.vod_pic, content: bundle.vod.vod_content }),
        vod_name: item.title || bundle.vod.vod_name || '资源',
        vod_pic: bundle.vod.vod_pic,
        vod_remarks: panDisplayName(item.groupName),
        type_name: '网盘资源',
      }));
    return pageResult(1, 1, list);
  }

  const normalList = await fetchCategoryShows(tid, page, reqIn);
  return pageResult(page, normalList.hasMore ? page + 1 : page, normalList.list.map((vod) => ({
    ...vod,
    vod_id: showId(vod.vod_id, vod),
    cate: {},
  })));
}

async function detail(reqIn) {
  const ids = Array.isArray(reqIn?.body?.id) ? reqIn.body.id : [reqIn?.body?.id];
  const list = [];

  for (const rawId of ids.filter(Boolean)) {
    const decoded = decodeId(rawId);

    if (decoded?.mode === 'show') {
      const bundle = await getDetailBundle(decoded.vodId, decoded.baseVod, reqIn);
      list.push({
        ...bundle.vod,
        vod_id: rawId,
        vod_remarks: bundle.vod.vod_remarks || `${bundle.shareLinks.length} 条网盘资源`,
        cate: {},
      });
      continue;
    }

    if (decoded?.mode === 'group') {
      list.push({
        vod_id: rawId,
        vod_name: panDisplayName(decoded.groupName),
        vod_pic: decoded.baseVod?.vod_pic || '',
        vod_remarks: '目录项，请进入下一层查看资源',
      });
      continue;
    }

    if (decoded?.mode === 'resource' && decoded.url) {
      const panVod = await panDetail([decoded.url], reqIn).catch(() => null);
      const vod = {
        vod_id: rawId,
        vod_name: decoded.name || '资源',
        vod_pic: decoded.pic || '',
        vod_remarks: decoded.sourceName || '',
        vod_content: decoded.content || '',
      };
      if (panVod?.froms && panVod?.urls) {
        vod.vod_play_from = panVod.froms;
        vod.vod_play_url = panVod.urls;
        if (Array.isArray(panVod.links) && panVod.links.length > 0) {
          vod.vod_links = panVod.links;
        }
      }
      list.push(vod);
    }
  }

  return { list };
}

async function search(reqIn) {
  const shows = await searchShows(reqIn);
  return {
    page: 1,
    pagecount: 1,
    limit: 20,
    total: shows.length,
    list: shows.map((vod) => ({
      ...vod,
      vod_id: showId(vod.vod_id, vod),
      cate: {},
    })),
  };
}

function pageResult(page, pagecount, list) {
  return {
    page,
    pagecount,
    limit: 20,
    total: Math.max(list.length, pagecount * 20),
    list,
  };
}

async function home() {
  return { class: [], filters: {}, list: [] };
}

async function homeVod() {
  return { list: [] };
}

export default function createSpider() {
  return {
    meta: { key: KEY, name: NAME, type: 3 },
    api: async (fastify) => {
      fastify.post('/init', panInit);
      fastify.post('/home', home);
      fastify.post('/homeVod', homeVod);
      fastify.post('/category', category);
      fastify.post('/detail', detail);
      fastify.post('/play', panPlay);
      fastify.post('/search', search);
      fastify.get('/proxy/:site/:what/:flag/:shareId/:fileId/:end', panProxy);
    },
  };
}
```

网盘分组注意点：

- 分类和搜索先返回 `show` 层，不直接把所有网盘资源摊平。
- 进入 `show` 后，`category` 返回网盘分组列表。
- 进入 `group` 后，`category` 返回该分组下的具体资源。
- `resource` 的 `detail` 才调用 `panDetail([url], req)`，避免首页/搜索阶段触发大量网盘请求。
- 用 `getPans()` / `getPanInfos()` 控制网盘显示名、启用状态和顺序。
- 每层 `vod_id` 都应该可逆解析，推荐 JSON；旧式 `prefix|id` 也可以，但 JSON 更容易扩展。

---

## 8. 缓存、并发和筛选补充

### 8.1 首页缓存

```js
import { getHomeCache, setHomeCache, buildHomeCacheKey, HOME_CACHE_TTL } from '../../util/home-cache.js';

async function home(reqIn) {
  const key = buildHomeCacheKey('demo_key', reqIn || {});
  const cached = getHomeCache(key);
  if (cached) return cached;

  const result = {
    class: await fetchClasses(),
    filters: await fetchFilters(),
    list: [],
  };
  setHomeCache(key, result, HOME_CACHE_TTL.semiStatic);
  return result;
}
```

### 8.2 请求去重和并发控制

```js
import { withConcurrencyControl, withInflightDedup, buildRequestKey } from '../../util/concurrency-limiter.js';

async function search(reqIn) {
  const body = reqIn?.body || {};
  const wd = String(body.wd || '').trim();
  const page = Number.parseInt(body.page, 10) || 1;
  const key = buildRequestKey('search', { wd, page });

  return withConcurrencyControl('demo_key', 'search', key, async () => {
    return withInflightDedup(key, async () => {
      const html = await fetchSearchHtml(wd, page);
      return parseSearch(html, page);
    }, 30000);
  }, { timeout: 30000 });
}
```

### 8.3 每分类不同筛选

`home()` 返回的 `filters` 应该按 `type_id` 分组：

```js
async function home() {
  const classes = [
    { type_id: 'movie', type_name: '电影' },
    { type_id: 'tv', type_name: '剧集' },
  ];
  return {
    class: classes,
    filters: {
      movie: [
        { key: 'area', name: '地区', value: [{ n: '全部', v: '' }, { n: '大陆', v: '大陆' }] },
        { key: 'year', name: '年份', value: [{ n: '全部', v: '' }, { n: '2026', v: '2026' }] },
      ],
      tv: [
        { key: 'area', name: '地区', value: [{ n: '全部', v: '' }, { n: '韩国', v: '韩国' }] },
        { key: 'status', name: '状态', value: [{ n: '全部', v: '' }, { n: '连载', v: '1' }] },
      ],
    },
    list: [],
  };
}
```

`category()` 里兼容不同客户端传参：

```js
function selectedFilters(reqIn) {
  const body = reqIn?.body || {};
  return body.filters || body.extend || body.ext || body.filter || {};
}
```
