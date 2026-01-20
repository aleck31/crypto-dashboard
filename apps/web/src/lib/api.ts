/**
 * API Service
 *
 * Handles all API calls to the backend.
 * With SST, the NEXT_PUBLIC_API_URL is automatically injected.
 */

import type { SourceConfig, SourceType, CollectorType, CollectorConfig } from '@crypto-dashboard/shared';

// API base URL - injected by SST during development and deployment
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Sources API
// ============================================================================

export interface SourcesListResponse {
  data: SourceConfig[];
  total: number;
}

export interface SourceResponse {
  source: SourceConfig;
}

export interface SourceToggleResponse {
  message: string;
  source: SourceConfig;
}

export interface SourceTestResponse {
  source: string;
  success: boolean;
  message: string;
  latencyMs?: number;
}

export interface CreateSourceParams {
  type: SourceType;
  sourceId: string;
  name: string;
  collectorType: CollectorType;
  config: CollectorConfig;
  intervalMinutes?: number;
  priority?: number;
  enabled?: boolean;
}

/**
 * List all data sources
 */
export async function listSources(type?: SourceType): Promise<SourcesListResponse> {
  const params = type ? `?type=${type}` : '';
  return fetchAPI<SourcesListResponse>(`/api/sources${params}`);
}

/**
 * Get a single source by ID
 */
export async function getSource(id: string): Promise<SourceResponse> {
  return fetchAPI<SourceResponse>(`/api/sources/${encodeURIComponent(id)}`);
}

/**
 * Create a new source
 */
export async function createSource(params: CreateSourceParams): Promise<SourceResponse> {
  return fetchAPI<SourceResponse>('/api/sources', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Update an existing source
 */
export async function updateSource(
  id: string,
  updates: Partial<SourceConfig>
): Promise<SourceResponse> {
  return fetchAPI<SourceResponse>(`/api/sources/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

/**
 * Delete a source
 */
export async function deleteSource(id: string): Promise<{ message: string }> {
  return fetchAPI<{ message: string }>(`/api/sources/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/**
 * Toggle source enabled status
 */
export async function toggleSource(id: string): Promise<SourceToggleResponse> {
  return fetchAPI<SourceToggleResponse>(`/api/sources/${encodeURIComponent(id)}/toggle`, {
    method: 'POST',
  });
}

/**
 * Test source connection
 */
export async function testSource(id: string): Promise<SourceTestResponse> {
  return fetchAPI<SourceTestResponse>(`/api/sources/${encodeURIComponent(id)}/test`, {
    method: 'POST',
  });
}

/**
 * Trigger manual collection for a source
 */
export async function collectSource(id: string): Promise<{
  sourceId: string;
  sourceName: string;
  collected: number;
  saved: number;
  skipped: number;
  error?: string;
}> {
  return fetchAPI(`/api/sources/${encodeURIComponent(id)}/collect`, {
    method: 'POST',
  });
}

// ============================================================================
// Projects API
// ============================================================================

import type { Project, ProjectCategory, ProjectStatus, DashboardSummary } from '@crypto-dashboard/shared';

export interface ProjectsListResponse {
  data: Project[];
  total: number;
}

export interface ProjectResponse {
  project: Project;
}

/**
 * List all projects
 */
export async function listProjects(params?: {
  category?: ProjectCategory | string;
  status?: ProjectStatus | string;
  limit?: number;
}): Promise<ProjectsListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set('category', params.category);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return fetchAPI(`/api/projects${query ? `?${query}` : ''}`);
}

/**
 * Get a single project by ID
 */
export async function getProject(id: string): Promise<ProjectResponse> {
  return fetchAPI(`/api/projects/${encodeURIComponent(id)}`);
}

/**
 * Get dashboard summary
 */
export async function getDashboard(): Promise<DashboardSummary> {
  return fetchAPI('/api/dashboard');
}

export interface TopProjectsResponse {
  data: Record<ProjectCategory, Project[]>;
}

/**
 * Get top projects by category for dashboard display
 */
export async function getTopProjectsByCategory(limit: number = 4): Promise<TopProjectsResponse> {
  return fetchAPI(`/api/dashboard/top-projects?limit=${limit}`);
}

// ============================================================================
// Info API (Raw Collected Data)
// ============================================================================

export interface InfoStats {
  total: number;
  bySource: Record<string, number>;
  byStatus: Record<string, number>;
}

export interface ProjectInfoItem {
  id: string;
  source: string;
  sourceId: string;
  rawData: Record<string, unknown>;
  name?: string;
  logo?: string;
  website?: string;
  description?: string;
  collectedAt: string;
  processedStatus: string;
  dataHash: string;
  aiReasoning?: string;
  projectEntityId?: string;
}

export interface MarketInfoItem {
  id: string;
  source: string;
  rawData: Record<string, unknown>;
  title: string;
  content?: string;
  url?: string;
  publishedAt: string;
  author?: string;
  tags?: string[];
  collectedAt: string;
  processedStatus: string;
  contentHash: string;
  aiReasoning?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  eventType?: string;
  relatedProjectIds?: string[];
  importanceScore?: number;
}

export interface InfoListResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  cursor?: string;
}

/**
 * Get ProjectInfo statistics
 */
export async function getProjectInfoStats(): Promise<InfoStats> {
  return fetchAPI<InfoStats>('/api/info/project-info/stats');
}

/**
 * List ProjectInfo items
 */
export async function listProjectInfo(params?: {
  source?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<InfoListResponse<ProjectInfoItem>> {
  const searchParams = new URLSearchParams();
  if (params?.source) searchParams.set('source', params.source);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.cursor) searchParams.set('cursor', params.cursor);

  const query = searchParams.toString();
  return fetchAPI(`/api/info/project-info${query ? `?${query}` : ''}`);
}

/**
 * Get single ProjectInfo item
 */
export async function getProjectInfoItem(id: string): Promise<{ data: ProjectInfoItem }> {
  return fetchAPI(`/api/info/project-info/${encodeURIComponent(id)}`);
}

/**
 * Get MarketInfo statistics
 */
export async function getMarketInfoStats(): Promise<InfoStats> {
  return fetchAPI<InfoStats>('/api/info/market-info/stats');
}

/**
 * List MarketInfo items
 */
export async function listMarketInfo(params?: {
  source?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<InfoListResponse<MarketInfoItem>> {
  const searchParams = new URLSearchParams();
  if (params?.source) searchParams.set('source', params.source);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.cursor) searchParams.set('cursor', params.cursor);

  const query = searchParams.toString();
  return fetchAPI(`/api/info/market-info${query ? `?${query}` : ''}`);
}

/**
 * Get single MarketInfo item
 */
export async function getMarketInfoItem(id: string): Promise<{ data: MarketInfoItem }> {
  return fetchAPI(`/api/info/market-info/${encodeURIComponent(id)}`);
}
