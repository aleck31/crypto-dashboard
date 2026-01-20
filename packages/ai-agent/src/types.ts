import {
  ProjectInfo,
  MarketInfo,
  AIAgentInput,
  AIAgentOutput,
} from '@crypto-dashboard/shared';

/**
 * SQS Message format for AI Agent processing
 */
export interface SQSMessage {
  type: 'project_info' | 'market_info';
  infoId: string;  // ID of the ProjectInfo or MarketInfo record
}

/**
 * Environment variables expected by the AI Agent
 */
export interface AIAgentEnv {
  PROJECTS_TABLE_NAME: string;
  EVENTS_TABLE_NAME: string;
  PROJECT_INFO_TABLE_NAME: string;
  MARKET_INFO_TABLE_NAME: string;
  BEDROCK_MODEL_ID: string;
}

export {
  ProjectInfo,
  MarketInfo,
  AIAgentInput,
  AIAgentOutput,
};
