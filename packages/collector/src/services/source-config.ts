/**
 * Source Configuration Service
 *
 * Manages data source configurations stored in DynamoDB.
 * Provides CRUD operations and querying for enabled sources.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  SourceConfig,
  SourceType,
  CollectorConfig,
  CollectionStats,
  DEFAULT_PROJECT_INFO_SOURCES,
  DEFAULT_MARKET_INFO_SOURCES,
  createSourceConfig,
} from '@crypto-dashboard/shared';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const SOURCE_CONFIG_TABLE = process.env.SOURCE_CONFIG_TABLE_NAME || 'crypto-dashboard-source-config';

/**
 * Get all source configurations
 */
export async function getAllSourceConfigs(): Promise<SourceConfig[]> {
  const result = await docClient.send(new ScanCommand({
    TableName: SOURCE_CONFIG_TABLE,
  }));

  return (result.Items || []) as SourceConfig[];
}

/**
 * Get all enabled source configurations
 */
export async function getEnabledSourceConfigs(): Promise<SourceConfig[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: SOURCE_CONFIG_TABLE,
    IndexName: 'enabled-index',
    KeyConditionExpression: 'enabledStr = :enabled',
    ExpressionAttributeValues: {
      ':enabled': 'true',
    },
  }));

  return (result.Items || []) as SourceConfig[];
}

/**
 * Get source configurations by type
 */
export async function getSourceConfigsByType(type: SourceType): Promise<SourceConfig[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: SOURCE_CONFIG_TABLE,
    IndexName: 'type-index',
    KeyConditionExpression: '#type = :type',
    ExpressionAttributeNames: {
      '#type': 'type',
    },
    ExpressionAttributeValues: {
      ':type': type,
    },
  }));

  // Sort by priority (lower = higher priority)
  const items = (result.Items || []) as SourceConfig[];
  return items.sort((a, b) => a.priority - b.priority);
}

/**
 * Get enabled source configurations by type
 */
export async function getEnabledSourceConfigsByType(type: SourceType): Promise<SourceConfig[]> {
  const allByType = await getSourceConfigsByType(type);
  return allByType.filter(config => config.enabled);
}

/**
 * Get a single source configuration by ID
 */
export async function getSourceConfig(id: string): Promise<SourceConfig | null> {
  const result = await docClient.send(new GetCommand({
    TableName: SOURCE_CONFIG_TABLE,
    Key: { id },
  }));

  return (result.Item as SourceConfig) || null;
}

/**
 * Create or update a source configuration
 */
export async function saveSourceConfig(config: SourceConfig): Promise<void> {
  // Ensure enabledStr is in sync with enabled
  const updatedConfig = {
    ...config,
    enabledStr: config.enabled ? 'true' : 'false',
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: SOURCE_CONFIG_TABLE,
    Item: updatedConfig,
  }));
}

/**
 * Delete a source configuration
 */
export async function deleteSourceConfig(id: string): Promise<void> {
  await docClient.send(new DeleteCommand({
    TableName: SOURCE_CONFIG_TABLE,
    Key: { id },
  }));
}

/**
 * Toggle source enabled status
 */
export async function toggleSourceConfig(id: string): Promise<SourceConfig | null> {
  const config = await getSourceConfig(id);
  if (!config) return null;

  const newEnabled = !config.enabled;

  await docClient.send(new UpdateCommand({
    TableName: SOURCE_CONFIG_TABLE,
    Key: { id },
    UpdateExpression: 'SET enabled = :enabled, enabledStr = :enabledStr, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':enabled': newEnabled,
      ':enabledStr': newEnabled ? 'true' : 'false',
      ':updatedAt': new Date().toISOString(),
    },
  }));

  return { ...config, enabled: newEnabled, enabledStr: newEnabled ? 'true' : 'false' };
}

/**
 * Update source collection status and stats
 */
export async function updateSourceCollectionStatus(
  id: string,
  status: 'success' | 'failed',
  error?: string,
  itemCount?: number
): Promise<void> {
  const config = await getSourceConfig(id);
  if (!config) return;

  const now = new Date().toISOString();

  // Calculate new stats
  const currentStats = config.stats || {
    totalCollected: 0,
    successCount: 0,
    failedCount: 0,
    lastItemCount: 0,
  };

  const newStats: CollectionStats = {
    totalCollected: currentStats.totalCollected + (itemCount || 0),
    successCount: currentStats.successCount + (status === 'success' ? 1 : 0),
    failedCount: currentStats.failedCount + (status === 'failed' ? 1 : 0),
    lastItemCount: itemCount || 0,
  };

  const updateExpression = status === 'failed'
    ? 'SET lastCollectedAt = :time, lastCollectStatus = :status, lastCollectError = :error, stats = :stats, updatedAt = :updatedAt'
    : 'SET lastCollectedAt = :time, lastCollectStatus = :status, stats = :stats, updatedAt = :updatedAt REMOVE lastCollectError';

  const expressionValues: Record<string, unknown> = {
    ':time': now,
    ':status': status,
    ':stats': newStats,
    ':updatedAt': now,
  };

  if (status === 'failed') {
    expressionValues[':error'] = error || 'Unknown error';
  }

  await docClient.send(new UpdateCommand({
    TableName: SOURCE_CONFIG_TABLE,
    Key: { id },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionValues,
  }));
}

/**
 * Initialize default source configurations if table is empty
 */
export async function initializeDefaultSources(): Promise<number> {
  // Check if there are any existing configs
  const existing = await getAllSourceConfigs();
  if (existing.length > 0) {
    console.log(`Source config table already has ${existing.length} configs, skipping initialization`);
    return 0;
  }

  console.log('Initializing default source configurations...');

  // Import default sources dynamically to avoid circular dependencies
  const { DEFAULT_PROJECT_INFO_SOURCES, DEFAULT_MARKET_INFO_SOURCES, createSourceConfig } = await import('@crypto-dashboard/shared');

  const allDefaults = [...DEFAULT_PROJECT_INFO_SOURCES, ...DEFAULT_MARKET_INFO_SOURCES];
  let createdCount = 0;

  for (const source of allDefaults) {
    const config = createSourceConfig({
      type: source.type,
      sourceId: source.sourceId,
      name: source.name,
      collectorType: source.collectorType,
      config: source.config,
      intervalMinutes: source.intervalMinutes,
      priority: source.priority,
      enabled: source.enabled,
    });

    await saveSourceConfig(config);
    createdCount++;
    console.log(`Created source config: ${config.id}`);
  }

  console.log(`Initialized ${createdCount} default source configurations`);
  return createdCount;
}

/**
 * Check if a source should be collected based on interval
 */
export function shouldCollect(config: SourceConfig): boolean {
  if (!config.enabled) return false;
  if (!config.lastCollectedAt) return true;

  const lastCollected = new Date(config.lastCollectedAt);
  const now = new Date();
  const minutesSinceLastCollect = (now.getTime() - lastCollected.getTime()) / (1000 * 60);

  return minutesSinceLastCollect >= config.intervalMinutes;
}
