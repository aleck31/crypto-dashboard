// Re-export Information Layer types
export * from './information.js';

// Re-export Source Configuration types
export * from './source-config.js';

// Project Categories (赛道分类)
export type ProjectCategory =
  | 'cex'           // 中心化交易所
  | 'dex'           // 去中心化交易所
  | 'market_maker'  // 量化/做市
  | 'payment'       // 支付
  | 'layer1'        // 公链
  | 'layer2'        // L2
  | 'defi'          // DeFi 协议
  | 'wallet'        // 钱包
  | 'infrastructure'// 基础设施
  | 'stablecoin';   // 稳定币

// Project Status
export type ProjectStatus = 'normal' | 'watch' | 'warning' | 'danger';

// News Sentiment
export type NewsSentiment = 'positive' | 'neutral' | 'negative';

// Risk Flag Types
export type RiskFlagType =
  | 'regulatory_risk'
  | 'security_breach'
  | 'liquidity_crisis'
  | 'team_departure'
  | 'legal_issues'
  | 'fund_issues'
  | 'layoffs'
  | 'audit_failed';

// Opportunity Flag Types
export type OpportunityFlagType =
  | 'new_funding'
  | 'product_launch'
  | 'partnership'
  | 'ecosystem_growth'
  | 'regulatory_approval'
  | 'major_upgrade';

// Event interface for recent events
export interface ProjectEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  source: string;
  sourceUrl?: string;
  sentiment: NewsSentiment;
  eventType: 'news' | 'funding' | 'product' | 'security' | 'regulatory';
}

// Risk Flag
export interface RiskFlag {
  type: RiskFlagType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: string;
  source?: string;
}

// Opportunity Flag
export interface OpportunityFlag {
  type: OpportunityFlagType;
  importance: 'low' | 'medium' | 'high';
  description: string;
  detectedAt: string;
  source?: string;
}

// Base Project interface (通用属性)
export interface BaseProject {
  id: string;
  name: string;
  logo?: string;
  website?: string;
  twitter?: string;
  category: ProjectCategory;
  subcategory?: string;
  description?: string;
  status: ProjectStatus;
  healthScore: number; // 0-100
  lastUpdated: string;
  newsSentiment: NewsSentiment;
  recentEvents: ProjectEvent[];
  riskFlags: RiskFlag[];
  opportunityFlags: OpportunityFlag[];
  // Source IDs for data correlation
  coingeckoId?: string;
  defillamaId?: string;
}

// CEX/DEX Exchange specific attributes
export interface ExchangeAttributes {
  dailyVolume?: number;
  dailyVolumeChange24h?: number;
  reservesTransparency: 'full' | 'partial' | 'none' | 'unknown';
  proofOfReserves?: boolean;
  regulatoryStatus: 'licensed' | 'pending' | 'unlicensed' | 'banned' | 'unknown';
  supportedCountries?: string[];
  tradingPairs?: number;
  spotVolume?: number;
  derivativesVolume?: number;
}

// Market Maker / Quantitative Trading
export interface MarketMakerAttributes {
  aum?: number;
  trackRecord?: string;
  counterpartyExposure?: string[];
  strategies?: string[];
  fundingRounds?: FundingRound[];
}

// DeFi Protocol
export interface DeFiAttributes {
  tvl?: number;
  tvlChange24h?: number;
  tvlChange7d?: number;
  auditStatus: 'audited' | 'partial' | 'unaudited' | 'unknown';
  auditors?: string[];
  exploitHistory?: SecurityIncident[];
  tokenSymbol?: string;
  tokenPrice?: number;
  tokenMarketCap?: number;
  chains?: string[];
  category?: string; // lending, dex, yield, etc.
}

// Layer 1/2 Chain
export interface ChainAttributes {
  tps?: number;
  blockTime?: number;
  activeAddresses24h?: number;
  activeAddresses7d?: number;
  developerActivity?: number; // GitHub commits, etc.
  ecosystemSize?: number; // number of dApps
  tvl?: number;
  tokenSymbol?: string;
  tokenPrice?: number;
  tokenMarketCap?: number;
  consensusMechanism?: string;
  chains?: string[]; // for L2, parent chains
}

// Stablecoin
export interface StablecoinAttributes {
  marketCap?: number;
  circulatingSupply?: number;
  pegDeviation?: number; // percentage from $1
  backingType: 'fiat' | 'crypto' | 'algorithmic' | 'hybrid';
  reserveComposition?: Record<string, number>;
  attestationFrequency?: string;
  chains?: string[];
}

// Wallet / Infrastructure
export interface InfrastructureAttributes {
  userCount?: number;
  transactionVolume?: number;
  supportedChains?: string[];
  securityFeatures?: string[];
  fundingRounds?: FundingRound[];
}

// Payment
export interface PaymentAttributes {
  transactionVolume?: number;
  supportedCurrencies?: string[];
  supportedCountries?: string[];
  regulatoryLicenses?: string[];
  fundingRounds?: FundingRound[];
}

// Funding Round
export interface FundingRound {
  date: string;
  round: string;
  amount?: number;
  valuation?: number;
  investors?: string[];
}

// Security Incident
export interface SecurityIncident {
  date: string;
  type: 'exploit' | 'hack' | 'rugpull' | 'bug' | 'other';
  description: string;
  lossAmount?: number;
  recovered?: boolean;
  recoveredAmount?: number;
}

// Combined Project types
export interface CEXProject extends BaseProject {
  category: 'cex';
  attributes: ExchangeAttributes;
}

export interface DEXProject extends BaseProject {
  category: 'dex';
  attributes: ExchangeAttributes & DeFiAttributes;
}

export interface MarketMakerProject extends BaseProject {
  category: 'market_maker';
  attributes: MarketMakerAttributes;
}

export interface PaymentProject extends BaseProject {
  category: 'payment';
  attributes: PaymentAttributes;
}

export interface Layer1Project extends BaseProject {
  category: 'layer1';
  attributes: ChainAttributes;
}

export interface Layer2Project extends BaseProject {
  category: 'layer2';
  attributes: ChainAttributes;
}

export interface DeFiProject extends BaseProject {
  category: 'defi';
  attributes: DeFiAttributes;
}

export interface WalletProject extends BaseProject {
  category: 'wallet';
  attributes: InfrastructureAttributes;
}

export interface InfrastructureProject extends BaseProject {
  category: 'infrastructure';
  attributes: InfrastructureAttributes;
}

export interface StablecoinProject extends BaseProject {
  category: 'stablecoin';
  attributes: StablecoinAttributes;
}

// Union type of all projects
export type Project =
  | CEXProject
  | DEXProject
  | MarketMakerProject
  | PaymentProject
  | Layer1Project
  | Layer2Project
  | DeFiProject
  | WalletProject
  | InfrastructureProject
  | StablecoinProject;

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  lastEvaluatedKey?: Record<string, unknown>;
}

export interface ProjectListResponse extends PaginatedResponse<Project> {}

export interface ProjectDetailResponse {
  project: Project;
  relatedProjects?: BaseProject[];
}

// Dashboard Summary
export interface DashboardSummary {
  totalProjects: number;
  byCategory: Record<ProjectCategory, number>;
  byStatus: Record<ProjectStatus, number>;
  recentAlerts: ProjectEvent[];
  topGainers: { project: BaseProject; change: number }[];
  topLosers: { project: BaseProject; change: number }[];
  lastUpdated: string;
}

// Filter Options
export interface ProjectFilters {
  categories?: ProjectCategory[];
  status?: ProjectStatus[];
  sentiment?: NewsSentiment[];
  minHealthScore?: number;
  maxHealthScore?: number;
  search?: string;
  sortBy?: 'name' | 'healthScore' | 'tvl' | 'volume' | 'lastUpdated';
  sortOrder?: 'asc' | 'desc';
}

// Health Score Components
export interface HealthScoreBreakdown {
  baseMetrics: number;      // 30%
  sentimentScore: number;   // 30%
  fundSafety: number;       // 20%
  developmentTrend: number; // 20%
  total: number;
}

// Category metadata for UI
export interface CategoryInfo {
  id: ProjectCategory;
  name: string;
  nameCN: string;
  description: string;
  icon: string;
}

export const CATEGORY_INFO: CategoryInfo[] = [
  { id: 'cex', name: 'CEX', nameCN: '中心化交易所', description: 'Centralized Exchanges', icon: 'building-2' },
  { id: 'dex', name: 'DEX', nameCN: '去中心化交易所', description: 'Decentralized Exchanges', icon: 'repeat' },
  { id: 'market_maker', name: 'Market Maker', nameCN: '量化/做市', description: 'Quantitative Trading & Market Making', icon: 'trending-up' },
  { id: 'payment', name: 'Payment', nameCN: '支付', description: 'Payment Solutions', icon: 'credit-card' },
  { id: 'layer1', name: 'Layer 1', nameCN: '公链', description: 'Layer 1 Blockchains', icon: 'layers' },
  { id: 'layer2', name: 'Layer 2', nameCN: 'L2', description: 'Layer 2 Scaling Solutions', icon: 'layers' },
  { id: 'defi', name: 'DeFi', nameCN: 'DeFi 协议', description: 'Decentralized Finance Protocols', icon: 'landmark' },
  { id: 'wallet', name: 'Wallet', nameCN: '钱包', description: 'Cryptocurrency Wallets', icon: 'wallet' },
  { id: 'infrastructure', name: 'Infrastructure', nameCN: '基础设施', description: 'Blockchain Infrastructure', icon: 'server' },
  { id: 'stablecoin', name: 'Stablecoin', nameCN: '稳定币', description: 'Stablecoins', icon: 'dollar-sign' },
];

// Status metadata for UI
export interface StatusInfo {
  id: ProjectStatus;
  name: string;
  nameCN: string;
  color: string;
  bgColor: string;
}

export const STATUS_INFO: StatusInfo[] = [
  { id: 'normal', name: 'Normal', nameCN: '正常', color: 'text-green-600', bgColor: 'bg-green-100' },
  { id: 'watch', name: 'Watch', nameCN: '关注', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  { id: 'warning', name: 'Warning', nameCN: '警告', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  { id: 'danger', name: 'Danger', nameCN: '危险', color: 'text-red-600', bgColor: 'bg-red-100' },
];
