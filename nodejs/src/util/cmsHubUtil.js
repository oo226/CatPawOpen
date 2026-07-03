export const CMS_PREFIX = '「采」';

export function cmsDisplayName(name = '') {
    const n = String(name || '').trim();
    if (!n) return `${CMS_PREFIX}采集`;
    return n.startsWith(CMS_PREFIX) ? n : `${CMS_PREFIX}${n}`;
}

export function cmsSiteKey(name = '') {
    return `nodejs_${cmsDisplayName(name)}`;
}

export function stripCmsPrefix(name = '') {
    const n = String(name || '').trim();
    return n.startsWith(CMS_PREFIX) ? n.slice(CMS_PREFIX.length) : n;
}

export function getCmsSources(config = {}) {
    const list = config?.cms?.list;
    return Array.isArray(list) ? list : [];
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

export function buildDisabledCmsSites(sources = []) {
    return sources.map((item) => ({
        key: cmsSiteKey(item.name),
        name: cmsDisplayName(item.name),
        enable: false,
    }));
}
