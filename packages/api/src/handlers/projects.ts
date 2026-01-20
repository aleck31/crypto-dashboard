import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  getProject,
  listProjects,
  putProject,
  deleteProject,
  getDashboardSummary,
  getTopProjectsByCategory,
} from '../services/dynamodb.js';
import type { ProjectCategory, ProjectStatus } from '@crypto-dashboard/shared';
import {
  listSourcesHandler,
  getSourceHandler,
  createSourceHandler,
  updateSourceHandler,
  deleteSourceHandler,
  toggleSourceHandler,
  testSourceHandler,
} from './sources.js';
import {
  listProjectInfoHandler,
  getProjectInfoHandler,
  getProjectInfoStatsHandler,
  listMarketInfoHandler,
  getMarketInfoHandler,
  getMarketInfoStatsHandler,
} from './info.js';

// Compatibility layer for v1 and v2 events
type APIEvent = APIGatewayProxyEventV2 & {
  path?: string;
  httpMethod?: string;
};

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Helper to get path from v1 or v2 event
function getPath(event: APIEvent): string {
  return event.rawPath || event.path || '';
}

// Helper to get method from v1 or v2 event
function getMethod(event: APIEvent): string {
  return event.requestContext?.http?.method || event.httpMethod || '';
}

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

// GET /projects
export async function listProjectsHandler(
  event: APIEvent
): Promise<APIGatewayProxyResultV2> {
  try {
    const queryParams = event.queryStringParameters || {};
    const category = queryParams.category as ProjectCategory | undefined;
    const status = queryParams.status as ProjectStatus | undefined;
    const limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 50;

    const result = await listProjects({ category, status, limit });
    return response(200, result);
  } catch (error) {
    console.error('Error listing projects:', error);
    return errorResponse(500, 'Failed to list projects');
  }
}

// GET /projects/{id}
export async function getProjectHandler(
  event: APIEvent
): Promise<APIGatewayProxyResultV2> {
  try {
    const id = event.pathParameters?.id;
    if (!id) {
      return errorResponse(400, 'Project ID is required');
    }

    const project = await getProject(id);
    if (!project) {
      return errorResponse(404, 'Project not found');
    }

    return response(200, { project });
  } catch (error) {
    console.error('Error getting project:', error);
    return errorResponse(500, 'Failed to get project');
  }
}

// POST /projects
export async function createProjectHandler(
  event: APIEvent
): Promise<APIGatewayProxyResultV2> {
  try {
    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    const project = JSON.parse(event.body);
    if (!project.id || !project.name || !project.category) {
      return errorResponse(400, 'Project must have id, name, and category');
    }

    await putProject(project);
    return response(201, { message: 'Project created', project });
  } catch (error) {
    console.error('Error creating project:', error);
    return errorResponse(500, 'Failed to create project');
  }
}

// PUT /projects/{id}
export async function updateProjectHandler(
  event: APIEvent
): Promise<APIGatewayProxyResultV2> {
  try {
    const id = event.pathParameters?.id;
    if (!id) {
      return errorResponse(400, 'Project ID is required');
    }

    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    const updates = JSON.parse(event.body);
    const existingProject = await getProject(id);
    if (!existingProject) {
      return errorResponse(404, 'Project not found');
    }

    const updatedProject = { ...existingProject, ...updates, id };
    await putProject(updatedProject);
    return response(200, { message: 'Project updated', project: updatedProject });
  } catch (error) {
    console.error('Error updating project:', error);
    return errorResponse(500, 'Failed to update project');
  }
}

// DELETE /projects/{id}
export async function deleteProjectHandler(
  event: APIEvent
): Promise<APIGatewayProxyResultV2> {
  try {
    const id = event.pathParameters?.id;
    if (!id) {
      return errorResponse(400, 'Project ID is required');
    }

    await deleteProject(id);
    return response(200, { message: 'Project deleted' });
  } catch (error) {
    console.error('Error deleting project:', error);
    return errorResponse(500, 'Failed to delete project');
  }
}

// GET /dashboard
export async function dashboardHandler(
  _event: APIEvent
): Promise<APIGatewayProxyResultV2> {
  try {
    const summary = await getDashboardSummary();
    return response(200, summary);
  } catch (error) {
    console.error('Error getting dashboard summary:', error);
    return errorResponse(500, 'Failed to get dashboard summary');
  }
}

// GET /dashboard/top-projects
export async function topProjectsHandler(
  event: APIEvent
): Promise<APIGatewayProxyResultV2> {
  try {
    const queryParams = event.queryStringParameters || {};
    const limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 4;

    const projectsByCategory = await getTopProjectsByCategory(limit);
    return response(200, { data: projectsByCategory });
  } catch (error) {
    console.error('Error getting top projects:', error);
    return errorResponse(500, 'Failed to get top projects');
  }
}

// Main handler that routes requests
export async function handler(
  event: APIEvent
): Promise<APIGatewayProxyResultV2> {
  const path = getPath(event);
  const method = getMethod(event);

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return response(200, {});
  }

  // Route requests
  if (path === '/api/dashboard/top-projects' && method === 'GET') {
    return topProjectsHandler(event);
  }

  if (path === '/api/dashboard' && method === 'GET') {
    return dashboardHandler(event);
  }

  if (path === '/api/projects' && method === 'GET') {
    return listProjectsHandler(event);
  }

  if (path === '/api/projects' && method === 'POST') {
    return createProjectHandler(event);
  }

  if (path.startsWith('/api/projects/') && method === 'GET') {
    return getProjectHandler(event);
  }

  if (path.startsWith('/api/projects/') && method === 'PUT') {
    return updateProjectHandler(event);
  }

  if (path.startsWith('/api/projects/') && method === 'DELETE') {
    return deleteProjectHandler(event);
  }

  // Sources routes
  if (path === '/api/sources' && method === 'GET') {
    return listSourcesHandler(event);
  }

  if (path === '/api/sources' && method === 'POST') {
    return createSourceHandler(event);
  }

  // Routes with source ID (need to handle toggle/test before generic routes)
  if (path.match(/^\/api\/sources\/[^/]+\/toggle$/) && method === 'POST') {
    return toggleSourceHandler(event);
  }

  if (path.match(/^\/api\/sources\/[^/]+\/test$/) && method === 'POST') {
    return testSourceHandler(event);
  }

  if (path.startsWith('/api/sources/') && method === 'GET') {
    return getSourceHandler(event);
  }

  if (path.startsWith('/api/sources/') && method === 'PUT') {
    return updateSourceHandler(event);
  }

  if (path.startsWith('/api/sources/') && method === 'DELETE') {
    return deleteSourceHandler(event);
  }

  // Info routes (raw collected data)
  if (path === '/api/info/project-info/stats' && method === 'GET') {
    return getProjectInfoStatsHandler();
  }

  if (path === '/api/info/project-info' && method === 'GET') {
    return listProjectInfoHandler(event);
  }

  if (path.startsWith('/api/info/project-info/') && method === 'GET') {
    return getProjectInfoHandler(event);
  }

  if (path === '/api/info/market-info/stats' && method === 'GET') {
    return getMarketInfoStatsHandler();
  }

  if (path === '/api/info/market-info' && method === 'GET') {
    return listMarketInfoHandler(event);
  }

  if (path.startsWith('/api/info/market-info/') && method === 'GET') {
    return getMarketInfoHandler(event);
  }

  return errorResponse(404, 'Not found');
}
