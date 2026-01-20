import type { ProjectInfo, ProjectInfoSource } from '@crypto-dashboard/shared';
import { generateProjectInfoId, generateContentHash } from '@crypto-dashboard/shared';

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

interface CoinGeckoExchange {
  id: string;
  name: string;
  image?: string;
  url?: string;
  trust_score?: number;
  trust_score_rank?: number;
  trade_volume_24h_btc?: number;
  trade_volume_24h_btc_normalized?: number;
  country?: string;
  description?: string;
  twitter_handle?: string;
}

interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  total_volume?: number;
  high_24h?: number;
  low_24h?: number;
  price_change_24h?: number;
  price_change_percentage_24h?: number;
  circulating_supply?: number;
}

async function fetchWithRetry<T>(url: string, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        // Rate limited, wait and retry
        await new Promise((resolve) => setTimeout(resolve, 60000));
        continue;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}

const SOURCE: ProjectInfoSource = 'coingecko';

/**
 * Fetch exchanges and convert to ProjectInfo
 */
async function fetchExchangeProjectInfo(): Promise<ProjectInfo[]> {
  const exchanges = await fetchWithRetry<CoinGeckoExchange[]>(
    `${COINGECKO_API_BASE}/exchanges?per_page=50`
  );

  const now = new Date().toISOString();

  return exchanges.map((exchange) => {
    const rawData = exchange as unknown as Record<string, unknown>;
    const dataHash = generateContentHash(JSON.stringify(rawData));

    const info: ProjectInfo = {
      id: generateProjectInfoId(SOURCE, exchange.id),
      source: SOURCE,
      sourceId: exchange.id,
      rawData,
      name: exchange.name,
      logo: exchange.image,
      website: exchange.url,
      description: exchange.description,
      sourceCategory: 'exchange',
      twitter: exchange.twitter_handle,
      collectedAt: now,
      processedStatus: 'pending',
      dataHash,
    };

    return info;
  });
}

/**
 * Fetch coins by category and convert to ProjectInfo
 */
async function fetchCoinProjectInfo(
  category: 'layer-1' | 'layer-2' | 'stablecoins'
): Promise<ProjectInfo[]> {
  const coins = await fetchWithRetry<CoinGeckoCoin[]>(
    `${COINGECKO_API_BASE}/coins/markets?vs_currency=usd&category=${category}&per_page=30&sparkline=false`
  );

  const now = new Date().toISOString();
  const sourceCategory = category === 'stablecoins' ? 'stablecoin' : category;

  return coins.map((coin) => {
    const rawData = coin as unknown as Record<string, unknown>;
    const dataHash = generateContentHash(JSON.stringify(rawData));

    const info: ProjectInfo = {
      id: generateProjectInfoId(SOURCE, coin.id),
      source: SOURCE,
      sourceId: coin.id,
      rawData,
      name: coin.name,
      logo: coin.image,
      description: undefined, // CoinGecko market API doesn't include description
      sourceCategory,
      tokenSymbol: coin.symbol.toUpperCase(),
      collectedAt: now,
      processedStatus: 'pending',
      dataHash,
    };

    return info;
  });
}

/**
 * Collect all ProjectInfo from CoinGecko
 */
export async function collectCoinGeckoProjectInfo(): Promise<ProjectInfo[]> {
  const results: ProjectInfo[] = [];

  // Fetch exchanges
  try {
    console.log('Fetching exchanges from CoinGecko...');
    const exchanges = await fetchExchangeProjectInfo();
    results.push(...exchanges);
    console.log(`Fetched ${exchanges.length} exchanges`);
  } catch (error) {
    console.error('Error fetching exchanges:', error);
  }

  // Add delay to avoid rate limiting
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Fetch Layer 1 coins
  try {
    console.log('Fetching Layer 1 coins from CoinGecko...');
    const layer1 = await fetchCoinProjectInfo('layer-1');
    results.push(...layer1);
    console.log(`Fetched ${layer1.length} Layer 1 coins`);
  } catch (error) {
    console.error('Error fetching Layer 1 coins:', error);
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Fetch Layer 2 coins
  try {
    console.log('Fetching Layer 2 coins from CoinGecko...');
    const layer2 = await fetchCoinProjectInfo('layer-2');
    results.push(...layer2);
    console.log(`Fetched ${layer2.length} Layer 2 coins`);
  } catch (error) {
    console.error('Error fetching Layer 2 coins:', error);
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Fetch stablecoins
  try {
    console.log('Fetching stablecoins from CoinGecko...');
    const stablecoins = await fetchCoinProjectInfo('stablecoins');
    results.push(...stablecoins);
    console.log(`Fetched ${stablecoins.length} stablecoins`);
  } catch (error) {
    console.error('Error fetching stablecoins:', error);
  }

  return results;
}
