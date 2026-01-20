'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { Button } from '@/components/ui/button';
import { SourceList } from '@/components/sources/source-list';
import { SourceForm } from '@/components/sources/source-form';
import { listSources } from '@/lib/api';
import type { SourceConfig } from '@crypto-dashboard/shared';

export default function SourcesPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sources, setSources] = useState<SourceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSource, setEditingSource] = useState<SourceConfig | undefined>();

  const fetchSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listSources();
      setSources(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sources');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleEdit = (source: SourceConfig) => {
    setEditingSource(source);
    setShowForm(true);
  };

  const handleSourceUpdated = (updatedSource: SourceConfig) => {
    setSources((prev) =>
      prev.map((s) => (s.id === updatedSource.id ? updatedSource : s))
    );
  };

  const handleSourceDeleted = (sourceId: string) => {
    setSources((prev) => prev.filter((s) => s.id !== sourceId));
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingSource(undefined);
  };

  const handleSaved = () => {
    handleCloseForm();
    fetchSources();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentCategory="sources"
      />

      <main className="md:pl-64 pt-4">
        <div className="container mx-auto px-4 py-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Data Sources</h1>
              <p className="text-muted-foreground mt-1">
                Manage data collection sources and configurations
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={fetchSources}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Source
              </Button>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
              <p className="font-medium">Error loading sources</p>
              <p className="text-sm mt-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={fetchSources}
              >
                Retry
              </Button>
            </div>
          )}

          {/* Loading State */}
          {loading && !error && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && sources.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No data sources configured yet.
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Source
              </Button>
            </div>
          )}

          {/* Source List */}
          {!loading && !error && sources.length > 0 && (
            <SourceList
              sources={sources}
              onRefresh={fetchSources}
              onEdit={handleEdit}
              onSourceUpdated={handleSourceUpdated}
              onSourceDeleted={handleSourceDeleted}
            />
          )}
        </div>
      </main>

      {/* Source Form Modal */}
      {showForm && (
        <SourceForm
          source={editingSource}
          onClose={handleCloseForm}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
