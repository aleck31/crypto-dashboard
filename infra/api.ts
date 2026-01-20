/**
 * API and Lambda Functions
 *
 * Defines all Lambda functions and API Gateway.
 */

import {
  projectsTable,
  eventsTable,
  projectInfoTable,
  marketInfoTable,
  sourceConfigTable,
} from "./database";
import { infoProcessingQueue } from "./queue";

// ============================================================================
// Lambda Functions
// ============================================================================

// API Handler - handles REST API requests
export const apiHandler = new sst.aws.Function("ApiHandler", {
  handler: "packages/api/src/index.handler",
  timeout: "30 seconds",
  memory: "512 MB",
  link: [projectsTable, eventsTable, sourceConfigTable, projectInfoTable, marketInfoTable],
  environment: {
    PROJECTS_TABLE_NAME: projectsTable.name,
    EVENTS_TABLE_NAME: eventsTable.name,
    SOURCE_CONFIG_TABLE_NAME: sourceConfigTable.name,
    PROJECT_INFO_TABLE_NAME: projectInfoTable.name,
    MARKET_INFO_TABLE_NAME: marketInfoTable.name,
  },
});

// Collector Handler - collects data from external sources
export const collectorHandler = new sst.aws.Function("CollectorHandler", {
  handler: "packages/collector/src/index.handler",
  timeout: "5 minutes",
  memory: "1024 MB",
  link: [
    projectsTable,
    eventsTable,
    projectInfoTable,
    marketInfoTable,
    sourceConfigTable,
    infoProcessingQueue,
  ],
  environment: {
    PROJECTS_TABLE_NAME: projectsTable.name,
    EVENTS_TABLE_NAME: eventsTable.name,
    PROJECT_INFO_TABLE_NAME: projectInfoTable.name,
    MARKET_INFO_TABLE_NAME: marketInfoTable.name,
    SOURCE_CONFIG_TABLE_NAME: sourceConfigTable.name,
    INFO_QUEUE_URL: infoProcessingQueue.url,
  },
});

// AI Agent Handler is defined inline in the queue subscription below

// Subscribe AI Agent to SQS queue
// Note: Using handler path since SST v3 subscribe expects a path, not an ARN
infoProcessingQueue.subscribe(
  {
    handler: "packages/ai-agent/src/index.handler",
    timeout: "5 minutes",
    memory: "1024 MB",
    link: [projectsTable, eventsTable, projectInfoTable, marketInfoTable],
    environment: {
      PROJECTS_TABLE_NAME: projectsTable.name,
      EVENTS_TABLE_NAME: eventsTable.name,
      PROJECT_INFO_TABLE_NAME: projectInfoTable.name,
      MARKET_INFO_TABLE_NAME: marketInfoTable.name,
      BEDROCK_MODEL_ID: "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
    },
    permissions: [
      {
        actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
        resources: [
          "arn:aws:bedrock:*::foundation-model/*",
          "arn:aws:bedrock:*:*:inference-profile/*",
          "arn:aws:bedrock:*:*:application-inference-profile/*",
        ],
      },
    ],
    batch: {
      size: 1,
    },
  },
  {
    transform: {
      eventSourceMapping: {
        scalingConfig: {
          maximumConcurrency: 5,
        },
      },
    },
  }
);

// ============================================================================
// API Gateway
// ============================================================================

export const api = new sst.aws.ApiGatewayV2("Api", {
  cors: {
    allowOrigins: ["*"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  },
});

// Dashboard routes
api.route("GET /api/dashboard", apiHandler.arn);
api.route("GET /api/dashboard/top-projects", apiHandler.arn);

// Projects routes
api.route("GET /api/projects", apiHandler.arn);
api.route("POST /api/projects", apiHandler.arn);
api.route("GET /api/projects/{id}", apiHandler.arn);
api.route("PUT /api/projects/{id}", apiHandler.arn);
api.route("DELETE /api/projects/{id}", apiHandler.arn);

// Categories and Alerts
api.route("GET /api/categories", apiHandler.arn);
api.route("GET /api/alerts", apiHandler.arn);

// Manual refresh
api.route("POST /api/refresh", collectorHandler.arn);

// Sources management routes
api.route("GET /api/sources", apiHandler.arn);
api.route("POST /api/sources", apiHandler.arn);
api.route("GET /api/sources/{id}", apiHandler.arn);
api.route("PUT /api/sources/{id}", apiHandler.arn);
api.route("DELETE /api/sources/{id}", apiHandler.arn);
api.route("POST /api/sources/{id}/toggle", apiHandler.arn);
api.route("POST /api/sources/{id}/test", apiHandler.arn);
api.route("POST /api/sources/{id}/collect", collectorHandler.arn);

// Info routes (raw collected data browser)
api.route("GET /api/info/project-info", apiHandler.arn);
api.route("GET /api/info/project-info/stats", apiHandler.arn);
api.route("GET /api/info/project-info/{id}", apiHandler.arn);
api.route("GET /api/info/market-info", apiHandler.arn);
api.route("GET /api/info/market-info/stats", apiHandler.arn);
api.route("GET /api/info/market-info/{id}", apiHandler.arn);

export { api as apiGateway };
