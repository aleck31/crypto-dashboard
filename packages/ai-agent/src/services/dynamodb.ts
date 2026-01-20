import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  ProjectInfo,
  MarketInfo,
  Project,
  BaseProject,
} from '@crypto-dashboard/shared';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
};

// ============================================================================
// Information Layer Operations
// ============================================================================

export async function getProjectInfo(id: string): Promise<ProjectInfo | null> {
  const result = await docClient.send(new GetCommand({
    TableName: getEnv('PROJECT_INFO_TABLE_NAME'),
    Key: { id },
  }));
  return result.Item as ProjectInfo | null;
}

export async function getMarketInfo(id: string): Promise<MarketInfo | null> {
  const result = await docClient.send(new GetCommand({
    TableName: getEnv('MARKET_INFO_TABLE_NAME'),
    Key: { id },
  }));
  return result.Item as MarketInfo | null;
}

export async function updateProjectInfoStatus(
  id: string,
  status: 'processing' | 'processed' | 'failed',
  analysisResults?: {
    entityId?: string;
    reasoning?: string;
  },
  error?: string
): Promise<void> {
  const updateExpression = ['SET #processedStatus = :status', '#processedAt = :now'];
  const expressionAttributeNames: Record<string, string> = {
    '#processedStatus': 'processedStatus',
    '#processedAt': 'processedAt',
  };
  const expressionAttributeValues: Record<string, unknown> = {
    ':status': status,
    ':now': new Date().toISOString(),
  };

  if (analysisResults?.entityId) {
    updateExpression.push('#projectEntityId = :entityId');
    expressionAttributeNames['#projectEntityId'] = 'projectEntityId';
    expressionAttributeValues[':entityId'] = analysisResults.entityId;
  }

  if (analysisResults?.reasoning) {
    updateExpression.push('#aiReasoning = :reasoning');
    expressionAttributeNames['#aiReasoning'] = 'aiReasoning';
    expressionAttributeValues[':reasoning'] = analysisResults.reasoning;
  }

  if (error) {
    updateExpression.push('#processError = :error');
    expressionAttributeNames['#processError'] = 'processError';
    expressionAttributeValues[':error'] = error;
  }

  await docClient.send(new UpdateCommand({
    TableName: getEnv('PROJECT_INFO_TABLE_NAME'),
    Key: { id },
    UpdateExpression: updateExpression.join(', '),
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  }));
}

export async function updateMarketInfoStatus(
  id: string,
  status: 'processing' | 'processed' | 'failed',
  analysisResults?: {
    relatedProjectIds?: string[];
    sentiment?: 'positive' | 'neutral' | 'negative';
    eventType?: string;
    aiSummary?: string;
    importanceScore?: number;
    reasoning?: string;
  },
  error?: string
): Promise<void> {
  const updateExpression = ['SET #processedStatus = :status', '#processedAt = :now'];
  const expressionAttributeNames: Record<string, string> = {
    '#processedStatus': 'processedStatus',
    '#processedAt': 'processedAt',
  };
  const expressionAttributeValues: Record<string, unknown> = {
    ':status': status,
    ':now': new Date().toISOString(),
  };

  if (analysisResults) {
    if (analysisResults.relatedProjectIds) {
      updateExpression.push('#relatedProjectIds = :relatedIds');
      expressionAttributeNames['#relatedProjectIds'] = 'relatedProjectIds';
      expressionAttributeValues[':relatedIds'] = analysisResults.relatedProjectIds;
    }
    if (analysisResults.sentiment) {
      updateExpression.push('#sentiment = :sentiment');
      expressionAttributeNames['#sentiment'] = 'sentiment';
      expressionAttributeValues[':sentiment'] = analysisResults.sentiment;
    }
    if (analysisResults.eventType) {
      updateExpression.push('#eventType = :eventType');
      expressionAttributeNames['#eventType'] = 'eventType';
      expressionAttributeValues[':eventType'] = analysisResults.eventType;
    }
    if (analysisResults.aiSummary) {
      updateExpression.push('#aiSummary = :aiSummary');
      expressionAttributeNames['#aiSummary'] = 'aiSummary';
      expressionAttributeValues[':aiSummary'] = analysisResults.aiSummary;
    }
    if (analysisResults.importanceScore !== undefined) {
      updateExpression.push('#importanceScore = :importanceScore');
      expressionAttributeNames['#importanceScore'] = 'importanceScore';
      expressionAttributeValues[':importanceScore'] = analysisResults.importanceScore;
    }
    if (analysisResults.reasoning) {
      updateExpression.push('#aiReasoning = :reasoning');
      expressionAttributeNames['#aiReasoning'] = 'aiReasoning';
      expressionAttributeValues[':reasoning'] = analysisResults.reasoning;
    }
  }

  if (error) {
    updateExpression.push('#processError = :error');
    expressionAttributeNames['#processError'] = 'processError';
    expressionAttributeValues[':error'] = error;
  }

  await docClient.send(new UpdateCommand({
    TableName: getEnv('MARKET_INFO_TABLE_NAME'),
    Key: { id },
    UpdateExpression: updateExpression.join(', '),
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  }));
}

// ============================================================================
// Entity Layer Operations
// ============================================================================

export async function getProject(id: string): Promise<Project | null> {
  const result = await docClient.send(new GetCommand({
    TableName: getEnv('PROJECTS_TABLE_NAME'),
    Key: { id },
  }));
  return result.Item as Project | null;
}

export async function getAllProjects(): Promise<BaseProject[]> {
  const projects: BaseProject[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(new QueryCommand({
      TableName: getEnv('PROJECTS_TABLE_NAME'),
      IndexName: 'category-index',
      // Query all categories by using scan instead for simplicity
      // In production, consider a more efficient approach
    }));

    if (result.Items) {
      projects.push(...(result.Items as BaseProject[]));
    }
    lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  return projects;
}

export async function getProjectsByCategory(category: string): Promise<BaseProject[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: getEnv('PROJECTS_TABLE_NAME'),
    IndexName: 'category-index',
    KeyConditionExpression: '#category = :category',
    ExpressionAttributeNames: { '#category': 'category' },
    ExpressionAttributeValues: { ':category': category },
  }));

  return (result.Items || []) as BaseProject[];
}

export async function createProject(project: Project): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: getEnv('PROJECTS_TABLE_NAME'),
    Item: {
      ...project,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    },
  }));
}

export async function updateProject(
  id: string,
  updates: Partial<Project>
): Promise<void> {
  const updateExpression: string[] = ['SET #lastUpdated = :now'];
  const expressionAttributeNames: Record<string, string> = {
    '#lastUpdated': 'lastUpdated',
  };
  const expressionAttributeValues: Record<string, unknown> = {
    ':now': new Date().toISOString(),
  };

  for (const [key, value] of Object.entries(updates)) {
    if (key !== 'id' && value !== undefined) {
      updateExpression.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = value;
    }
  }

  await docClient.send(new UpdateCommand({
    TableName: getEnv('PROJECTS_TABLE_NAME'),
    Key: { id },
    UpdateExpression: updateExpression.join(', '),
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  }));
}

export async function addProjectEvent(
  projectId: string,
  event: {
    title: string;
    description: string;
    date: string;
    source: string;
    sourceUrl?: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    eventType: string;
  }
): Promise<void> {
  const project = await getProject(projectId);
  if (!project) {
    console.warn(`Project ${projectId} not found, cannot add event`);
    return;
  }

  const newEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...event,
  };

  const recentEvents = [newEvent, ...(project.recentEvents || [])].slice(0, 20);

  await updateProject(projectId, { recentEvents } as Partial<Project>);
}

export async function addRiskFlag(
  projectId: string,
  flag: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    source?: string;
  }
): Promise<void> {
  const project = await getProject(projectId);
  if (!project) {
    console.warn(`Project ${projectId} not found, cannot add risk flag`);
    return;
  }

  const newFlag = {
    ...flag,
    detectedAt: new Date().toISOString(),
  };

  // Avoid duplicate flags
  const existingFlags = project.riskFlags || [];
  const isDuplicate = existingFlags.some(
    f => f.type === flag.type && f.description === flag.description
  );

  if (!isDuplicate) {
    const riskFlags = [newFlag, ...existingFlags];
    await updateProject(projectId, { riskFlags } as Partial<Project>);
  }
}

export async function addOpportunityFlag(
  projectId: string,
  flag: {
    type: string;
    importance: 'low' | 'medium' | 'high';
    description: string;
    source?: string;
  }
): Promise<void> {
  const project = await getProject(projectId);
  if (!project) {
    console.warn(`Project ${projectId} not found, cannot add opportunity flag`);
    return;
  }

  const newFlag = {
    ...flag,
    detectedAt: new Date().toISOString(),
  };

  // Avoid duplicate flags
  const existingFlags = project.opportunityFlags || [];
  const isDuplicate = existingFlags.some(
    f => f.type === flag.type && f.description === flag.description
  );

  if (!isDuplicate) {
    const opportunityFlags = [newFlag, ...existingFlags];
    await updateProject(projectId, { opportunityFlags } as Partial<Project>);
  }
}
