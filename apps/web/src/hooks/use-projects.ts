'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  listProjects,
  getProject,
  getDashboard,
  getTopProjectsByCategory,
  type ProjectsListResponse,
} from '@/lib/api';
import type { Project, ProjectCategory, ProjectStatus, DashboardSummary } from '@crypto-dashboard/shared';

// ============================================================================
// useProjects Hook
// ============================================================================

export interface UseProjectsOptions {
  category?: ProjectCategory | string;
  status?: ProjectStatus | string;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseProjectsResult {
  projects: Project[];
  total: number;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useProjects(options: UseProjectsOptions = {}): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { category, status, limit, autoRefresh = false, refreshInterval = 60000 } = options;

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await listProjects({ category, status, limit });
      setProjects(response.data);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch projects'));
    } finally {
      setLoading(false);
    }
  }, [category, status, limit]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchData]);

  return { projects, total, loading, error, refetch: fetchData };
}

// ============================================================================
// useProject Hook
// ============================================================================

export interface UseProjectResult {
  project: Project | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useProject(id: string | null): UseProjectResult {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) {
      setProject(null);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await getProject(id);
      setProject(response.project);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch project'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  return { project, loading, error, refetch: fetchData };
}

// ============================================================================
// useDashboard Hook
// ============================================================================

export interface UseDashboardResult {
  dashboard: DashboardSummary | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useDashboard(autoRefresh = false, refreshInterval = 60000): UseDashboardResult {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await getDashboard();
      setDashboard(response);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch dashboard'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchData]);

  return { dashboard, loading, error, refetch: fetchData };
}

// ============================================================================
// useTopProjects Hook (for dashboard display)
// ============================================================================

export interface UseTopProjectsResult {
  projectsByCategory: Record<ProjectCategory, Project[]>;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useTopProjects(
  perCategoryLimit: number = 4,
  autoRefresh = false,
  refreshInterval = 60000
): UseTopProjectsResult {
  const [projectsByCategory, setProjectsByCategory] = useState<Record<ProjectCategory, Project[]>>(
    {} as Record<ProjectCategory, Project[]>
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await getTopProjectsByCategory(perCategoryLimit);
      setProjectsByCategory(response.data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch top projects'));
    } finally {
      setLoading(false);
    }
  }, [perCategoryLimit]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchData]);

  return { projectsByCategory, loading, error, refetch: fetchData };
}
