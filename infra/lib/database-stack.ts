import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  environment: string;
}

export class DatabaseStack extends cdk.Stack {
  // Entity Layer
  public readonly projectsTable: dynamodb.Table;
  public readonly eventsTable: dynamodb.Table;

  // Information Layer
  public readonly projectInfoTable: dynamodb.Table;
  public readonly marketInfoTable: dynamodb.Table;

  // Configuration Layer
  public readonly sourceConfigTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { environment } = props;

    // ========================================================================
    // Information Layer Tables
    // ========================================================================

    // ProjectInfo Table - 项目原始信息 (低频采集)
    this.projectInfoTable = new dynamodb.Table(this, 'ProjectInfoTable', {
      tableName: `crypto-dashboard-project-info-${environment}`,
      partitionKey: {
        name: 'id',  // {source}:{sourceId} e.g., "coingecko:binance"
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for querying by source
    this.projectInfoTable.addGlobalSecondaryIndex({
      indexName: 'source-index',
      partitionKey: {
        name: 'source',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'collectedAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for querying by processing status
    this.projectInfoTable.addGlobalSecondaryIndex({
      indexName: 'status-index',
      partitionKey: {
        name: 'processedStatus',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'collectedAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // MarketInfo Table - 市场原始信息 (高频采集)
    this.marketInfoTable = new dynamodb.Table(this, 'MarketInfoTable', {
      tableName: `crypto-dashboard-market-info-${environment}`,
      partitionKey: {
        name: 'id',  // UUID
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',  // Auto-expire old market info
    });

    // GSI for querying by source
    this.marketInfoTable.addGlobalSecondaryIndex({
      indexName: 'source-index',
      partitionKey: {
        name: 'source',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'publishedAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for querying by processing status
    this.marketInfoTable.addGlobalSecondaryIndex({
      indexName: 'status-index',
      partitionKey: {
        name: 'processedStatus',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'collectedAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for querying by publish date
    this.marketInfoTable.addGlobalSecondaryIndex({
      indexName: 'date-index',
      partitionKey: {
        name: 'publishedDate',  // YYYY-MM-DD for efficient date-based queries
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'publishedAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ========================================================================
    // Configuration Layer Tables
    // ========================================================================

    // SourceConfig Table - 数据源配置 (动态管理)
    this.sourceConfigTable = new dynamodb.Table(this, 'SourceConfigTable', {
      tableName: `crypto-dashboard-source-config-${environment}`,
      partitionKey: {
        name: 'id',  // {type}:{sourceId} e.g., "project_info:coingecko"
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for querying by type (project_info / market_info)
    this.sourceConfigTable.addGlobalSecondaryIndex({
      indexName: 'type-index',
      partitionKey: {
        name: 'type',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'priority',
        type: dynamodb.AttributeType.NUMBER,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for querying by enabled status
    this.sourceConfigTable.addGlobalSecondaryIndex({
      indexName: 'enabled-index',
      partitionKey: {
        name: 'enabledStr',  // "true" | "false" (DynamoDB doesn't support boolean partition keys)
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'type',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ========================================================================
    // Entity Layer Tables
    // ========================================================================

    // Projects Table
    this.projectsTable = new dynamodb.Table(this, 'ProjectsTable', {
      tableName: `crypto-dashboard-projects-${environment}`,
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: environment === 'prod',
      },
    });

    // Global Secondary Index for category queries
    this.projectsTable.addGlobalSecondaryIndex({
      indexName: 'category-index',
      partitionKey: {
        name: 'category',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'healthScore',
        type: dynamodb.AttributeType.NUMBER,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Global Secondary Index for status queries
    this.projectsTable.addGlobalSecondaryIndex({
      indexName: 'status-index',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'lastUpdated',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Events Table for tracking project events/alerts
    this.eventsTable = new dynamodb.Table(this, 'EventsTable', {
      tableName: `crypto-dashboard-events-${environment}`,
      partitionKey: {
        name: 'projectId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl', // Auto-expire old events
    });

    // GSI for querying events by type
    this.eventsTable.addGlobalSecondaryIndex({
      indexName: 'eventType-index',
      partitionKey: {
        name: 'eventType',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ProjectsTableName', {
      value: this.projectsTable.tableName,
      exportName: `${environment}-ProjectsTableName`,
    });

    new cdk.CfnOutput(this, 'ProjectsTableArn', {
      value: this.projectsTable.tableArn,
      exportName: `${environment}-ProjectsTableArn`,
    });

    new cdk.CfnOutput(this, 'EventsTableName', {
      value: this.eventsTable.tableName,
      exportName: `${environment}-EventsTableName`,
    });

    // Information Layer Outputs
    new cdk.CfnOutput(this, 'ProjectInfoTableName', {
      value: this.projectInfoTable.tableName,
      exportName: `${environment}-ProjectInfoTableName`,
    });

    new cdk.CfnOutput(this, 'ProjectInfoTableArn', {
      value: this.projectInfoTable.tableArn,
      exportName: `${environment}-ProjectInfoTableArn`,
    });

    new cdk.CfnOutput(this, 'MarketInfoTableName', {
      value: this.marketInfoTable.tableName,
      exportName: `${environment}-MarketInfoTableName`,
    });

    new cdk.CfnOutput(this, 'MarketInfoTableArn', {
      value: this.marketInfoTable.tableArn,
      exportName: `${environment}-MarketInfoTableArn`,
    });

    // Configuration Layer Outputs
    new cdk.CfnOutput(this, 'SourceConfigTableName', {
      value: this.sourceConfigTable.tableName,
      exportName: `${environment}-SourceConfigTableName`,
    });

    new cdk.CfnOutput(this, 'SourceConfigTableArn', {
      value: this.sourceConfigTable.tableArn,
      exportName: `${environment}-SourceConfigTableArn`,
    });
  }
}
