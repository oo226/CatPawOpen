import { createMacCmsSpider } from '../../util/maccmsSpider.js';

// 多个 MacCMS 资源站，配置见 index.config.js
const sources = [
    { key: 'lzi', name: '量子资源', configKey: 'lzi' },
    { key: 'okzy', name: 'OK资源', configKey: 'okzy' },
    { key: 'hongniu', name: '红牛资源', configKey: 'hongniu' },
    { key: 'sdzy', name: '闪电资源', configKey: 'sdzy' },
    { key: 'suoni', name: '索尼资源', configKey: 'suoni' },
    { key: 'mody', name: '魔都资源', configKey: 'mody' },
    { key: 'tianya', name: '天涯资源', configKey: 'tianya' },
    { key: 'bdzy', name: '百度云资源', configKey: 'bdzy' },
];

export default sources.map((s) => createMacCmsSpider(s));
