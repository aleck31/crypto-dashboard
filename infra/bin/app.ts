#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import { ApiStack } from '../lib/api-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { AuthStack } from '../lib/auth-stack';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environment = app.node.tryGetContext('environment') || 'dev';

// Stack naming convention
const stackPrefix = `CryptoDashboard-${environment}`;

// Common stack props
const commonProps: cdk.StackProps = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  tags: {
    Project: 'CryptoDashboard',
    Environment: environment,
    ManagedBy: 'CDK',
  },
};

// Database Stack - DynamoDB tables
const databaseStack = new DatabaseStack(app, `${stackPrefix}-Database`, {
  ...commonProps,
  environment,
});

// Auth Stack - Cognito User Pool
const authStack = new AuthStack(app, `${stackPrefix}-Auth`, {
  ...commonProps,
  environment,
  // Will be updated with actual CloudFront URL after deployment
  callbackUrls: environment === 'prod'
    ? ['https://your-domain.com/auth/callback']
    : ['http://localhost:3000/auth/callback', 'http://localhost:3000/'],
  logoutUrls: environment === 'prod'
    ? ['https://your-domain.com/']
    : ['http://localhost:3000/'],
});

// API Stack - Lambda functions and API Gateway
const apiStack = new ApiStack(app, `${stackPrefix}-Api`, {
  ...commonProps,
  environment,
  // Entity Layer Tables
  projectsTable: databaseStack.projectsTable,
  eventsTable: databaseStack.eventsTable,
  // Information Layer Tables
  projectInfoTable: databaseStack.projectInfoTable,
  marketInfoTable: databaseStack.marketInfoTable,
  // Configuration Layer Tables
  sourceConfigTable: databaseStack.sourceConfigTable,
});

// Frontend Stack - S3 + CloudFront
const frontendStack = new FrontendStack(app, `${stackPrefix}-Frontend`, {
  ...commonProps,
  environment,
  apiEndpoint: apiStack.api.url,
});

// Add dependencies
apiStack.addDependency(databaseStack);
frontendStack.addDependency(apiStack);

// Output all stack names
new cdk.CfnOutput(apiStack, 'AllStacks', {
  value: JSON.stringify({
    database: databaseStack.stackName,
    auth: authStack.stackName,
    api: apiStack.stackName,
    frontend: frontendStack.stackName,
  }),
  description: 'All stack names for this deployment',
});
