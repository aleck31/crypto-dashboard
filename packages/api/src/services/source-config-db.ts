/**
 * Source Config DynamoDB Service
 *
 * Handles CRUD operations for source configurations.
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
import type { SourceConfig, SourceType, createSourceConfig } from '@crypto-dashboard/shared';

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

  const items = (result.Items || []) as SourceConfig[];
  return items.sort((a, b) => a.priority - b.priority);
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
 * Get enabled source configurations
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
