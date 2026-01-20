import { SQSMessage, ProjectInfo, MarketInfo } from '../types';
import {
  getProjectInfo,
  getMarketInfo,
  updateProjectInfoStatus,
  updateMarketInfoStatus,
  getProject,
  createProject,
  updateProject,
  addProjectEvent,
  addRiskFlag,
  addOpportunityFlag,
  getProjectsByCategory,
} from './dynamodb';
import { analyzeProjectInfo, analyzeMarketInfo } from './bedrock';
import {
  AIAgentOutput,
  EntityOperation,
  BaseProject,
  Project,
  ProjectCategory,
  ProjectStatus,
  NewsSentiment,
} from '@crypto-dashboard/shared';

/**
 * Process an information record from SQS
 */
export async function processInfo(message: SQSMessage): Promise<void> {
  console.log(`Processing ${message.type}: ${message.infoId}`);

  if (message.type === 'project_info') {
    await processProjectInfo(message.infoId);
  } else if (message.type === 'market_info') {
    await processMarketInfo(message.infoId);
  } else {
    console.warn(`Unknown message type: ${message.type}`);
  }
}

/**
 * Process ProjectInfo record
 */
async function processProjectInfo(infoId: string): Promise<void> {
  // Get the info record
  const info = await getProjectInfo(infoId);
  if (!info) {
    console.error(`ProjectInfo ${infoId} not found`);
    return;
  }

  // Skip if already processed
  if (info.processedStatus === 'processed') {
    console.log(`ProjectInfo ${infoId} already processed, skipping`);
    return;
  }

  // Mark as processing
  await updateProjectInfoStatus(infoId, 'processing');

  try {
    // Get existing projects for context
    const existingProjects = await getExistingProjectsSummary();

    // Analyze with AI
    const output = await analyzeProjectInfo(info, existingProjects);
    console.log('AI Analysis result:', JSON.stringify(output, null, 2));

    // Execute operations
    let entityId: string | undefined;
    for (const operation of output.operations) {
      const result = await executeOperation(operation);
      if (operation.type === 'create' && result) {
        entityId = result;
      }
    }

    // Mark as processed with reasoning
    await updateProjectInfoStatus(infoId, 'processed', {
      entityId,
      reasoning: output.reasoning,
    });
    console.log(`Successfully processed ProjectInfo ${infoId}`);
  } catch (error) {
    console.error(`Error processing ProjectInfo ${infoId}:`, error);
    await updateProjectInfoStatus(
      infoId,
      'failed',
      undefined,
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}

/**
 * Process MarketInfo record
 */
async function processMarketInfo(infoId: string): Promise<void> {
  // Get the info record
  const info = await getMarketInfo(infoId);
  if (!info) {
    console.error(`MarketInfo ${infoId} not found`);
    return;
  }

  // Skip if already processed
  if (info.processedStatus === 'processed') {
    console.log(`MarketInfo ${infoId} already processed, skipping`);
    return;
  }

  // Mark as processing
  await updateMarketInfoStatus(infoId, 'processing');

  try {
    // Get existing projects for context
    const existingProjects = await getExistingProjectsSummary();

    // Analyze with AI
    const output = await analyzeMarketInfo(info, existingProjects);
    console.log('AI Analysis result:', JSON.stringify(output, null, 2));

    // Execute operations
    for (const operation of output.operations) {
      await executeOperation(operation);
    }

    // Extract related project IDs from identified projects
    const relatedProjectIds = output.analysis.identifiedProjects
      ?.filter(p => p.entityId && p.confidence > 0.7)
      .map(p => p.entityId as string) || [];

    // Mark as processed with analysis results
    await updateMarketInfoStatus(infoId, 'processed', {
      relatedProjectIds,
      sentiment: output.analysis.sentiment,
      eventType: output.analysis.eventType,
      aiSummary: output.analysis.keyInsights?.join('; '),
      importanceScore: calculateImportanceScore(output),
      reasoning: output.reasoning,
    });

    console.log(`Successfully processed MarketInfo ${infoId}`);
  } catch (error) {
    console.error(`Error processing MarketInfo ${infoId}:`, error);
    await updateMarketInfoStatus(
      infoId,
      'failed',
      undefined,
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}

/**
 * Get a summary of existing projects for AI context
 */
async function getExistingProjectsSummary(): Promise<BaseProject[]> {
  const categories: ProjectCategory[] = [
    'cex', 'dex', 'defi', 'layer1', 'layer2', 'stablecoin',
    'wallet', 'infrastructure', 'payment', 'market_maker'
  ];

  const projectLists = await Promise.all(
    categories.map(cat => getProjectsByCategory(cat))
  );

  return projectLists.flat();
}

/**
 * Execute an entity operation
 */
async function executeOperation(operation: EntityOperation): Promise<string | undefined> {
  console.log(`Executing operation: ${operation.type}`);

  switch (operation.type) {
    case 'create': {
      const entity = operation.entity;

      // Check if project already exists
      const existing = await getProject(entity.id);
      if (existing) {
        console.log(`Project ${entity.id} already exists, updating instead`);
        await updateProject(entity.id, {
          description: entity.description,
          logo: entity.logo,
          website: entity.website,
          twitter: entity.twitter,
        } as Partial<Project>);
        return entity.id;
      }

      // Create new project
      const newProject: Project = {
        id: entity.id,
        name: entity.name,
        category: entity.category as ProjectCategory,
        description: entity.description,
        logo: entity.logo,
        website: entity.website,
        twitter: entity.twitter,
        status: 'normal' as ProjectStatus,
        healthScore: 70, // Default starting score
        newsSentiment: 'neutral' as NewsSentiment,
        recentEvents: [],
        riskFlags: [],
        opportunityFlags: [],
        lastUpdated: new Date().toISOString(),
        attributes: entity.attributes || {},
      } as Project;

      await createProject(newProject);
      console.log(`Created new project: ${entity.id}`);
      return entity.id;
    }

    case 'update': {
      const { entityId, updates, reason } = operation;

      // Check if project exists
      const existing = await getProject(entityId);
      if (!existing) {
        console.warn(`Project ${entityId} not found for update`);
        return undefined;
      }

      await updateProject(entityId, updates as Partial<Project>);
      console.log(`Updated project ${entityId}: ${reason}`);
      return entityId;
    }

    case 'add_event': {
      const { entityId, event } = operation;
      await addProjectEvent(entityId, {
        ...event,
        eventType: event.eventType,
      });
      console.log(`Added event to project ${entityId}: ${event.title}`);
      return entityId;
    }

    case 'add_risk_flag': {
      const { entityId, flag } = operation;
      await addRiskFlag(entityId, flag);
      console.log(`Added risk flag to project ${entityId}: ${flag.type}`);
      return entityId;
    }

    case 'add_opportunity_flag': {
      const { entityId, flag } = operation;
      await addOpportunityFlag(entityId, flag);
      console.log(`Added opportunity flag to project ${entityId}: ${flag.type}`);
      return entityId;
    }

    default: {
      console.warn(`Unknown operation type: ${(operation as EntityOperation).type}`);
      return undefined;
    }
  }
}

/**
 * Calculate importance score based on AI analysis
 */
function calculateImportanceScore(output: AIAgentOutput): number {
  let score = 50; // Base score

  // Higher score for events affecting project health
  if (output.analysis.eventType === 'security') score += 30;
  if (output.analysis.eventType === 'funding') score += 20;
  if (output.analysis.eventType === 'regulatory') score += 25;
  if (output.analysis.eventType === 'legal') score += 20;

  // Sentiment affects score
  if (output.analysis.sentiment === 'negative') score += 15;
  if (output.analysis.sentiment === 'positive') score += 5;

  // More identified projects = more important
  const projectCount = output.analysis.identifiedProjects?.length || 0;
  score += Math.min(projectCount * 5, 15);

  // Risk/opportunity flags increase importance
  const riskOps = output.operations.filter(o => o.type === 'add_risk_flag').length;
  const oppOps = output.operations.filter(o => o.type === 'add_opportunity_flag').length;
  score += (riskOps + oppOps) * 5;

  return Math.min(Math.max(score, 0), 100);
}
