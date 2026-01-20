/**
 * DynamoDB Tables
 *
 * Defines all DynamoDB tables for the Crypto Dashboard.
 */

// ============================================================================
// Entity Layer Tables
// ============================================================================

// Projects Table
export const projectsTable = new sst.aws.Dynamo("ProjectsTable", {
  fields: {
    id: "string",
    category: "string",
    status: "string",
    healthScore: "number",
    lastUpdated: "string",
  },
  primaryIndex: { hashKey: "id" },
  globalIndexes: {
    "category-index": {
      hashKey: "category",
      rangeKey: "healthScore",
    },
    "status-index": {
      hashKey: "status",
      rangeKey: "lastUpdated",
    },
  },
});

// Events Table
export const eventsTable = new sst.aws.Dynamo("EventsTable", {
  fields: {
    projectId: "string",
    timestamp: "string",
    eventType: "string",
  },
  primaryIndex: { hashKey: "projectId", rangeKey: "timestamp" },
  globalIndexes: {
    "eventType-index": {
      hashKey: "eventType",
      rangeKey: "timestamp",
    },
  },
  ttl: "ttl",
});

// ============================================================================
// Information Layer Tables
// ============================================================================

// ProjectInfo Table - 项目原始信息 (低频采集)
export const projectInfoTable = new sst.aws.Dynamo("ProjectInfoTable", {
  fields: {
    id: "string",
    source: "string",
    collectedAt: "string",
    processedStatus: "string",
  },
  primaryIndex: { hashKey: "id" },
  globalIndexes: {
    "source-index": {
      hashKey: "source",
      rangeKey: "collectedAt",
    },
    "status-index": {
      hashKey: "processedStatus",
      rangeKey: "collectedAt",
    },
  },
});

// MarketInfo Table - 市场原始信息 (高频采集)
export const marketInfoTable = new sst.aws.Dynamo("MarketInfoTable", {
  fields: {
    id: "string",
    source: "string",
    publishedAt: "string",
    processedStatus: "string",
    collectedAt: "string",
    publishedDate: "string",
  },
  primaryIndex: { hashKey: "id" },
  globalIndexes: {
    "source-index": {
      hashKey: "source",
      rangeKey: "publishedAt",
    },
    "status-index": {
      hashKey: "processedStatus",
      rangeKey: "collectedAt",
    },
    "date-index": {
      hashKey: "publishedDate",
      rangeKey: "publishedAt",
    },
  },
  ttl: "ttl",
});

// ============================================================================
// Configuration Layer Tables
// ============================================================================

// SourceConfig Table - 数据源配置
export const sourceConfigTable = new sst.aws.Dynamo("SourceConfigTable", {
  fields: {
    id: "string",
    type: "string",
    priority: "number",
    enabledStr: "string",
  },
  primaryIndex: { hashKey: "id" },
  globalIndexes: {
    "type-index": {
      hashKey: "type",
      rangeKey: "priority",
    },
    "enabled-index": {
      hashKey: "enabledStr",
      rangeKey: "type",
    },
  },
});

// Export all tables as a single object for convenience
export const database = {
  projectsTable,
  eventsTable,
  projectInfoTable,
  marketInfoTable,
  sourceConfigTable,
};
