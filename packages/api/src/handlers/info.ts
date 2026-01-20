/**
 * Info Handlers
 *
 * API handlers for browsing raw collected data (ProjectInfo & MarketInfo).
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  listProjectInfo,
  getProjectInfo,
  getProjectInfoStats,
  listMarketInfo,
  getMarketInfo,
  getMarketInfoStats,
} from '../services/dynamodb.js';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function response(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

function errorResponse(statusCode: number, message: string): APIGatewayProxyResultV2 {
  return response(statusCode, { error: message });
}

// GET /api/info/project-info
export async function listProjectInfoHandler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const queryParams = event.queryStringParameters || {};
    const source = queryParams.source;
    const status = queryParams.status;
    const limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 50;
    const cursor = queryParams.cursor;

    // Parse cursor (base64 encoded lastEvaluatedKey)
    let lastEvaluatedKey: Record<string, unknown> | undefined;
    if (cursor) {
      try {
        lastEvaluatedKey = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
      } catch {
        return errorResponse(400, 'Invalid cursor');
      }
    }

    const result = await listProjectInfo({ source, status, limit, lastEvaluatedKey });

    // Encode lastEvaluatedKey as cursor for client
    const responseData = {
      ...result,
      cursor: result.lastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64')
        : undefined,
    };

    return response(200, responseData);
  } catch (error) {
    console.error('Error listing project info:', error);
    return errorResponse(500, 'Failed to list project info');
  }
}

// GET /api/info/project-info/stats
export async function getProjectInfoStatsHandler(): Promise<APIGatewayProxyResultV2> {
  try {
    const stats = await getProjectInfoStats();
    return response(200, stats);
  } catch (error) {
    console.error('Error getting project info stats:', error);
    return errorResponse(500, 'Failed to get project info stats');
  }
}

// GET /api/info/project-info/{id}
export async function getProjectInfoHandler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const id = event.pathParameters?.id;
    if (!id) {
      return errorResponse(400, 'ID is required');
    }

    const info = await getProjectInfo(decodeURIComponent(id));
    if (!info) {
      return errorResponse(404, 'Project info not found');
    }

    return response(200, { data: info });
  } catch (error) {
    console.error('Error getting project info:', error);
    return errorResponse(500, 'Failed to get project info');
  }
}

// GET /api/info/market-info
export async function listMarketInfoHandler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const queryParams = event.queryStringParameters || {};
    const source = queryParams.source;
    const status = queryParams.status;
    const limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 50;
    const cursor = queryParams.cursor;

    // Parse cursor (base64 encoded lastEvaluatedKey)
    let lastEvaluatedKey: Record<string, unknown> | undefined;
    if (cursor) {
      try {
        lastEvaluatedKey = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
      } catch {
        return errorResponse(400, 'Invalid cursor');
      }
    }

    const result = await listMarketInfo({ source, status, limit, lastEvaluatedKey });

    // Encode lastEvaluatedKey as cursor for client
    const responseData = {
      ...result,
      cursor: result.lastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64')
        : undefined,
    };

    return response(200, responseData);
  } catch (error) {
    console.error('Error listing market info:', error);
    return errorResponse(500, 'Failed to list market info');
  }
}

// GET /api/info/market-info/stats
export async function getMarketInfoStatsHandler(): Promise<APIGatewayProxyResultV2> {
  try {
    const stats = await getMarketInfoStats();
    return response(200, stats);
  } catch (error) {
    console.error('Error getting market info stats:', error);
    return errorResponse(500, 'Failed to get market info stats');
  }
}

// GET /api/info/market-info/{id}
export async function getMarketInfoHandler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const id = event.pathParameters?.id;
    if (!id) {
      return errorResponse(400, 'ID is required');
    }

    const info = await getMarketInfo(decodeURIComponent(id));
    if (!info) {
      return errorResponse(404, 'Market info not found');
    }

    return response(200, { data: info });
  } catch (error) {
    console.error('Error getting market info:', error);
    return errorResponse(500, 'Failed to get market info');
  }
}
