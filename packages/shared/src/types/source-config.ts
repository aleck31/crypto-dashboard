/**
 * Source Configuration Types
 *
 * Defines types for configurable data source management.
 * Sources can be dynamically added, modified, enabled/disabled via DynamoDB.
 */

// ============================================================================
// Collector Types
// ============================================================================

/** Supported collector types */
export type CollectorType =
  | 'api:rest'      // REST API
  | 'api:graphql'   // GraphQL API
  | 'rss'           // RSS Feed
  | 'scraper'       // Web Scraper (planned)
  | 'twitter'       // Twitter API (planned)
  | 'manual';       // Manual import

/** Source data type */
export type SourceType = 'project_info' | 'market_info';

// ============================================================================
// Collector Configurations
// ============================================================================

/** Field mapping rule for data transformation */
export interface FieldMappingRule {
  /** Source field path (supports JSONPath) */
  source: string;
  /** Transform function */
  transform?: 'string' | 'number' | 'date' | 'array' | 'lowercase' | 'uppercase';
  /** Default value if source is empty */
  default?: unknown;
}

/** Field mapping configuration */
export interface FieldMapping {
  [targetField: string]: string | FieldMappingRule;
}

/** REST API endpoint configuration */
export interface RestApiEndpoint {
  /** Endpoint path (can include query string, e.g., "/coins/markets?vs_currency=usd") */
  path: string;
  /** HTTP method */
  method: 'GET' | 'POST';
  /** Response field mapping */
  mapping: FieldMapping;
  /** Result limit */
  limit?: number;
}

/** REST API collector configuration */
export interface RestApiConfig {
  type: 'api:rest';
  /** Base URL */
  baseUrl: string;
  /** Endpoints to collect from */
  endpoints: RestApiEndpoint[];
  /** Request headers */
  headers?: Record<string, string>;
  /** API key stored in Secrets Manager (ARN) */
  apiKeySecretArn?: string;
  /** Rate limit (requests per minute) */
  rateLimit?: number;
  /** Request delay (milliseconds) */
  requestDelay?: number;
}

/** GraphQL API collector configuration */
export interface GraphQLConfig {
  type: 'api:graphql';
  /** GraphQL endpoint URL */
  endpoint: string;
  /** GraphQL query */
  query: string;
  /** Query variables */
  variables?: Record<string, unknown>;
  /** Response field mapping */
  mapping: FieldMapping;
  /** Request headers */
  headers?: Record<string, string>;
  /** API key stored in Secrets Manager (ARN) */
  apiKeySecretArn?: string;
}

/** RSS collector configuration */
export interface RssConfig {
  type: 'rss';
  /** RSS feed URL */
  url: string;
  /** Maximum items per collection */
  maxItems?: number;
  /** Custom User-Agent header */
  userAgent?: string;
  /** Field mapping (optional, has defaults) */
  mapping?: FieldMapping;
  /** Content language */
  language?: string;
}

/** Twitter collector configuration (planned) */
export interface TwitterConfig {
  type: 'twitter';
  /** Twitter accounts to follow */
  accounts: string[];
  /** Search keywords */
  keywords?: string[];
  /** Maximum tweets per collection */
  maxTweets?: number;
  /** API credentials stored in Secrets Manager (ARN) */
  credentialsSecretArn: string;
}

/** Manual import configuration */
export interface ManualConfig {
  type: 'manual';
  /** Import format */
  format: 'json' | 'csv';
  /** Field mapping */
  mapping?: FieldMapping;
}

/** Union type for all collector configurations */
export type CollectorConfig =
  | RestApiConfig
  | GraphQLConfig
  | RssConfig
  | TwitterConfig
  | ManualConfig;

// ============================================================================
// Source Configuration
// ============================================================================

/** Collection statistics */
export interface CollectionStats {
  /** Total items collected since creation */
  totalCollected: number;
  /** Successful collection count */
  successCount: number;
  /** Failed collection count */
  failedCount: number;
  /** Items collected in last run */
  lastItemCount: number;
}

/** Source configuration record (stored in DynamoDB) */
export interface SourceConfig {
  /** Primary key: "{type}:{sourceId}" e.g., "project_info:coingecko" */
  id: string;

  /** Data source type */
  type: SourceType;

  /** Source identifier (used for ProjectInfoSource / MarketInfoSource) */
  sourceId: string;

  /** Display name */
  name: string;

  /** Whether this source is enabled */
  enabled: boolean;

  /** String version of enabled for DynamoDB GSI (DynamoDB doesn't support boolean partition keys) */
  enabledStr: 'true' | 'false';

  /** Collector type */
  collectorType: CollectorType;

  /** Collector configuration */
  config: CollectorConfig;

  /** Collection interval in minutes */
  intervalMinutes: number;

  /** Priority (lower number = higher priority) */
  priority: number;

  /** Last collection timestamp (ISO 8601) */
  lastCollectedAt?: string;

  /** Last collection status */
  lastCollectStatus?: 'success' | 'failed';

  /** Last collection error message */
  lastCollectError?: string;

  /** Collection statistics */
  stats?: CollectionStats;

  /** Created timestamp (ISO 8601) */
  createdAt: string;

  /** Updated timestamp (ISO 8601) */
  updatedAt: string;
}

// ============================================================================
// Collector Interface
// ============================================================================

/** Collector result */
export interface CollectorResult {
  /** Whether collection succeeded */
  success: boolean;
  /** Collected items (typed as unknown[], will be ProjectInfo[] or MarketInfo[]) */
  items: unknown[];
  /** Error message if failed */
  error?: string;
  /** Collection statistics */
  stats: {
    /** Total items fetched */
    totalFetched: number;
    /** Items saved to database */
    savedCount: number;
    /** Items skipped (deduplication) */
    skippedCount: number;
  };
}

/** Validation result */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation error messages */
  errors: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate source config ID from type and sourceId
 */
export function generateSourceConfigId(type: SourceType, sourceId: string): string {
  return `${type}:${sourceId}`;
}

/**
 * Parse source config ID into type and sourceId
 */
export function parseSourceConfigId(id: string): { type: SourceType; sourceId: string } | null {
  const parts = id.split(':');
  if (parts.length < 2) return null;

  const type = parts[0] as SourceType;
  if (type !== 'project_info' && type !== 'market_info') return null;

  const sourceId = parts.slice(1).join(':');
  return { type, sourceId };
}

/**
 * Create a new source config with defaults
 */
export function createSourceConfig(
  params: Pick<SourceConfig, 'type' | 'sourceId' | 'name' | 'collectorType' | 'config'> &
    Partial<Pick<SourceConfig, 'intervalMinutes' | 'priority' | 'enabled'>>
): SourceConfig {
  const now = new Date().toISOString();
  const enabled = params.enabled ?? true;

  return {
    id: generateSourceConfigId(params.type, params.sourceId),
    type: params.type,
    sourceId: params.sourceId,
    name: params.name,
    enabled,
    enabledStr: enabled ? 'true' : 'false',
    collectorType: params.collectorType,
    config: params.config,
    intervalMinutes: params.intervalMinutes ?? 15,
    priority: params.priority ?? 100,
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// Default Source Configurations
// ============================================================================

/** Default project info sources */
export const DEFAULT_PROJECT_INFO_SOURCES: Omit<SourceConfig, 'id' | 'enabledStr' | 'createdAt' | 'updatedAt'>[] = [
  {
    type: 'project_info',
    sourceId: 'coingecko',
    name: 'CoinGecko',
    enabled: true,
    collectorType: 'api:rest',
    config: {
      type: 'api:rest',
      baseUrl: 'https://api.coingecko.com/api/v3',
      endpoints: [
        {
          path: '/exchanges?per_page=100',
          method: 'GET',
          mapping: {
            id: 'id',
            name: 'name',
            country: 'country',
            url: 'url',
            image: 'image',
            trust_score: 'trust_score',
            trust_score_rank: 'trust_score_rank',
            trade_volume_24h_btc: 'trade_volume_24h_btc',
          },
        },
        {
          path: '/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1',
          method: 'GET',
          mapping: {
            id: 'id',
            symbol: 'symbol',
            name: 'name',
            image: 'image',
            current_price: 'current_price',
            market_cap: 'market_cap',
            market_cap_rank: 'market_cap_rank',
            price_change_24h: 'price_change_percentage_24h',
          },
        },
      ],
      rateLimit: 10,
      requestDelay: 1000,
    } as RestApiConfig,
    intervalMinutes: 15,
    priority: 10,
  },
  {
    type: 'project_info',
    sourceId: 'defillama',
    name: 'DefiLlama',
    enabled: true,
    collectorType: 'api:rest',
    config: {
      type: 'api:rest',
      baseUrl: 'https://api.llama.fi',
      endpoints: [
        {
          path: '/protocols',
          method: 'GET',
          mapping: {
            id: 'slug',
            name: 'name',
            symbol: 'symbol',
            tvl: 'tvl',
            chain: 'chain',
            category: 'category',
            logo: 'logo',
            url: 'url',
          },
          limit: 100,
        },
        {
          path: '/chains',
          method: 'GET',
          mapping: {
            id: 'gecko_id',
            name: 'name',
            tvl: 'tvl',
            tokenSymbol: 'tokenSymbol',
          },
        },
      ],
      rateLimit: 30,
    } as RestApiConfig,
    intervalMinutes: 15,
    priority: 20,
  },
];

/** Default market info sources (RSS feeds) */
export const DEFAULT_MARKET_INFO_SOURCES: Omit<SourceConfig, 'id' | 'enabledStr' | 'createdAt' | 'updatedAt'>[] = [
  {
    type: 'market_info',
    sourceId: 'rss:coindesk',
    name: 'CoinDesk',
    enabled: true,
    collectorType: 'rss',
    config: {
      type: 'rss',
      url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
      maxItems: 20,
      language: 'en',
    } as RssConfig,
    intervalMinutes: 15,
    priority: 10,
  },
  {
    type: 'market_info',
    sourceId: 'rss:cointelegraph',
    name: 'Cointelegraph',
    enabled: true,
    collectorType: 'rss',
    config: {
      type: 'rss',
      url: 'https://cointelegraph.com/rss',
      maxItems: 20,
      language: 'en',
    } as RssConfig,
    intervalMinutes: 15,
    priority: 20,
  },
  {
    type: 'market_info',
    sourceId: 'rss:theblock',
    name: 'The Block',
    enabled: true,
    collectorType: 'rss',
    config: {
      type: 'rss',
      url: 'https://www.theblock.co/rss.xml',
      maxItems: 20,
      language: 'en',
    } as RssConfig,
    intervalMinutes: 15,
    priority: 30,
  },
  {
    type: 'market_info',
    sourceId: 'rss:decrypt',
    name: 'Decrypt',
    enabled: true,
    collectorType: 'rss',
    config: {
      type: 'rss',
      url: 'https://decrypt.co/feed',
      maxItems: 20,
      language: 'en',
    } as RssConfig,
    intervalMinutes: 15,
    priority: 40,
  },
];

/** All default sources */
export const DEFAULT_SOURCES = [
  ...DEFAULT_PROJECT_INFO_SOURCES,
  ...DEFAULT_MARKET_INFO_SOURCES,
];
