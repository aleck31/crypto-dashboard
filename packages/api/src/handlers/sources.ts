/**
 * Sources API Handlers
 *
 * Handles CRUD operations for data source configurations.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

// Compatibility layer for v1 and v2 events
type APIEvent = APIGatewayProxyEventV2 & {
  path?: string;
  httpMethod?: string;
};
import {
  getAllSourceConfigs,
  getSourceConfig,
  saveSourceConfig,
  deleteSourceConfig,
  toggleSourceConfig,
  getSourceConfigsByType,
} from '../services/source-config-db.js';
import type { SourceType, SourceConfig, CollectorConfig } from '@crypto-dashboard/shared';
import { generateSourceConfigId, createSourceConfig as createSourceConfigHelper } from '@crypto-dashboard/shared';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

// GET /sources
export async function listSourcesHandler(
  event: APIEvent
): Promise<APIGatewayProxyResultV2> {
  try {
    const queryParams = event.queryStringParameters || {};
    const type = queryParams.type as SourceType | undefined;

    let sources: SourceConfig[];
    if (type) {
      sources = await getSourceConfigsByType(type);
    } else {
      sources = await getAllSourceConfigs();
    }

    // Sort by type and priority
    sources.sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.priority - b.priority;
    });

    return response(200, {
      data: sources,
      total: sources.length,
    });
  } catch (error) {
    console.error('Error listing sources:', error);
    return errorResponse(500, 'Failed to list sources');
  }
}

// GET /sources/{id}
export async function getSourceHandler(
  event: APIEvent
): Promise<APIGatewayProxyResultV2> {
  try {
    const id = event.pathParameters?.id;
    if (!id) {
      return errorResponse(400, 'Source ID is required');
    }

    // URL decode the ID (it may contain colons)
    const decodedId = decodeURIComponent(id);
    const source = await getSourceConfig(decodedId);
    if (!source) {
      return errorResponse(404, 'Source not found');
    }

    return response(200, { source });
  } catch (error) {
    console.error('Error getting source:', error);
    return errorResponse(500, 'Failed to get source');
  }
}

// POST /sources
export async function createSourceHandler(
  event: APIEvent
): Promise<APIGatewayProxyResultV2> {
  try {
    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    const body = JSON.parse(event.body);

    // Validate required fields
    if (!body.type || !body.sourceId || !body.name || !body.collectorType || !body.config) {
      return errorResponse(400, 'Missing required fields: type, sourceId, name, collectorType, config');
    }

    // Validate type
    if (body.type !== 'project_info' && body.type !== 'market_info') {
      return errorResponse(400, 'Invalid type. Must be "project_info" or "market_info"');
    }

    // Check if source already exists
    const existingId = generateSourceConfigId(body.type, body.sourceId);
    const existing = await getSourceConfig(existingId);
    if (existing) {
      return errorResponse(409, 'Source with this ID already exists');
    }

    // Create the source config
    const sourceConfig = createSourceConfigHelper({
      type: body.type as SourceType,
      sourceId: body.sourceId,
      name: body.name,
      collectorType: body.collectorType,
      config: body.config as CollectorConfig,
      intervalMinutes: body.intervalMinutes,
      priority: body.priority,
      enabled: body.enabled,
    });

    await saveSourceConfig(sourceConfig);

    return response(201, {
      message: 'Source created',
      source: sourceConfig,
    });
  } catch (error) {
    console.error('Error creating source:', error);
    return errorResponse(500, 'Failed to create source');
  }
}

// PUT /sources/{id}
export async function updateSourceHandler(
  event: APIEvent
): Promise<APIGatewayProxyResultV2> {
  try {
    const id = event.pathParameters?.id;
    if (!id) {
      return errorResponse(400, 'Source ID is required');
    }

    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    const decodedId = decodeURIComponent(id);
    const existing = await getSourceConfig(decodedId);
    if (!existing) {
      return errorResponse(404, 'Source not found');
    }

    const updates = JSON.parse(event.body);

    // Merge updates with existing config
    const updatedConfig: SourceConfig = {
      ...existing,
      ...updates,
      // Preserve immutable fields
      id: existing.id,
      type: existing.type,
      sourceId: existing.sourceId,
      createdAt: existing.createdAt,
      // Update timestamp
      updatedAt: new Date().toISOString(),
    };

    // Sync enabledStr with enabled
    if ('enabled' in updates) {
      updatedConfig.enabledStr = updates.enabled ? 'true' : 'false';
    }

    await saveSourceConfig(updatedConfig);

    return response(200, {
      message: 'Source updated',
      source: updatedConfig,
    });
  } catch (error) {
    console.error('Error updating source:', error);
    return errorResponse(500, 'Failed to update source');
  }
}

// DELETE /sources/{id}
export async function deleteSourceHandler(
  event: APIEvent
): Promise<APIGatewayProxyResultV2> {
  try {
    const id = event.pathParameters?.id;
    if (!id) {
      return errorResponse(400, 'Source ID is required');
    }

    const decodedId = decodeURIComponent(id);
    const existing = await getSourceConfig(decodedId);
    if (!existing) {
      return errorResponse(404, 'Source not found');
    }

    await deleteSourceConfig(decodedId);

    return response(200, { message: 'Source deleted' });
  } catch (error) {
    console.error('Error deleting source:', error);
    return errorResponse(500, 'Failed to delete source');
  }
}

// POST /sources/{id}/toggle
export async function toggleSourceHandler(
  event: APIEvent
): Promise<APIGatewayProxyResultV2> {
  try {
    const id = event.pathParameters?.id;
    if (!id) {
      return errorResponse(400, 'Source ID is required');
    }

    const decodedId = decodeURIComponent(id);
    const updatedSource = await toggleSourceConfig(decodedId);
    if (!updatedSource) {
      return errorResponse(404, 'Source not found');
    }

    return response(200, {
      message: `Source ${updatedSource.enabled ? 'enabled' : 'disabled'}`,
      source: updatedSource,
    });
  } catch (error) {
    console.error('Error toggling source:', error);
    return errorResponse(500, 'Failed to toggle source');
  }
}

// POST /sources/{id}/test
export async function testSourceHandler(
  event: APIEvent
): Promise<APIGatewayProxyResultV2> {
  try {
    const id = event.pathParameters?.id;
    if (!id) {
      return errorResponse(400, 'Source ID is required');
    }

    const decodedId = decodeURIComponent(id);
    const source = await getSourceConfig(decodedId);
    if (!source) {
      return errorResponse(404, 'Source not found');
    }

    // Test the source connection based on collector type
    const testResult = await testSourceConnection(source);

    return response(200, {
      source: source.id,
      ...testResult,
    });
  } catch (error) {
    console.error('Error testing source:', error);
    return errorResponse(500, 'Failed to test source');
  }
}

/**
 * Test source connection
 */
async function testSourceConnection(source: SourceConfig): Promise<{
  success: boolean;
  message: string;
  latencyMs?: number;
}> {
  const startTime = Date.now();

  try {
    switch (source.collectorType) {
      case 'rss': {
        const config = source.config as { url: string };
        const response = await fetch(config.url, {
          method: 'HEAD',
          headers: { 'User-Agent': 'CryptoDashboard/1.0' },
        });
        const latencyMs = Date.now() - startTime;

        if (response.ok || response.status === 405) {
          // 405 means HEAD not allowed, but URL is reachable
          return { success: true, message: 'RSS feed is reachable', latencyMs };
        }
        return { success: false, message: `HTTP ${response.status}: ${response.statusText}` };
      }

      case 'api:rest': {
        const config = source.config as { baseUrl: string };
        const response = await fetch(config.baseUrl, {
          method: 'HEAD',
          headers: { 'User-Agent': 'CryptoDashboard/1.0' },
        });
        const latencyMs = Date.now() - startTime;

        if (response.ok || response.status === 405 || response.status === 404) {
          // Base URL might not have HEAD/root endpoint, but host is reachable
          return { success: true, message: 'API endpoint is reachable', latencyMs };
        }
        return { success: false, message: `HTTP ${response.status}: ${response.statusText}` };
      }

      default:
        return { success: false, message: `Test not implemented for collector type: ${source.collectorType}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message };
  }
}
