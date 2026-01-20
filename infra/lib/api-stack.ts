import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import * as path from 'path';

export interface ApiStackProps extends cdk.StackProps {
  environment: string;
  // Entity Layer Tables
  projectsTable: dynamodb.Table;
  eventsTable: dynamodb.Table;
  // Information Layer Tables
  projectInfoTable: dynamodb.Table;
  marketInfoTable: dynamodb.Table;
  // Configuration Layer Tables
  sourceConfigTable: dynamodb.Table;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly apiHandler: lambda.Function;
  public readonly collectorHandler: lambda.Function;
  public readonly aiAgentHandler: lambda.Function;
  public readonly infoProcessingQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { environment, projectsTable, eventsTable, projectInfoTable, marketInfoTable, sourceConfigTable } = props;

    // ========================================================================
    // SQS Queue for AI Agent Processing
    // ========================================================================

    // Dead Letter Queue for failed messages
    const dlq = new sqs.Queue(this, 'InfoProcessingDLQ', {
      queueName: `crypto-dashboard-info-dlq-${environment}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Main processing queue
    this.infoProcessingQueue = new sqs.Queue(this, 'InfoProcessingQueue', {
      queueName: `crypto-dashboard-info-queue-${environment}`,
      visibilityTimeout: cdk.Duration.minutes(6), // Should be > Lambda timeout
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
      retentionPeriod: cdk.Duration.days(7),
    });

    // API Lambda Function
    this.apiHandler = new lambda.Function(this, 'ApiHandler', {
      functionName: `crypto-dashboard-api-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../packages/api/dist')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        PROJECTS_TABLE_NAME: projectsTable.tableName,
        EVENTS_TABLE_NAME: eventsTable.tableName,
        SOURCE_CONFIG_TABLE_NAME: sourceConfigTable.tableName,
        NODE_OPTIONS: '--enable-source-maps',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant DynamoDB permissions to API Lambda
    projectsTable.grantReadWriteData(this.apiHandler);
    eventsTable.grantReadWriteData(this.apiHandler);
    sourceConfigTable.grantReadWriteData(this.apiHandler);

    // Data Collector Lambda Function
    this.collectorHandler = new lambda.Function(this, 'CollectorHandler', {
      functionName: `crypto-dashboard-collector-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../packages/collector/dist')),
      timeout: cdk.Duration.minutes(5), // Data collection can take time
      memorySize: 1024,
      environment: {
        // Entity Layer Tables
        PROJECTS_TABLE_NAME: projectsTable.tableName,
        EVENTS_TABLE_NAME: eventsTable.tableName,
        // Information Layer Tables
        PROJECT_INFO_TABLE_NAME: projectInfoTable.tableName,
        MARKET_INFO_TABLE_NAME: marketInfoTable.tableName,
        // Configuration Layer Tables
        SOURCE_CONFIG_TABLE_NAME: sourceConfigTable.tableName,
        // Processing Queue
        INFO_QUEUE_URL: this.infoProcessingQueue.queueUrl,
        NODE_OPTIONS: '--enable-source-maps',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant DynamoDB permissions to Collector Lambda
    projectsTable.grantReadWriteData(this.collectorHandler);
    eventsTable.grantReadWriteData(this.collectorHandler);
    projectInfoTable.grantReadWriteData(this.collectorHandler);
    marketInfoTable.grantReadWriteData(this.collectorHandler);
    sourceConfigTable.grantReadWriteData(this.collectorHandler);

    // Grant SQS permissions to Collector Lambda
    this.infoProcessingQueue.grantSendMessages(this.collectorHandler);

    // ========================================================================
    // AI Agent Lambda Function
    // ========================================================================

    this.aiAgentHandler = new lambda.Function(this, 'AIAgentHandler', {
      functionName: `crypto-dashboard-ai-agent-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../packages/ai-agent/dist')),
      timeout: cdk.Duration.minutes(5), // AI processing can take time
      memorySize: 1024,
      environment: {
        // Entity Layer Tables
        PROJECTS_TABLE_NAME: projectsTable.tableName,
        EVENTS_TABLE_NAME: eventsTable.tableName,
        // Information Layer Tables
        PROJECT_INFO_TABLE_NAME: projectInfoTable.tableName,
        MARKET_INFO_TABLE_NAME: marketInfoTable.tableName,
        // AWS Bedrock Model ID
        BEDROCK_MODEL_ID: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
        NODE_OPTIONS: '--enable-source-maps',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant DynamoDB permissions to AI Agent Lambda
    projectsTable.grantReadWriteData(this.aiAgentHandler);
    eventsTable.grantReadWriteData(this.aiAgentHandler);
    projectInfoTable.grantReadWriteData(this.aiAgentHandler);
    marketInfoTable.grantReadWriteData(this.aiAgentHandler);

    // Grant Bedrock permissions to AI Agent Lambda
    this.aiAgentHandler.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        'arn:aws:bedrock:*::foundation-model/*',
        'arn:aws:bedrock:*:*:inference-profile/*',
        'arn:aws:bedrock:*:*:application-inference-profile/*',
      ],
    }));

    // Configure SQS trigger for AI Agent
    this.aiAgentHandler.addEventSource(new lambdaEventSources.SqsEventSource(this.infoProcessingQueue, {
      batchSize: 1, // Process one message at a time for better error handling
      maxConcurrency: 5, // Limit concurrent executions
    }));

    // EventBridge Rule - Run collector every 15 minutes
    const collectorRule = new events.Rule(this, 'CollectorScheduleRule', {
      ruleName: `crypto-dashboard-collector-schedule-${environment}`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
      description: 'Triggers data collection every 15 minutes',
    });

    collectorRule.addTarget(new targets.LambdaFunction(this.collectorHandler, {
      retryAttempts: 2,
    }));

    // API Gateway
    this.api = new apigateway.RestApi(this, 'CryptoDashboardApi', {
      restApiName: `crypto-dashboard-api-${environment}`,
      description: 'Crypto Dashboard API',
      deployOptions: {
        stageName: environment,
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(this.apiHandler);

    // API Routes
    const apiResource = this.api.root.addResource('api');

    // /api/dashboard
    const dashboardResource = apiResource.addResource('dashboard');
    dashboardResource.addMethod('GET', lambdaIntegration);

    // /api/projects
    const projectsResource = apiResource.addResource('projects');
    projectsResource.addMethod('GET', lambdaIntegration);
    projectsResource.addMethod('POST', lambdaIntegration);

    // /api/projects/{id}
    const projectResource = projectsResource.addResource('{id}');
    projectResource.addMethod('GET', lambdaIntegration);
    projectResource.addMethod('PUT', lambdaIntegration);
    projectResource.addMethod('DELETE', lambdaIntegration);

    // /api/categories
    const categoriesResource = apiResource.addResource('categories');
    categoriesResource.addMethod('GET', lambdaIntegration);

    // /api/alerts
    const alertsResource = apiResource.addResource('alerts');
    alertsResource.addMethod('GET', lambdaIntegration);

    // /api/refresh - Manual trigger for data collection
    const refreshResource = apiResource.addResource('refresh');
    const collectorIntegration = new apigateway.LambdaIntegration(this.collectorHandler);
    refreshResource.addMethod('POST', collectorIntegration);

    // /api/sources - Data source configuration management
    const sourcesResource = apiResource.addResource('sources');
    sourcesResource.addMethod('GET', lambdaIntegration);    // List all sources
    sourcesResource.addMethod('POST', lambdaIntegration);   // Create new source

    // /api/sources/{id}
    const sourceResource = sourcesResource.addResource('{id}');
    sourceResource.addMethod('GET', lambdaIntegration);     // Get single source
    sourceResource.addMethod('PUT', lambdaIntegration);     // Update source
    sourceResource.addMethod('DELETE', lambdaIntegration);  // Delete source

    // /api/sources/{id}/toggle - Enable/disable source
    const sourceToggleResource = sourceResource.addResource('toggle');
    sourceToggleResource.addMethod('POST', lambdaIntegration);

    // /api/sources/{id}/test - Test source connection
    const sourceTestResource = sourceResource.addResource('test');
    sourceTestResource.addMethod('POST', lambdaIntegration);

    // /api/sources/{id}/collect - Manual trigger collection for single source
    const sourceCollectResource = sourceResource.addResource('collect');
    sourceCollectResource.addMethod('POST', collectorIntegration);

    // Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      exportName: `${environment}-ApiEndpoint`,
    });

    new cdk.CfnOutput(this, 'ApiHandlerArn', {
      value: this.apiHandler.functionArn,
      exportName: `${environment}-ApiHandlerArn`,
    });

    new cdk.CfnOutput(this, 'CollectorHandlerArn', {
      value: this.collectorHandler.functionArn,
      exportName: `${environment}-CollectorHandlerArn`,
    });

    new cdk.CfnOutput(this, 'AIAgentHandlerArn', {
      value: this.aiAgentHandler.functionArn,
      exportName: `${environment}-AIAgentHandlerArn`,
    });

    new cdk.CfnOutput(this, 'InfoProcessingQueueUrl', {
      value: this.infoProcessingQueue.queueUrl,
      exportName: `${environment}-InfoProcessingQueueUrl`,
    });

    new cdk.CfnOutput(this, 'InfoProcessingQueueArn', {
      value: this.infoProcessingQueue.queueArn,
      exportName: `${environment}-InfoProcessingQueueArn`,
    });
  }
}
