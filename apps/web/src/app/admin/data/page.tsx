'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Loader2, ChevronDown, ChevronRight, Database, FileText, ExternalLink } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getProjectInfoStats,
  getMarketInfoStats,
  listProjectInfo,
  listMarketInfo,
  type InfoStats,
  type ProjectInfoItem,
  type MarketInfoItem,
} from '@/lib/api';

type InfoType = 'project_info' | 'market_info';

export default function DataBrowserPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<InfoType>('project_info');

  // Stats
  const [projectStats, setProjectStats] = useState<InfoStats | null>(null);
  const [marketStats, setMarketStats] = useState<InfoStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // List data
  const [projectItems, setProjectItems] = useState<ProjectInfoItem[]>([]);
  const [marketItems, setMarketItems] = useState<MarketInfoItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  // Filters
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Expanded items
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [pStats, mStats] = await Promise.all([
        getProjectInfoStats(),
        getMarketInfoStats(),
      ]);
      setProjectStats(pStats);
      setMarketStats(mStats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchList = useCallback(async () => {
    setListLoading(true);
    setCursor(undefined);

    try {
      const params = {
        source: sourceFilter !== 'all' ? sourceFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 50,
      };

      if (activeTab === 'project_info') {
        const result = await listProjectInfo(params);
        setProjectItems(result.data);
        setHasMore(result.hasMore);
        setCursor(result.cursor);
      } else {
        const result = await listMarketInfo(params);
        setMarketItems(result.data);
        setHasMore(result.hasMore);
        setCursor(result.cursor);
      }
    } catch (error) {
      console.error('Failed to fetch list:', error);
    } finally {
      setListLoading(false);
    }
  }, [activeTab, sourceFilter, statusFilter]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const params = {
        source: sourceFilter !== 'all' ? sourceFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 50,
        cursor,
      };

      if (activeTab === 'project_info') {
        const result = await listProjectInfo(params);
        setProjectItems((prev) => [...prev, ...result.data]);
        setHasMore(result.hasMore);
        setCursor(result.cursor);
      } else {
        const result = await listMarketInfo(params);
        setMarketItems((prev) => [...prev, ...result.data]);
        setHasMore(result.hasMore);
        setCursor(result.cursor);
      }
    } catch (error) {
      console.error('Failed to load more:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [activeTab, sourceFilter, statusFilter, cursor, loadingMore]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchList();
    setExpandedItems(new Set());
  }, [fetchList]);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'processed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const currentStats = activeTab === 'project_info' ? projectStats : marketStats;
  const currentItems = activeTab === 'project_info' ? projectItems : marketItems;
  const sources = currentStats ? Object.keys(currentStats.bySource) : [];

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentCategory="data"
      />

      <main className="md:pl-64 pt-4">
        <div className="container mx-auto px-4 py-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Raw Data Browser</h1>
              <p className="text-muted-foreground mt-1">
                Browse collected project info and market info
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                fetchStats();
                fetchList();
              }}
              disabled={statsLoading || listLoading}
            >
              {statsLoading || listLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card
              className={`cursor-pointer transition-all ${
                activeTab === 'project_info'
                  ? 'ring-2 ring-primary'
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => setActiveTab('project_info')}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Database className="h-5 w-5" />
                  Project Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : projectStats ? (
                  <div className="space-y-2">
                    <p className="text-2xl font-bold">{projectStats.total.toLocaleString()}</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(projectStats.bySource).map(([source, count]) => (
                        <Badge key={source} variant="secondary" className="text-xs">
                          {source}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No data</p>
                )}
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-all ${
                activeTab === 'market_info'
                  ? 'ring-2 ring-primary'
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => setActiveTab('market_info')}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" />
                  Market Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : marketStats ? (
                  <div className="space-y-2">
                    <p className="text-2xl font-bold">{marketStats.total.toLocaleString()}</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(marketStats.bySource).map(([source, count]) => (
                        <Badge key={source} variant="secondary" className="text-xs">
                          {source}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No data</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sources.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data List */}
          <div className="space-y-2">
            {listLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : currentItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No data found
              </div>
            ) : (
              <>
                {activeTab === 'project_info'
                  ? projectItems.map((item) => (
                      <ProjectInfoCard
                        key={item.id}
                        item={item}
                        expanded={expandedItems.has(item.id)}
                        onToggle={() => toggleExpand(item.id)}
                        formatDate={formatDate}
                        getStatusColor={getStatusColor}
                      />
                    ))
                  : marketItems.map((item) => (
                      <MarketInfoCard
                        key={item.id}
                        item={item}
                        expanded={expandedItems.has(item.id)}
                        onToggle={() => toggleExpand(item.id)}
                        formatDate={formatDate}
                        getStatusColor={getStatusColor}
                      />
                    ))}

                {hasMore && (
                  <div className="text-center py-4">
                    <Button
                      variant="outline"
                      onClick={loadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Loading...
                        </>
                      ) : (
                        'Load More'
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Project Info Card Component
function ProjectInfoCard({
  item,
  expanded,
  onToggle,
  formatDate,
  getStatusColor,
}: {
  item: ProjectInfoItem;
  expanded: boolean;
  onToggle: () => void;
  formatDate: (date: string) => string;
  getStatusColor: (status: string) => string;
}) {
  return (
    <Card>
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 mt-1 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 mt-1 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">{item.name || item.sourceId}</p>
              <p className="text-sm text-muted-foreground">
                {item.id && <span>{item.id} · </span>}
                Collected: {formatDate(item.collectedAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{item.source}</Badge>
            <Badge className={getStatusColor(item.processedStatus)}>
              {item.processedStatus}
            </Badge>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t">
          <div className="mt-4 space-y-4">
            {/* Metadata */}
            <div>
              <h4 className="text-sm font-medium mb-2">Metadata</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Source ID:</span>{' '}
                  <span className="font-mono">{item.sourceId}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Data Hash:</span>{' '}
                  <span className="font-mono text-xs">{item.dataHash.slice(0, 16)}...</span>
                </div>
                {item.website && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Website:</span>{' '}
                    <a
                      href={item.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.website}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* AI Analysis */}
            {item.aiReasoning && (
              <div>
                <h4 className="text-sm font-medium mb-2">AI Analysis</h4>
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3 rounded-md text-sm">
                  {item.aiReasoning}
                </div>
                {item.projectEntityId && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Related Entities: <span className="font-mono">{item.projectEntityId}</span>
                  </p>
                )}
              </div>
            )}

            {/* Raw Data */}
            <div>
              <h4 className="text-sm font-medium mb-2">Raw Data</h4>
              <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-64">
                {JSON.stringify(item.rawData, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// Market Info Card Component
function MarketInfoCard({
  item,
  expanded,
  onToggle,
  formatDate,
  getStatusColor,
}: {
  item: MarketInfoItem;
  expanded: boolean;
  onToggle: () => void;
  formatDate: (date: string) => string;
  getStatusColor: (status: string) => string;
}) {
  return (
    <Card>
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 mt-1 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 mt-1 text-muted-foreground" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{item.title}</p>
              <p className="text-sm text-muted-foreground">
                {item.author && <span>{item.author} · </span>}
                {formatDate(item.publishedAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="outline">{item.source}</Badge>
            <Badge className={getStatusColor(item.processedStatus)}>
              {item.processedStatus}
            </Badge>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t">
          <div className="mt-4 space-y-4">
            {/* Content */}
            {item.content && (
              <div>
                <h4 className="text-sm font-medium mb-2">Content</h4>
                <p className="text-sm text-muted-foreground">{item.content}</p>
              </div>
            )}

            {/* Metadata */}
            <div>
              <h4 className="text-sm font-medium mb-2">Metadata</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">ID:</span>{' '}
                  <span className="font-mono text-xs">{item.id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Collected:</span>{' '}
                  {formatDate(item.collectedAt)}
                </div>
                {item.url && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">URL:</span>{' '}
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.url.length > 60 ? item.url.slice(0, 60) + '...' : item.url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {item.tags && item.tags.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Tags:</span>{' '}
                    {item.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="mr-1 text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* AI Analysis */}
            {item.aiReasoning && (
              <div>
                <h4 className="text-sm font-medium mb-2">AI Analysis</h4>
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3 rounded-md text-sm">
                  {item.aiReasoning}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {item.sentiment && (
                    <Badge variant={item.sentiment === 'positive' ? 'default' : item.sentiment === 'negative' ? 'destructive' : 'secondary'}>
                      {item.sentiment}
                    </Badge>
                  )}
                  {item.eventType && (
                    <Badge variant="outline">{item.eventType}</Badge>
                  )}
                  {item.importanceScore !== undefined && (
                    <Badge variant="secondary">Score: {item.importanceScore}</Badge>
                  )}
                </div>
                {item.relatedProjectIds && item.relatedProjectIds.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Related Projects: <span className="font-mono">{item.relatedProjectIds.join(', ')}</span>
                  </p>
                )}
              </div>
            )}

            {/* Raw Data */}
            <div>
              <h4 className="text-sm font-medium mb-2">Raw Data</h4>
              <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-64">
                {JSON.stringify(item.rawData, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
