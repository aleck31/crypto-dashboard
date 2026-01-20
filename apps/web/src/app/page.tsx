'use client';

import { useState, useMemo } from 'react';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/dashboard/stats-card';
import { ProjectCard } from '@/components/dashboard/project-card';
import { CategorySection } from '@/components/dashboard/category-section';
import { AlertsList } from '@/components/dashboard/alerts-list';
import { useProjects, useDashboard, useTopProjects } from '@/hooks/use-projects';
import { CATEGORY_INFO } from '@crypto-dashboard/shared';
import type { ProjectCategory, Project } from '@crypto-dashboard/shared';

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch dashboard summary
  const { dashboard, loading: dashboardLoading, error: dashboardError } = useDashboard(true, 60000);

  // Fetch top projects per category (optimized endpoint - only fetches what's needed)
  const { projectsByCategory, loading: topProjectsLoading, error: topProjectsError } = useTopProjects(4, true, 60000);

  // Fetch watch list projects (status filter)
  const { projects: watchProjects, loading: watchLoading, error: watchError } = useProjects({
    status: 'watch',
    limit: 4,
    autoRefresh: true,
    refreshInterval: 60000
  });

  const loading = dashboardLoading || topProjectsLoading || watchLoading;
  const error = dashboardError || topProjectsError || watchError;

  // Get ordered categories based on CATEGORY_INFO
  const orderedCategories = useMemo(() => {
    return CATEGORY_INFO
      .map((c) => c.id as ProjectCategory)
      .filter((cat) => projectsByCategory[cat]?.length > 0);
  }, [projectsByCategory]);

  // Use dashboard stats (fallback to zeros if not loaded yet)
  const stats = dashboard || {
    totalProjects: 0,
    byStatus: {
      normal: 0,
      watch: 0,
      warning: 0,
      danger: 0,
    },
    recentAlerts: [],
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentCategory="dashboard"
      />

      <main className="md:pl-64 pt-4">
        <div className="container mx-auto px-4 py-6 space-y-8">
          {/* Page Header */}
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Monitor crypto projects across all categories
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading data...</span>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
              <p>Failed to load data: {error.message}</p>
            </div>
          )}

          {/* Content */}
          {!loading && !error && (
            <>
              {/* Stats Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard
                  title="Total Projects"
                  value={stats.totalProjects}
                  description="Tracked across all categories"
                  icon={<Activity className="h-4 w-4" />}
                />
                <StatsCard
                  title="Normal Status"
                  value={stats.byStatus.normal}
                  description="Projects operating normally"
                  icon={<TrendingUp className="h-4 w-4 text-green-500" />}
                />
                <StatsCard
                  title="Watch List"
                  value={stats.byStatus.watch}
                  description="Projects worth monitoring"
                  icon={<TrendingDown className="h-4 w-4 text-blue-500" />}
                />
                <StatsCard
                  title="Alerts"
                  value={(stats.byStatus.warning || 0) + (stats.byStatus.danger || 0)}
                  description="Projects requiring attention"
                  icon={<AlertTriangle className="h-4 w-4 text-yellow-500" />}
                />
              </div>

              {/* Recent Events & Watch List - Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Events */}
                <AlertsList
                  events={dashboard?.recentAlerts || []}
                  title="Recent Events"
                  maxItems={5}
                />

                {/* Watch List */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Watch List</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {watchProjects.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {watchProjects.map((project) => (
                          <ProjectCard
                            key={project.id}
                            project={project}
                            showCategory
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No projects in watch list
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Category Sections - Full Width, 4 Cards Each */}
              <div className="space-y-8">
                {orderedCategories.map((category) => (
                  <CategorySection
                    key={category}
                    category={category}
                    projects={projectsByCategory[category]}
                    maxItems={4}
                  />
                ))}

                {/* No Data State */}
                {orderedCategories.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No projects found. Configure data sources and run collection to get started.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
