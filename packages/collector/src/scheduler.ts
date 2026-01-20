import type { ScheduledEvent, Context, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type { ProjectInfo, MarketInfo, SourceConfig, CollectorResult } from '@crypto-dashboard/shared';
import { generateContentHash } from '@crypto-dashboard/shared';
import {
  getEnabledSourceConfigs,
  initializeDefaultSources,
  updateSourceCollectionStatus,
  getSourceConfig,
  shouldCollect,
} from './services/source-config.js';
import { getCollector, isCollectorSupported } from './collectors/registry.js';

// Legacy imports for backward compatibility
import { collectCoinGeckoProjectInfo } from './sources/coingecko.js';
import { collectDefiLlamaProjectInfo } from './sources/defillama.js';
import { collectRSSMarketInfo } from './sources/rss.js';

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
const SOURCE_CONFIG_TABLE = process.env.SOURCE_CONFIG_TABLE_NAME;
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
 * Process and save ProjectInfo items (legacy function)
 */
async function processProjectInfoItems(items: ProjectInfo[]): Promise<number> {
  let savedCount = 0;
  const batchSize = 10;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (info) => {
        const saved = await saveProjectInfo(info);
        if (saved) {
          await sendToQueue({ type: 'project_info', infoId: info.id });
          return true;
        }
        return false;
      })
    );
    savedCount += results.filter(Boolean).length;
  }

  return savedCount;
}

/**
 * Process and save MarketInfo items (legacy function)
 */
async function processMarketInfoItems(items: MarketInfo[]): Promise<number> {
  let savedCount = 0;
  const batchSize = 10;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (info) => {
        const saved = await saveMarketInfo(info);
        if (saved) {
          await sendToQueue({ type: 'market_info', infoId: info.id });
          return true;
        }
        return false;
      })
    );
    savedCount += results.filter(Boolean).length;
  }

  return savedCount;
}

/**
 * Run collection using the new configurable system
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
 * Run collection using the legacy hardcoded system
 */
async function runLegacyCollection(): Promise<{
  projectInfo: { collected: number; saved: number };
  marketInfo: { collected: number; saved: number };
}> {
  const stats = {
    projectInfo: { collected: 0, saved: 0 },
    marketInfo: { collected: 0, saved: 0 },
  };

  // CoinGecko
  try {
    console.log('Collecting ProjectInfo from CoinGecko...');
    const coinGeckoItems = await collectCoinGeckoProjectInfo();
    stats.projectInfo.collected += coinGeckoItems.length;
    console.log(`Collected ${coinGeckoItems.length} items from CoinGecko`);
    const saved = await processProjectInfoItems(coinGeckoItems);
    stats.projectInfo.saved += saved;
  } catch (error) {
    console.error('Error collecting from CoinGecko:', error);
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // DefiLlama
  try {
    console.log('Collecting ProjectInfo from DefiLlama...');
    const defiLlamaItems = await collectDefiLlamaProjectInfo();
    stats.projectInfo.collected += defiLlamaItems.length;
    console.log(`Collected ${defiLlamaItems.length} items from DefiLlama`);
    const saved = await processProjectInfoItems(defiLlamaItems);
    stats.projectInfo.saved += saved;
  } catch (error) {
    console.error('Error collecting from DefiLlama:', error);
  }

  // RSS
  try {
    console.log('Collecting MarketInfo from RSS feeds...');
    const rssItems = await collectRSSMarketInfo();
    stats.marketInfo.collected += rssItems.length;
    console.log(`Collected ${rssItems.length} items from RSS feeds`);
    const saved = await processMarketInfoItems(rssItems);
    stats.marketInfo.saved += saved;
  } catch (error) {
    console.error('Error collecting from RSS feeds:', error);
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

  let stats: {
    projectInfo: { collected: number; saved: number };
    marketInfo: { collected: number; saved: number };
  };

  // Use configurable system if SOURCE_CONFIG_TABLE is set
  if (SOURCE_CONFIG_TABLE) {
    console.log('Using configurable source system...');
    stats = await runConfigurableCollection();
  } else {
    console.log('Using legacy hardcoded source system...');
    stats = await runLegacyCollection();
  }

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
