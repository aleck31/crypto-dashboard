import type { ScheduledEvent, Context, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type { ProjectInfo, MarketInfo, SourceConfig, CollectorResult } from '@crypto-dashboard/shared';
import {
  getEnabledSourceConfigs,
  initializeDefaultSources,
  updateSourceCollectionStatus,
  getSourceConfig,
  shouldCollect,
} from './services/source-config.js';
import { getCollector, isCollectorSupported } from './collectors/registry.js';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});
const sqsClient = new SQSClient({});

// Environment variables
const PROJECT_INFO_TABLE = process.env.PROJECT_INFO_TABLE_NAME || 'crypto-dashboard-project-info';
const MARKET_INFO_TABLE = process.env.MARKET_INFO_TABLE_NAME || 'crypto-dashboard-market-info';
const INFO_QUEUE_URL = process.env.INFO_QUEUE_URL;

interface SQSMessage {
  type: 'project_info' | 'market_info';
  infoId: string;
}

/**
 * Check if ProjectInfo already exists and has the same data
 */
async function isDuplicateProjectInfo(info: ProjectInfo): Promise<boolean> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: PROJECT_INFO_TABLE,
      Key: { id: info.id },
      ProjectionExpression: 'dataHash',
    }));

    if (!result.Item) return false;
    return result.Item.dataHash === info.dataHash;
  } catch {
    return false;
  }
}

/**
 * Check if MarketInfo already exists (by content hash)
 */
async function isDuplicateMarketInfo(info: MarketInfo): Promise<boolean> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: MARKET_INFO_TABLE,
      Key: { id: info.id },
    }));
    return !!result.Item;
  } catch {
    return false;
  }
}

/**
 * Save ProjectInfo to DynamoDB
 */
async function saveProjectInfo(info: ProjectInfo): Promise<boolean> {
  if (await isDuplicateProjectInfo(info)) {
    console.log(`Skipping duplicate ProjectInfo: ${info.id}`);
    return false;
  }

  await docClient.send(new PutCommand({
    TableName: PROJECT_INFO_TABLE,
    Item: info,
  }));

  return true;
}

/**
 * Save MarketInfo to DynamoDB
 */
async function saveMarketInfo(info: MarketInfo): Promise<boolean> {
  if (await isDuplicateMarketInfo(info)) {
    console.log(`Skipping duplicate MarketInfo: ${info.id}`);
    return false;
  }

  await docClient.send(new PutCommand({
    TableName: MARKET_INFO_TABLE,
    Item: info,
  }));

  return true;
}

/**
 * Send message to SQS for AI processing
 */
async function sendToQueue(message: SQSMessage): Promise<void> {
  if (!INFO_QUEUE_URL) {
    console.warn('INFO_QUEUE_URL not set, skipping queue message');
    return;
  }

  await sqsClient.send(new SendMessageCommand({
    QueueUrl: INFO_QUEUE_URL,
    MessageBody: JSON.stringify(message),
    MessageGroupId: message.type,
  }));
}

/**
 * Process and save items from collector result
 */
async function processCollectorResult(
  sourceConfig: SourceConfig,
  result: CollectorResult
): Promise<{ saved: number; skipped: number }> {
  let saved = 0;
  let skipped = 0;

  const batchSize = 10;
  for (let i = 0; i < result.items.length; i += batchSize) {
    const batch = result.items.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async (item) => {
        if (sourceConfig.type === 'project_info') {
          const info = item as ProjectInfo;
          const wasSaved = await saveProjectInfo(info);
          if (wasSaved) {
            await sendToQueue({ type: 'project_info', infoId: info.id });
            return true;
          }
        } else {
          const info = item as MarketInfo;
          const wasSaved = await saveMarketInfo(info);
          if (wasSaved) {
            await sendToQueue({ type: 'market_info', infoId: info.id });
            return true;
          }
        }
        return false;
      })
    );

    saved += results.filter(Boolean).length;
    skipped += results.filter((r) => !r).length;
  }

  return { saved, skipped };
}

/**
 * Collect from a single source using the new configurable system
 */
async function collectFromSource(sourceConfig: SourceConfig): Promise<{
  collected: number;
  saved: number;
  skipped: number;
  error?: string;
}> {
  console.log(`Collecting from source: ${sourceConfig.name} (${sourceConfig.id})...`);

  // Check if collector is supported
  if (!isCollectorSupported(sourceConfig.collectorType)) {
    const error = `Unsupported collector type: ${sourceConfig.collectorType}`;
    console.warn(error);
    return { collected: 0, saved: 0, skipped: 0, error };
  }

  const collector = getCollector(sourceConfig.collectorType)!;

  try {
    const result = await collector.collect(sourceConfig);

    if (!result.success) {
      await updateSourceCollectionStatus(sourceConfig.id, 'failed', result.error);
      return { collected: 0, saved: 0, skipped: 0, error: result.error };
    }

    const { saved, skipped } = await processCollectorResult(sourceConfig, result);

    await updateSourceCollectionStatus(sourceConfig.id, 'success', undefined, saved);

    console.log(`Source ${sourceConfig.name}: collected=${result.items.length}, saved=${saved}, skipped=${skipped}`);

    return { collected: result.items.length, saved, skipped };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error collecting from ${sourceConfig.name}:`, error);
    await updateSourceCollectionStatus(sourceConfig.id, 'failed', errorMessage);
    return { collected: 0, saved: 0, skipped: 0, error: errorMessage };
  }
}

/**
 * Run collection using the configurable source system
 */
async function runConfigurableCollection(): Promise<{
  projectInfo: { collected: number; saved: number };
  marketInfo: { collected: number; saved: number };
}> {
  const stats = {
    projectInfo: { collected: 0, saved: 0 },
    marketInfo: { collected: 0, saved: 0 },
  };

  // Initialize default sources if needed
  await initializeDefaultSources();

  // Get all enabled sources
  const enabledSources = await getEnabledSourceConfigs();
  console.log(`Found ${enabledSources.length} enabled source configurations`);

  // Filter sources that should be collected (based on interval)
  const sourcesToCollect = enabledSources.filter(shouldCollect);
  console.log(`${sourcesToCollect.length} sources need collection`);

  // Sort by priority
  sourcesToCollect.sort((a, b) => a.priority - b.priority);

  // Collect from each source
  for (const sourceConfig of sourcesToCollect) {
    const result = await collectFromSource(sourceConfig);

    if (sourceConfig.type === 'project_info') {
      stats.projectInfo.collected += result.collected;
      stats.projectInfo.saved += result.saved;
    } else {
      stats.marketInfo.collected += result.collected;
      stats.marketInfo.saved += result.saved;
    }

    // Add delay between sources
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return stats;
}

/**
 * Main Lambda handler
 */
export async function handler(
  event: ScheduledEvent | APIGatewayProxyEvent,
  context: Context
): Promise<void | APIGatewayProxyResult> {
  console.log('Starting data collection...');
  console.log('Event:', JSON.stringify(event));
  console.log('Remaining time:', context.getRemainingTimeInMillis());

  // Check if this is a single-source collection request (from API)
  if ('pathParameters' in event && event.pathParameters?.id) {
    return handleSingleSourceCollection(event);
  }

  // Run collection using configurable source system
  const stats = await runConfigurableCollection();

  console.log('Data collection complete');
  console.log('Stats:', JSON.stringify(stats, null, 2));

  // If called via API, return a response
  if ('httpMethod' in event) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Collection completed',
        stats,
      }),
    };
  }
}

/**
 * Handle single source collection (from API)
 */
async function handleSingleSourceCollection(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const sourceId = event.pathParameters?.id;

  if (!sourceId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Source ID is required' }),
    };
  }

  const sourceConfig = await getSourceConfig(sourceId);

  if (!sourceConfig) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Source not found' }),
    };
  }

  const result = await collectFromSource(sourceConfig);

  return {
    statusCode: result.error ? 500 : 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceId: sourceConfig.id,
      sourceName: sourceConfig.name,
      ...result,
    }),
  };
}
