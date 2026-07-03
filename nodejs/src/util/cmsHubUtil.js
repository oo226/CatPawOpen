export const CMS_PREFIX = '「采」';

export function cmsDisplayName(name = '') {
    const n = String(name || '').trim();
    if (!n) return `${CMS_PREFIX}采集`;
    return n.startsWith(CMS_PREFIX) ? n : `${CMS_PREFIX}${n}`;
}

export function stripCmsPrefix(name = '') {
    const n = String(name || '').trim();
    return n.startsWith(CMS_PREFIX) ? n.slice(CMS_PREFIX.length) : n;
}

export function getCmsSources(config = {}) {
    const cms = config?.cms || {};
    const list = cms.list;
    if (Array.isArray(list) && list.length > 0) return list;
    const hub = cms.hub ?? cms.sources;
    return Array.isArray(hub) ? hub : [];
}

/** 与 lmentor Ybe / douer Hce 一致：db /cms/list 优先于 config.cms.list */
export async function resolveCmsSources(server) {
    const config = server?.config || {};
    try {
        const dbCms = await server?.db?.getObjectDefault?.('/cms', {});
        if (dbCms && Object.prototype.hasOwnProperty.call(dbCms, 'list')) {
            const dbList = getCmsSources({ cms: { list: dbCms.list } });
            if (dbList.length > 0) return dbList;
        }
    } catch {
        // ignore
    }
    return getCmsSources(config);
}

export function encodeVodRef(address, vodId) {
    return `${encodeURIComponent(address)}@@${vodId}`;
}

export function decodeVodRef(ref) {
    const raw = String(ref || '');
    const sep = raw.indexOf('@@');
    if (sep < 0) return { address: '', vodId: raw };
    return {
        address: decodeURIComponent(raw.slice(0, sep)),
        vodId: raw.slice(sep + 2),
    };
}
