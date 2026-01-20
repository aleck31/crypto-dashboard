import type { ProjectInfo, ProjectInfoSource } from '@crypto-dashboard/shared';
import { generateProjectInfoId, generateContentHash } from '@crypto-dashboard/shared';

const DEFILLAMA_API_BASE = 'https://api.llama.fi';

interface DefiLlamaProtocol {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  url?: string;
  twitter?: string;
  category?: string;
  chains?: string[];
  tvl?: number;
  change_1h?: number;
  change_1d?: number;
  change_7d?: number;
  audits?: string;
  audit_links?: string[];
  mcap?: number;
  symbol?: string;
  description?: string;
}

interface DefiLlamaChain {
  name: string;
  tvl: number;
  tokenSymbol?: string;
  cmcId?: string;
  gecko_id?: string;
}

async function fetchWithRetry<T>(url: string, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
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

const SOURCE: ProjectInfoSource = 'defillama';

/**
 * Fetch protocols and convert to ProjectInfo
 */
async function fetchProtocolProjectInfo(): Promise<ProjectInfo[]> {
  const protocols = await fetchWithRetry<DefiLlamaProtocol[]>(
    `${DEFILLAMA_API_BASE}/protocols`
  );

  // Filter to top 100 by TVL
  const sorted = protocols
    .filter((p) => p.tvl && p.tvl > 0)
    .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
    .slice(0, 100);

  const now = new Date().toISOString();

  return sorted.map((protocol) => {
    const rawData = protocol as unknown as Record<string, unknown>;
    const dataHash = generateContentHash(JSON.stringify(rawData));

    // Determine category
    const isDex = protocol.category?.toLowerCase().includes('dex') ||
      protocol.category?.toLowerCase().includes('exchange');
    const sourceCategory = isDex ? 'dex' : protocol.category || 'defi';

    const info: ProjectInfo = {
      id: generateProjectInfoId(SOURCE, protocol.slug || protocol.id),
      source: SOURCE,
      sourceId: protocol.slug || protocol.id,
      rawData,
      name: protocol.name,
      logo: protocol.logo,
      website: protocol.url,
      description: protocol.description || `${protocol.name} - ${protocol.category || 'DeFi Protocol'}`,
      sourceCategory,
      chains: protocol.chains,
      tokenSymbol: protocol.symbol,
      twitter: protocol.twitter,
      collectedAt: now,
      processedStatus: 'pending',
      dataHash,
    };

    return info;
  });
}

/**
 * Fetch chains and convert to ProjectInfo
 */
async function fetchChainProjectInfo(): Promise<ProjectInfo[]> {
  const chains = await fetchWithRetry<DefiLlamaChain[]>(
    `${DEFILLAMA_API_BASE}/chains`
  );

  // Get top chains by TVL
  const topChains = chains
    .filter((c) => c.tvl > 0)
    .sort((a, b) => b.tvl - a.tvl)
    .slice(0, 30);

  const now = new Date().toISOString();

  // Determine if L1 or L2 based on common names
  const l2Names = ['arbitrum', 'optimism', 'polygon', 'base', 'zksync', 'starknet', 'linea', 'scroll', 'manta', 'blast'];

  return topChains.map((chain) => {
    const rawData = chain as unknown as Record<string, unknown>;
    const dataHash = generateContentHash(JSON.stringify(rawData));

    const isL2 = l2Names.some((name) => chain.name.toLowerCase().includes(name));
    const sourceCategory = isL2 ? 'layer-2' : 'layer-1';

    const info: ProjectInfo = {
      id: generateProjectInfoId(SOURCE, chain.name.toLowerCase().replace(/\s+/g, '-')),
      source: SOURCE,
      sourceId: chain.name.toLowerCase().replace(/\s+/g, '-'),
      rawData,
      name: chain.name,
      description: `${chain.name} - ${isL2 ? 'Layer 2' : 'Layer 1'} blockchain`,
      sourceCategory,
      tokenSymbol: chain.tokenSymbol,
      collectedAt: now,
      processedStatus: 'pending',
      dataHash,
    };

    return info;
  });
}

/**
 * Collect all ProjectInfo from DefiLlama
 */
export async function collectDefiLlamaProjectInfo(): Promise<ProjectInfo[]> {
  const results: ProjectInfo[] = [];

  // Fetch protocols
  try {
    console.log('Fetching protocols from DefiLlama...');
    const protocols = await fetchProtocolProjectInfo();
    results.push(...protocols);
    console.log(`Fetched ${protocols.length} protocols`);
  } catch (error) {
    console.error('Error fetching protocols:', error);
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Fetch chains
  try {
    console.log('Fetching chains from DefiLlama...');
    const chains = await fetchChainProjectInfo();
    results.push(...chains);
    console.log(`Fetched ${chains.length} chains`);
  } catch (error) {
    console.error('Error fetching chains:', error);
  }

  return results;
}
