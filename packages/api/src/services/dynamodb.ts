import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  Project,
  ProjectCategory,
  ProjectStatus,
  DashboardSummary,
  PaginatedResponse,
  ProjectInfo,
  MarketInfo,
} from '@crypto-dashboard/shared';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const PROJECTS_TABLE = process.env.PROJECTS_TABLE_NAME || 'crypto-dashboard-projects';
const EVENTS_TABLE = process.env.EVENTS_TABLE_NAME || 'crypto-dashboard-events';
const PROJECT_INFO_TABLE = process.env.PROJECT_INFO_TABLE_NAME || 'crypto-dashboard-project-info';
const MARKET_INFO_TABLE = process.env.MARKET_INFO_TABLE_NAME || 'crypto-dashboard-market-info';

export interface ProjectQueryOptions {
  category?: ProjectCategory;
  status?: ProjectStatus;
  limit?: number;
  lastEvaluatedKey?: Record<string, unknown>;
}

export async function getProject(id: string): Promise<Project | null> {
  const command = new GetCommand({
    TableName: PROJECTS_TABLE,
    Key: { id },
  });

  const response = await docClient.send(command);
  return (response.Item as Project) || null;
}

export async function listProjects(
  options: ProjectQueryOptions = {}
): Promise<PaginatedResponse<Project>> {
  const { category, status, limit = 50, lastEvaluatedKey } = options;

  let command;

  if (category) {
    // Query by category using GSI
    command = new QueryCommand({
      TableName: PROJECTS_TABLE,
      IndexName: 'category-index',
      KeyConditionExpression: 'category = :category',
      ExpressionAttributeValues: {
        ':category': category,
      },
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey as Record<string, unknown> | undefined,
    });
  } else if (status) {
    // Query by status using GSI
    command = new QueryCommand({
      TableName: PROJECTS_TABLE,
      IndexName: 'status-index',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
      },
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey as Record<string, unknown> | undefined,
    });
  } else {
    // Scan all projects
    command = new ScanCommand({
      TableName: PROJECTS_TABLE,
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey as Record<string, unknown> | undefined,
    });
  }

  const response = await docClient.send(command);

  return {
    data: (response.Items as Project[]) || [],
    total: response.Count || 0,
    page: 1,
    pageSize: limit,
    hasMore: !!response.LastEvaluatedKey,
  };
}

export async function putProject(project: Project): Promise<void> {
  const command = new PutCommand({
    TableName: PROJECTS_TABLE,
    Item: {
      ...project,
      lastUpdated: new Date().toISOString(),
    },
  });

  await docClient.send(command);
}

export async function updateProjectStatus(
  id: string,
  status: ProjectStatus,
  healthScore: number
): Promise<void> {
  const command = new UpdateCommand({
    TableName: PROJECTS_TABLE,
    Key: { id },
    UpdateExpression: 'SET #status = :status, healthScore = :healthScore, lastUpdated = :lastUpdated',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': status,
      ':healthScore': healthScore,
      ':lastUpdated': new Date().toISOString(),
    },
  });

  await docClient.send(command);
}

export async function deleteProject(id: string): Promise<void> {
  const command = new DeleteCommand({
    TableName: PROJECTS_TABLE,
    Key: { id },
  });

  await docClient.send(command);
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  // Scan all projects to calculate summary
  const scanCommand = new ScanCommand({
    TableName: PROJECTS_TABLE,
  });

  const response = await docClient.send(scanCommand);
  const projects = (response.Items as Project[]) || [];

  const byCategory: Record<ProjectCategory, number> = {
    cex: 0,
    dex: 0,
    market_maker: 0,
    payment: 0,
    layer1: 0,
    layer2: 0,
    defi: 0,
    wallet: 0,
    infrastructure: 0,
    stablecoin: 0,
  };

  const byStatus: Record<ProjectStatus, number> = {
    normal: 0,
    watch: 0,
    warning: 0,
    danger: 0,
  };

  const recentAlerts: DashboardSummary['recentAlerts'] = [];
  const projectsWithChange: { project: Project; change: number }[] = [];

  for (const project of projects) {
    byCategory[project.category]++;
    byStatus[project.status]++;

    // Collect recent events
    for (const event of project.recentEvents || []) {
      if (event.sentiment !== 'neutral') {
        recentAlerts.push(event);
      }
    }

    // Calculate change (mock for now - would be from historical data)
    const attrs = project.attributes as Record<string, unknown>;
    const change =
      (attrs.tvlChange24h as number) ||
      (attrs.dailyVolumeChange24h as number) ||
      0;
    if (change !== 0) {
      projectsWithChange.push({ project, change });
    }
  }

  // Sort recent alerts by date
  recentAlerts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Get top gainers and losers
  const sorted = [...projectsWithChange].sort((a, b) => b.change - a.change);
  const topGainers = sorted.filter((p) => p.change > 0).slice(0, 5);
  const topLosers = sorted.filter((p) => p.change < 0).slice(0, 5);

  return {
    totalProjects: projects.length,
    byCategory,
    byStatus,
    recentAlerts: recentAlerts.slice(0, 10),
    topGainers,
    topLosers,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get top N projects per category for dashboard display
 * Returns projects sorted by status priority (danger > warning > watch > normal)
 * then by health score (ascending - lower score = needs more attention)
 */
export async function getTopProjectsByCategory(
  perCategoryLimit: number = 4
): Promise<Record<ProjectCategory, Project[]>> {
  const categories: ProjectCategory[] = [
    'cex', 'dex', 'market_maker', 'payment', 'layer1',
    'layer2', 'defi', 'wallet', 'infrastructure', 'stablecoin'
  ];

  const statusOrder: Record<ProjectStatus, number> = {
    danger: 0,
    warning: 1,
    watch: 2,
    normal: 3,
  };

  const result: Record<ProjectCategory, Project[]> = {} as Record<ProjectCategory, Project[]>;

  // Query each category in parallel
  await Promise.all(
    categories.map(async (category) => {
      const command = new QueryCommand({
        TableName: PROJECTS_TABLE,
        IndexName: 'category-index',
        KeyConditionExpression: 'category = :category',
        ExpressionAttributeValues: {
          ':category': category,
        },
        // Fetch more than needed to allow for sorting
        Limit: 50,
      });

      const response = await docClient.send(command);
      const projects = (response.Items as Project[]) || [];

      // Sort by status priority, then by health score (ascending)
      projects.sort((a, b) => {
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;
        return a.healthScore - b.healthScore;
      });

      result[category] = projects.slice(0, perCategoryLimit);
    })
  );

  return result;
}

export async function batchPutProjects(projects: Project[]): Promise<void> {
  // DynamoDB batch write has a limit of 25 items
  const batches: Project[][] = [];
  for (let i = 0; i < projects.length; i += 25) {
    batches.push(projects.slice(i, i + 25));
  }

  for (const batch of batches) {
    await Promise.all(batch.map((project) => putProject(project)));
  }
}

// ============================================================================
// Project Info (Raw collected data)
// ============================================================================

export interface InfoQueryOptions {
  source?: string;
  status?: string;
  limit?: number;
  lastEvaluatedKey?: Record<string, unknown>;
}

export async function listProjectInfo(
  options: InfoQueryOptions = {}
): Promise<PaginatedResponse<ProjectInfo>> {
  const { source, status, limit = 50, lastEvaluatedKey } = options;

  let command;

  if (source && status) {
    // Query by source with status filter
    command = new QueryCommand({
      TableName: PROJECT_INFO_TABLE,
      IndexName: 'source-index',
      KeyConditionExpression: '#source = :source',
      FilterExpression: 'processedStatus = :status',
      ExpressionAttributeNames: {
        '#source': 'source',
      },
      ExpressionAttributeValues: {
        ':source': source,
        ':status': status,
      },
      Limit: limit,
      ScanIndexForward: false,
      ExclusiveStartKey: lastEvaluatedKey as Record<string, unknown> | undefined,
    });
  } else if (source) {
    command = new QueryCommand({
      TableName: PROJECT_INFO_TABLE,
      IndexName: 'source-index',
      KeyConditionExpression: '#source = :source',
      ExpressionAttributeNames: {
        '#source': 'source',
      },
      ExpressionAttributeValues: {
        ':source': source,
      },
      Limit: limit,
      ScanIndexForward: false,
      ExclusiveStartKey: lastEvaluatedKey as Record<string, unknown> | undefined,
    });
  } else if (status) {
    command = new QueryCommand({
      TableName: PROJECT_INFO_TABLE,
      IndexName: 'status-index',
      KeyConditionExpression: 'processedStatus = :status',
      ExpressionAttributeValues: {
        ':status': status,
      },
      Limit: limit,
      ScanIndexForward: false,
      ExclusiveStartKey: lastEvaluatedKey as Record<string, unknown> | undefined,
    });
  } else {
    command = new ScanCommand({
      TableName: PROJECT_INFO_TABLE,
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey as Record<string, unknown> | undefined,
    });
  }

  const response = await docClient.send(command);

  return {
    data: (response.Items as ProjectInfo[]) || [],
    total: response.Count || 0,
    page: 1,
    pageSize: limit,
    hasMore: !!response.LastEvaluatedKey,
    lastEvaluatedKey: response.LastEvaluatedKey,
  };
}

export async function getProjectInfo(id: string): Promise<ProjectInfo | null> {
  const command = new GetCommand({
    TableName: PROJECT_INFO_TABLE,
    Key: { id },
  });

  const response = await docClient.send(command);
  return (response.Item as ProjectInfo) || null;
}

export async function getProjectInfoStats(): Promise<{
  total: number;
  bySource: Record<string, number>;
  byStatus: Record<string, number>;
}> {
  const command = new ScanCommand({
    TableName: PROJECT_INFO_TABLE,
    ProjectionExpression: '#source, processedStatus',
    ExpressionAttributeNames: {
      '#source': 'source',
    },
  });

  const response = await docClient.send(command);
  const items = response.Items || [];

  const bySource: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  for (const item of items) {
    const source = item.source as string;
    const status = item.processedStatus as string;

    bySource[source] = (bySource[source] || 0) + 1;
    byStatus[status] = (byStatus[status] || 0) + 1;
  }

  return {
    total: items.length,
    bySource,
    byStatus,
  };
}

// ============================================================================
// Market Info (Raw collected news/articles)
// ============================================================================

export async function listMarketInfo(
  options: InfoQueryOptions = {}
): Promise<PaginatedResponse<MarketInfo>> {
  const { source, status, limit = 50, lastEvaluatedKey } = options;

  let command;

  if (source && status) {
    // Query by source with status filter
    command = new QueryCommand({
      TableName: MARKET_INFO_TABLE,
      IndexName: 'source-index',
      KeyConditionExpression: '#source = :source',
      FilterExpression: 'processedStatus = :status',
      ExpressionAttributeNames: {
        '#source': 'source',
      },
      ExpressionAttributeValues: {
        ':source': source,
        ':status': status,
      },
      Limit: limit,
      ScanIndexForward: false,
      ExclusiveStartKey: lastEvaluatedKey as Record<string, unknown> | undefined,
    });
  } else if (source) {
    command = new QueryCommand({
      TableName: MARKET_INFO_TABLE,
      IndexName: 'source-index',
      KeyConditionExpression: '#source = :source',
      ExpressionAttributeNames: {
        '#source': 'source',
      },
      ExpressionAttributeValues: {
        ':source': source,
      },
      Limit: limit,
      ScanIndexForward: false,
      ExclusiveStartKey: lastEvaluatedKey as Record<string, unknown> | undefined,
    });
  } else if (status) {
    command = new QueryCommand({
      TableName: MARKET_INFO_TABLE,
      IndexName: 'status-index',
      KeyConditionExpression: 'processedStatus = :status',
      ExpressionAttributeValues: {
        ':status': status,
      },
      Limit: limit,
      ScanIndexForward: false,
      ExclusiveStartKey: lastEvaluatedKey as Record<string, unknown> | undefined,
    });
  } else {
    command = new ScanCommand({
      TableName: MARKET_INFO_TABLE,
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey as Record<string, unknown> | undefined,
    });
  }

  const response = await docClient.send(command);

  return {
    data: (response.Items as MarketInfo[]) || [],
    total: response.Count || 0,
    page: 1,
    pageSize: limit,
    hasMore: !!response.LastEvaluatedKey,
    lastEvaluatedKey: response.LastEvaluatedKey,
  };
}

export async function getMarketInfo(id: string): Promise<MarketInfo | null> {
  const command = new GetCommand({
    TableName: MARKET_INFO_TABLE,
    Key: { id },
  });

  const response = await docClient.send(command);
  return (response.Item as MarketInfo) || null;
}

export async function getMarketInfoStats(): Promise<{
  total: number;
  bySource: Record<string, number>;
  byStatus: Record<string, number>;
}> {
  const command = new ScanCommand({
    TableName: MARKET_INFO_TABLE,
    ProjectionExpression: '#source, processedStatus',
    ExpressionAttributeNames: {
      '#source': 'source',
    },
  });

  const response = await docClient.send(command);
  const items = response.Items || [];

  const bySource: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  for (const item of items) {
    const source = item.source as string;
    const status = item.processedStatus as string;

    bySource[source] = (bySource[source] || 0) + 1;
    byStatus[status] = (byStatus[status] || 0) + 1;
  }

  return {
    total: items.length,
    bySource,
    byStatus,
  };
}
