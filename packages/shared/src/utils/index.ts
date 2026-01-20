import type {
  Project,
  ProjectStatus,
  NewsSentiment,
  HealthScoreBreakdown,
  RiskFlag,
  OpportunityFlag,
} from '../types/index.js';

/**
 * Calculate health score based on multiple factors
 * 健康度评分 = 0.3 × 基础指标 + 0.3 × 舆情得分 + 0.2 × 资金安全 + 0.2 × 发展趋势
 */
export function calculateHealthScore(breakdown: HealthScoreBreakdown): number {
  const score =
    breakdown.baseMetrics * 0.3 +
    breakdown.sentimentScore * 0.3 +
    breakdown.fundSafety * 0.2 +
    breakdown.developmentTrend * 0.2;
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Determine project status based on health score and flags
 */
export function determineProjectStatus(
  healthScore: number,
  riskFlags: RiskFlag[],
  opportunityFlags: OpportunityFlag[]
): ProjectStatus {
  // Critical risk flags override everything
  const hasCriticalRisk = riskFlags.some((f) => f.severity === 'critical');
  if (hasCriticalRisk) return 'danger';

  const hasHighRisk = riskFlags.some((f) => f.severity === 'high');
  if (hasHighRisk || healthScore < 30) return 'danger';

  const hasMediumRisk = riskFlags.some((f) => f.severity === 'medium');
  if (hasMediumRisk || healthScore < 50) return 'warning';

  const hasHighOpportunity = opportunityFlags.some((f) => f.importance === 'high');
  if (hasHighOpportunity || healthScore >= 80) return 'watch';

  return 'normal';
}

/**
 * Convert sentiment to numeric score
 */
export function sentimentToScore(sentiment: NewsSentiment): number {
  switch (sentiment) {
    case 'positive':
      return 80;
    case 'neutral':
      return 50;
    case 'negative':
      return 20;
    default:
      return 50;
  }
}

/**
 * Format large numbers for display
 */
export function formatNumber(value: number | undefined, options?: {
  style?: 'currency' | 'decimal' | 'percent';
  currency?: string;
  compact?: boolean;
  decimals?: number;
}): string {
  if (value === undefined || value === null) return '-';

  const {
    style = 'decimal',
    currency = 'USD',
    compact = true,
    decimals = 2,
  } = options || {};

  if (compact && Math.abs(value) >= 1000) {
    const suffixes = ['', 'K', 'M', 'B', 'T'];
    const tier = Math.floor(Math.log10(Math.abs(value)) / 3);
    const suffix = suffixes[Math.min(tier, suffixes.length - 1)];
    const scale = Math.pow(10, tier * 3);
    const scaledValue = value / scale;

    if (style === 'currency') {
      return `$${scaledValue.toFixed(decimals)}${suffix}`;
    }
    return `${scaledValue.toFixed(decimals)}${suffix}`;
  }

  const formatter = new Intl.NumberFormat('en-US', {
    style,
    currency: style === 'currency' ? currency : undefined,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return formatter.format(value);
}

/**
 * Format percentage change
 */
export function formatPercentChange(value: number | undefined): string {
  if (value === undefined || value === null) return '-';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Format date to relative time
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Slugify a string for URL-safe IDs
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if a project has any active alerts
 */
export function hasActiveAlerts(project: Project): boolean {
  return (
    project.riskFlags.some((f) => f.severity === 'high' || f.severity === 'critical') ||
    project.status === 'danger' ||
    project.status === 'warning'
  );
}

/**
 * Get the most severe risk flag
 */
export function getMostSevereRisk(riskFlags: RiskFlag[]): RiskFlag | null {
  if (riskFlags.length === 0) return null;

  const severityOrder = ['critical', 'high', 'medium', 'low'];
  return riskFlags.reduce((most, current) => {
    const mostIndex = severityOrder.indexOf(most.severity);
    const currentIndex = severityOrder.indexOf(current.severity);
    return currentIndex < mostIndex ? current : most;
  });
}

/**
 * Sort projects by health score
 */
export function sortByHealthScore(projects: Project[], ascending = false): Project[] {
  return [...projects].sort((a, b) =>
    ascending ? a.healthScore - b.healthScore : b.healthScore - a.healthScore
  );
}

/**
 * Filter projects by category
 */
export function filterByCategory<T extends Project>(
  projects: T[],
  categories: string[]
): T[] {
  if (categories.length === 0) return projects;
  return projects.filter((p) => categories.includes(p.category));
}

/**
 * Search projects by name or description
 */
export function searchProjects<T extends Project>(
  projects: T[],
  query: string
): T[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return projects;

  return projects.filter(
    (p) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.description?.toLowerCase().includes(lowerQuery) ||
      p.category.toLowerCase().includes(lowerQuery)
  );
}

/**
 * API endpoints configuration
 */
export const API_ENDPOINTS = {
  projects: '/api/projects',
  projectDetail: (id: string) => `/api/projects/${id}`,
  dashboard: '/api/dashboard',
  categories: '/api/categories',
  alerts: '/api/alerts',
  refresh: '/api/refresh',
} as const;

/**
 * External data source URLs
 */
export const DATA_SOURCES = {
  coingecko: {
    baseUrl: 'https://api.coingecko.com/api/v3',
    exchanges: '/exchanges',
    coins: '/coins/markets',
    coinDetail: (id: string) => `/coins/${id}`,
  },
  defillama: {
    baseUrl: 'https://api.llama.fi',
    protocols: '/protocols',
    tvl: '/tvl',
    chains: '/chains',
  },
} as const;
