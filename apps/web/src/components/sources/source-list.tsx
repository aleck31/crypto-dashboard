'use client';

import { useState } from 'react';
import {
  Play,
  Pause,
  Trash2,
  Edit,
  RefreshCw,
  TestTube,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Rss,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SourceConfig } from '@crypto-dashboard/shared';
import { toggleSource, testSource, collectSource, deleteSource, getSource } from '@/lib/api';

interface SourceListProps {
  sources: SourceConfig[];
  onRefresh: () => void;
  onEdit: (source: SourceConfig) => void;
  onSourceUpdated?: (source: SourceConfig) => void;
  onSourceDeleted?: (sourceId: string) => void;
}

interface TestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

export function SourceList({ sources, onRefresh, onEdit, onSourceUpdated, onSourceDeleted }: SourceListProps) {
  const [loadingStates, setLoadingStates] = useState<Record<string, string>>({});
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  const setLoading = (id: string, action: string | null) => {
    setLoadingStates((prev) => {
      if (action === null) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: action };
    });
  };

  const setTestResult = (id: string, result: TestResult | null) => {
    setTestResults((prev) => {
      if (result === null) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: result };
    });
  };

  const handleToggle = async (source: SourceConfig) => {
    setLoading(source.id, 'toggle');
    try {
      const result = await toggleSource(source.id);
      if (onSourceUpdated && result.source) {
        onSourceUpdated(result.source);
      } else {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to toggle source:', error);
      alert(`Failed to toggle source: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(source.id, null);
    }
  };

  const handleTest = async (source: SourceConfig) => {
    setLoading(source.id, 'test');
    // Clear previous test result
    setTestResult(source.id, null);
    try {
      const result = await testSource(source.id);
      setTestResult(source.id, {
        success: result.success,
        message: result.message,
        latencyMs: result.latencyMs,
      });
    } catch (error) {
      console.error('Failed to test source:', error);
      setTestResult(source.id, {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(source.id, null);
    }
  };

  const handleCollect = async (source: SourceConfig) => {
    setLoading(source.id, 'collect');
    try {
      const result = await collectSource(source.id);
      // Fetch updated source to get new stats
      if (onSourceUpdated) {
        const { source: updatedSource } = await getSource(source.id);
        onSourceUpdated(updatedSource);
      } else {
        onRefresh();
      }
      alert(
        result.error
          ? `Collection failed: ${result.error}`
          : `Collected: ${result.collected}, Saved: ${result.saved}, Skipped: ${result.skipped}`
      );
    } catch (error) {
      console.error('Failed to collect source:', error);
      alert(`Failed to collect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(source.id, null);
    }
  };

  const handleDelete = async (source: SourceConfig) => {
    if (!confirm(`Are you sure you want to delete "${source.name}"?`)) {
      return;
    }

    setLoading(source.id, 'delete');
    try {
      await deleteSource(source.id);
      if (onSourceDeleted) {
        onSourceDeleted(source.id);
      } else {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to delete source:', error);
      alert(`Failed to delete source: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(source.id, null);
    }
  };

  const getCollectorIcon = (type: string) => {
    switch (type) {
      case 'rss':
        return <Rss className="h-4 w-4" />;
      case 'api:rest':
      case 'api:graphql':
        return <Globe className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Group by type
  const projectInfoSources = sources.filter((s) => s.type === 'project_info');
  const marketInfoSources = sources.filter((s) => s.type === 'market_info');

  const renderSourceCard = (source: SourceConfig) => {
    const isLoading = loadingStates[source.id];
    const testResult = testResults[source.id];

    return (
      <Card key={source.id} className="relative">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {getCollectorIcon(source.collectorType)}
              <CardTitle className="text-base">{source.name}</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant={source.enabled ? 'default' : 'secondary'}>
                {source.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
              {/* Connection test result (takes priority when available) */}
              {isLoading === 'test' ? (
                <Badge variant="outline">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  testing...
                </Badge>
              ) : testResult ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant={testResult.success ? 'outline' : 'destructive'}
                      className={testResult.success ? 'text-green-600 border-green-600' : ''}
                    >
                      {testResult.success ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {testResult.success
                        ? `${testResult.latencyMs}ms`
                        : 'failed'}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {testResult.success
                      ? `Connection OK (${testResult.latencyMs}ms)`
                      : testResult.message}
                  </TooltipContent>
                </Tooltip>
              ) : source.lastCollectStatus ? (
                <Badge
                  variant={source.lastCollectStatus === 'success' ? 'outline' : 'destructive'}
                >
                  {source.lastCollectStatus === 'success' ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  {source.lastCollectStatus}
                </Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Source Info */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Collector:</span>{' '}
                <span className="font-medium">{source.collectorType}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Interval:</span>{' '}
                <span className="font-medium">{source.intervalMinutes} min</span>
              </div>
              <div>
                <span className="text-muted-foreground">Priority:</span>{' '}
                <span className="font-medium">{source.priority}</span>
              </div>
              <div>
                <span className="text-muted-foreground">ID:</span>{' '}
                <span className="font-mono text-xs">{source.sourceId}</span>
              </div>
            </div>

            {/* Last Collection */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Last collected: {formatDate(source.lastCollectedAt)}</span>
            </div>

            {/* Stats */}
            {source.stats && (
              <div className="flex gap-4 text-xs">
                <span>
                  Total: <strong>{source.stats.totalCollected}</strong>
                </span>
                <span className="text-green-600">
                  Success: <strong>{source.stats.successCount}</strong>
                </span>
                <span className="text-red-600">
                  Failed: <strong>{source.stats.failedCount}</strong>
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggle(source)}
                    disabled={!!isLoading}
                  >
                    {isLoading === 'toggle' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : source.enabled ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {source.enabled ? 'Disable' : 'Enable'}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTest(source)}
                    disabled={!!isLoading}
                  >
                    {isLoading === 'test' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Test Connection</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCollect(source)}
                    disabled={!!isLoading || !source.enabled}
                  >
                    {isLoading === 'collect' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Collect Now</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(source)}
                    disabled={!!isLoading}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(source)}
                    disabled={!!isLoading}
                    className="text-destructive hover:text-destructive"
                  >
                    {isLoading === 'delete' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      {/* Project Info Sources */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          Project Info Sources ({projectInfoSources.length})
        </h3>
        {projectInfoSources.length === 0 ? (
          <p className="text-muted-foreground">No project info sources configured.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projectInfoSources.map(renderSourceCard)}
          </div>
        )}
      </div>

      {/* Market Info Sources */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          Market Info Sources ({marketInfoSources.length})
        </h3>
        {marketInfoSources.length === 0 ? (
          <p className="text-muted-foreground">No market info sources configured.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {marketInfoSources.map(renderSourceCard)}
          </div>
        )}
      </div>
    </div>
  );
}
