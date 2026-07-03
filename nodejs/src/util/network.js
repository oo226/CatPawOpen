import os from 'os';

const isIPv4 = (item) => {
    if (!item) return false;
    const family = typeof item.family === 'string' ? item.family : String(item.family || '');
    return family === 'IPv4' || family === '4';
};

const isValidIPv4 = (ip) => {
    const text = String(ip || '').trim();
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(text)) return false;
    return text.split('.').every((part) => {
        const value = Number(part);
        return Number.isInteger(value) && value >= 0 && value <= 255;
    });
};

const isPrivateIPv4 = (ip) =>
    /^192\.168\./.test(ip) || /^10\./.test(ip) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip);

const isCgnatIPv4 = (ip) => /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip);

const isReservedOrUnroutableIPv4 = (ip) => {
    const text = String(ip || '').trim();
    return (
        /^0\./.test(text) ||
        /^127\./.test(text) ||
        /^169\.254\./.test(text) ||
        /^192\.0\.0\./.test(text) ||
        /^192\.0\.2\./.test(text) ||
        /^198\.18\./.test(text) ||
        /^198\.19\./.test(text) ||
        /^198\.51\.100\./.test(text) ||
        /^203\.0\.113\./.test(text) ||
        /^22[4-9]\./.test(text) ||
        /^23\d\./.test(text) ||
        /^24\d\./.test(text) ||
        /^25[0-5]\./.test(text)
    );
};

const isLikelyCellularInterface = (name = '') => /(rmnet|ccmni|pdp|wwan|cell|mobile|clat|v4-rmnet)/i.test(name);
const isLikelyLanInterface = (name = '') => /(wlan|wi-?fi|eth|en\d|lan|bridge)/i.test(String(name || ''));
const isLikelyVirtualOrTunnelInterface = (name = '') =>
    /(virtual|veth|vethernet|vmware|vbox|hyper-v|docker|podman|br-|wsl|utun|tun|tap|tailscale|zerotier|wireguard|wg|clash|mihomo|loopback|pseudo)/i.test(
        String(name || '')
    );

const calcCandidateScore = (candidate) => {
    let score = 0;
    if (/^192\.168\./.test(candidate.ip)) score += 300;
    else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(candidate.ip)) score += 260;
    else if (/^10\./.test(candidate.ip)) score += 220;
    else if (!isCgnatIPv4(candidate.ip)) score += 180;
    if (isLikelyLanInterface(candidate.name)) score += 80;
    if (isLikelyCellularInterface(candidate.name)) score -= 320;
    if (isLikelyVirtualOrTunnelInterface(candidate.name)) score -= 260;
    if (isCgnatIPv4(candidate.ip)) score -= 220;
    return score;
};

export function getIPAddress() {
    const forcedIp = String(process.env.CATPAW_HOST_IP || process.env.HOST_IP || '').trim();
    if (isValidIPv4(forcedIp)) return forcedIp;

    const interfaces = os.networkInterfaces() || {};
    const candidates = [];
    Object.entries(interfaces).forEach(([name, items]) => {
        if (!Array.isArray(items)) return;
        items.forEach((item) => {
            if (!isIPv4(item) || item.internal) return;
            const ip = String(item.address || '').trim();
            if (!ip || ip.startsWith('169.254.') || isReservedOrUnroutableIPv4(ip)) return;
            candidates.push({ ip, name: String(name || '') });
        });
    });

    const ranked = candidates
        .map((candidate) => ({ ...candidate, score: calcCandidateScore(candidate) }))
        .sort((a, b) => b.score - a.score);

    const preferred = ranked.find((candidate) => {
        return (
            !isLikelyCellularInterface(candidate.name) &&
            !isLikelyVirtualOrTunnelInterface(candidate.name) &&
            !isCgnatIPv4(candidate.ip)
        );
    });
    if (preferred) return preferred.ip;

    const fallbackPrivate = ranked.find(
        (candidate) =>
            isPrivateIPv4(candidate.ip) &&
            !isLikelyCellularInterface(candidate.name) &&
            !isLikelyVirtualOrTunnelInterface(candidate.name)
    );
    if (fallbackPrivate) return fallbackPrivate.ip;

    return '127.0.0.1';
}
