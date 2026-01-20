/**
 * 信息层类型定义 (Information Layer)
 *
 * 信息层负责存储从外部数据源采集的原始信息，分为两类：
 * 1. ProjectInfo - 项目信息（低频采集）
 * 2. MarketInfo - 市场信息（高频采集）
 */

// ============================================================================
// 数据源类型
// ============================================================================

/** 项目信息数据源 */
export type ProjectInfoSource =
  | 'coingecko'
  | 'defillama'
  | 'manual'
  | 'website'
  | 'github';

/** 市场信息数据源 */
export type MarketInfoSource =
  | 'rss:coindesk'
  | 'rss:theblock'
  | 'rss:decrypt'
  | 'rss:cointelegraph'
  | 'rss:blockworks'
  | 'twitter'
  | 'manual';

/** 处理状态 */
export type ProcessedStatus = 'pending' | 'processing' | 'processed' | 'failed';

/** 事件类型 */
export type MarketEventType =
  | 'funding'       // 融资
  | 'product'       // 产品发布
  | 'security'      // 安全事件
  | 'regulatory'    // 监管动态
  | 'partnership'   // 合作伙伴
  | 'listing'       // 上线/下线
  | 'airdrop'       // 空投
  | 'governance'    // 治理
  | 'technical'     // 技术更新
  | 'legal'         // 法律诉讼
  | 'personnel'     // 人事变动
  | 'general';      // 一般新闻

// ============================================================================
// 项目信息 (ProjectInfo)
// ============================================================================

/**
 * 项目原始信息
 * 从 CoinGecko, DefiLlama 等数据源采集的项目基础信息
 */
export interface ProjectInfo {
  /** 唯一标识: {source}:{sourceId} 例如 "coingecko:binance" */
  id: string;

  /** 数据来源 */
  source: ProjectInfoSource;

  /** 来源系统中的 ID */
  sourceId: string;

  /** 原始 JSON 数据 */
  rawData: Record<string, unknown>;

  // === 标准化字段 ===

  /** 项目名称 */
  name: string;

  /** 项目 Logo URL */
  logo?: string;

  /** 官网 */
  website?: string;

  /** 项目描述 */
  description?: string;

  /** 数据源中的分类 */
  sourceCategory?: string;

  /** 支持的链 */
  chains?: string[];

  /** 代币符号 */
  tokenSymbol?: string;

  /** Twitter 账号 */
  twitter?: string;

  /** GitHub 组织/仓库 */
  github?: string;

  // === 关联 ===

  /** 关联的项目实体 ID (AI Agent 处理后设置) */
  projectEntityId?: string;

  // === 元数据 ===

  /** 采集时间 */
  collectedAt: string;

  /** AI 处理时间 */
  processedAt?: string;

  /** 处理状态 */
  processedStatus: ProcessedStatus;

  /** 处理失败原因 */
  processError?: string;

  /** 数据版本 (用于去重) */
  dataHash?: string;
}

// ============================================================================
// 市场信息 (MarketInfo)
// ============================================================================

/**
 * 市场原始信息
 * 从 RSS, Twitter 等数据源采集的新闻/动态信息
 */
export interface MarketInfo {
  /** 唯一标识: UUID */
  id: string;

  /** 数据来源 */
  source: MarketInfoSource;

  /** 原始 JSON 数据 */
  rawData: Record<string, unknown>;

  // === 标准化字段 ===

  /** 标题 */
  title: string;

  /** 内容摘要 */
  content: string;

  /** 完整内容 (如果有) */
  fullContent?: string;

  /** 原文 URL */
  url?: string;

  /** 发布时间 */
  publishedAt: string;

  /** 作者 */
  author?: string;

  /** 原文标签/分类 */
  tags?: string[];

  /** 语言 */
  language?: string;

  // === AI 处理结果 ===

  /** AI 识别的相关项目实体 IDs */
  relatedProjectIds?: string[];

  /** AI 识别的相关项目名称 (原始提及) */
  mentionedProjects?: string[];

  /** 情绪分析结果 */
  sentiment?: 'positive' | 'neutral' | 'negative';

  /** 情绪分数 (-1 到 1) */
  sentimentScore?: number;

  /** 事件类型 */
  eventType?: MarketEventType;

  /** AI 生成的摘要 */
  aiSummary?: string;

  /** AI 识别的风险信号 */
  riskSignals?: string[];

  /** AI 识别的机会信号 */
  opportunitySignals?: string[];

  /** 重要性评分 (0-100) */
  importanceScore?: number;

  // === 元数据 ===

  /** 采集时间 */
  collectedAt: string;

  /** AI 处理时间 */
  processedAt?: string;

  /** 处理状态 */
  processedStatus: ProcessedStatus;

  /** 处理失败原因 */
  processError?: string;

  /** 内容哈希 (用于去重) */
  contentHash?: string;

  /** TTL 过期时间 (Unix timestamp, 用于自动清理旧数据) */
  ttl?: number;
}

// ============================================================================
// AI Agent 相关类型
// ============================================================================

/** AI Agent 输入类型 */
export interface AIAgentInput {
  type: 'project_info' | 'market_info';
  data: ProjectInfo | MarketInfo;
  /** 已有的项目实体列表 (用于匹配) */
  existingProjects?: Array<{ id: string; name: string; aliases?: string[] }>;
}

/** 实体操作类型 */
export type EntityOperationType = 'create' | 'update' | 'add_event';

/** 实体创建操作 */
export interface CreateEntityOperation {
  type: 'create';
  entity: {
    id: string;
    name: string;
    category: string;
    description?: string;
    logo?: string;
    website?: string;
    twitter?: string;
    attributes?: Record<string, unknown>;
  };
}

/** 实体更新操作 */
export interface UpdateEntityOperation {
  type: 'update';
  entityId: string;
  updates: {
    healthScore?: number;
    status?: string;
    newsSentiment?: string;
    attributes?: Record<string, unknown>;
  };
  reason: string;
}

/** 添加事件操作 */
export interface AddEventOperation {
  type: 'add_event';
  entityId: string;
  event: {
    title: string;
    description: string;
    date: string;
    source: string;
    sourceUrl?: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    eventType: MarketEventType;
  };
}

/** 添加风险标签操作 */
export interface AddRiskFlagOperation {
  type: 'add_risk_flag';
  entityId: string;
  flag: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    source?: string;
  };
}

/** 添加机会标签操作 */
export interface AddOpportunityFlagOperation {
  type: 'add_opportunity_flag';
  entityId: string;
  flag: {
    type: string;
    importance: 'low' | 'medium' | 'high';
    description: string;
    source?: string;
  };
}

export type EntityOperation =
  | CreateEntityOperation
  | UpdateEntityOperation
  | AddEventOperation
  | AddRiskFlagOperation
  | AddOpportunityFlagOperation;

/** AI Agent 输出 */
export interface AIAgentOutput {
  /** 实体操作列表 */
  operations: EntityOperation[];

  /** 分析结果 */
  analysis: {
    /** 情绪 */
    sentiment?: 'positive' | 'neutral' | 'negative';
    /** 事件类型 */
    eventType?: MarketEventType;
    /** 识别到的项目 */
    identifiedProjects?: Array<{
      entityId?: string;  // 已存在的实体 ID
      name: string;       // 项目名称
      confidence: number; // 置信度 0-1
    }>;
    /** 关键信息 */
    keyInsights?: string[];
  };

  /** 处理说明 */
  reasoning: string;
}

// ============================================================================
// 辅助函数
// ============================================================================

/** 生成 ProjectInfo ID */
export function generateProjectInfoId(source: ProjectInfoSource, sourceId: string): string {
  return `${source}:${sourceId}`;
}

/** 生成内容哈希 (简单实现) */
export function generateContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/** 计算 TTL (默认 30 天) */
export function calculateTTL(days: number = 30): number {
  return Math.floor(Date.now() / 1000) + (days * 24 * 60 * 60);
}
