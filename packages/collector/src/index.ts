// Main handler
export { handler } from './scheduler.js';

// Legacy source collectors (for backward compatibility)
export { collectCoinGeckoProjectInfo } from './sources/coingecko.js';
export { collectDefiLlamaProjectInfo } from './sources/defillama.js';
export { collectRSSMarketInfo } from './sources/rss.js';

// New configurable collectors
export * from './collectors/index.js';

// Source configuration service
export * from './services/source-config.js';
