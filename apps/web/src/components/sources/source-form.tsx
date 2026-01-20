'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  SourceConfig,
  SourceType,
  CollectorType,
  RssConfig,
  RestApiConfig,
  RestApiEndpoint,
} from '@crypto-dashboard/shared';
import { createSource, updateSource, type CreateSourceParams } from '@/lib/api';

interface SourceFormProps {
  source?: SourceConfig;
  onClose: () => void;
  onSaved: () => void;
}

const COLLECTOR_TYPES: { value: CollectorType; label: string }[] = [
  { value: 'rss', label: 'RSS Feed' },
  { value: 'api:rest', label: 'REST API' },
  // { value: 'api:graphql', label: 'GraphQL API' },
  // { value: 'twitter', label: 'Twitter' },
];

export function SourceForm({ source, onClose, onSaved }: SourceFormProps) {
  const isEdit = !!source;

  // Basic fields
  const [type, setType] = useState<SourceType>(source?.type || 'project_info');
  const [sourceId, setSourceId] = useState(source?.sourceId || '');
  const [name, setName] = useState(source?.name || '');
  const [collectorType, setCollectorType] = useState<CollectorType>(
    source?.collectorType || 'rss'
  );
  const [intervalMinutes, setIntervalMinutes] = useState(
    source?.intervalMinutes?.toString() || '15'
  );
  const [priority, setPriority] = useState(source?.priority?.toString() || '100');
  const [enabled, setEnabled] = useState(source?.enabled ?? true);

  // RSS Config
  const [rssUrl, setRssUrl] = useState('');
  const [rssMaxItems, setRssMaxItems] = useState('20');
  const [rssLanguage, setRssLanguage] = useState('en');

  // REST API Config
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [apiEndpoints, setApiEndpoints] = useState<
    Array<{ path: string; method: 'GET' | 'POST'; limit: string }>
  >([{ path: '', method: 'GET', limit: '100' }]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form from existing source
  useEffect(() => {
    if (source) {
      if (source.collectorType === 'rss') {
        const config = source.config as RssConfig;
        setRssUrl(config.url || '');
        setRssMaxItems(config.maxItems?.toString() || '20');
        setRssLanguage(config.language || 'en');
      } else if (source.collectorType === 'api:rest') {
        const config = source.config as RestApiConfig;
        setApiBaseUrl(config.baseUrl || '');
        setApiEndpoints(
          config.endpoints?.map((e) => ({
            path: e.path,  // Path already includes query string
            method: e.method,
            limit: e.limit?.toString() || '100',
          })) || [{ path: '', method: 'GET', limit: '100' }]
        );
      }
    }
  }, [source]);

  const buildConfig = (): CreateSourceParams['config'] => {
    if (collectorType === 'rss') {
      return {
        type: 'rss',
        url: rssUrl,
        maxItems: parseInt(rssMaxItems, 10) || 20,
        language: rssLanguage,
      } as RssConfig;
    }

    if (collectorType === 'api:rest') {
      return {
        type: 'api:rest',
        baseUrl: apiBaseUrl,
        endpoints: apiEndpoints.map((e) => ({
          path: e.path,  // Path can include query string directly
          method: e.method,
          limit: parseInt(e.limit, 10) || undefined,
          mapping: {
            id: 'id',
            name: 'name',
          },
        })) as RestApiEndpoint[],
        rateLimit: 10,
        requestDelay: 1000,
      } as RestApiConfig;
    }

    throw new Error(`Unsupported collector type: ${collectorType}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validation
      if (!sourceId.trim()) {
        throw new Error('Source ID is required');
      }
      if (!name.trim()) {
        throw new Error('Name is required');
      }

      if (collectorType === 'rss' && !rssUrl.trim()) {
        throw new Error('RSS URL is required');
      }
      if (collectorType === 'api:rest' && !apiBaseUrl.trim()) {
        throw new Error('API Base URL is required');
      }

      const config = buildConfig();

      if (isEdit) {
        await updateSource(source.id, {
          name,
          enabled,
          config,
          intervalMinutes: parseInt(intervalMinutes, 10) || 15,
          priority: parseInt(priority, 10) || 100,
        });
      } else {
        await createSource({
          type,
          sourceId: sourceId.trim(),
          name: name.trim(),
          collectorType,
          config,
          intervalMinutes: parseInt(intervalMinutes, 10) || 15,
          priority: parseInt(priority, 10) || 100,
          enabled,
        });
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const addEndpoint = () => {
    setApiEndpoints([...apiEndpoints, { path: '', method: 'GET', limit: '100' }]);
  };

  const removeEndpoint = (index: number) => {
    setApiEndpoints(apiEndpoints.filter((_, i) => i !== index));
  };

  const updateEndpoint = (
    index: number,
    field: 'path' | 'method' | 'limit',
    value: string
  ) => {
    const updated = [...apiEndpoints];
    updated[index] = { ...updated[index], [field]: value };
    setApiEndpoints(updated);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{isEdit ? 'Edit Source' : 'Add New Source'}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="font-medium">Basic Information</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={type}
                    onValueChange={(v) => setType(v as SourceType)}
                    disabled={isEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="project_info">Project Info</SelectItem>
                      <SelectItem value="market_info">Market Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Collector Type</label>
                  <Select
                    value={collectorType}
                    onValueChange={(v) => setCollectorType(v as CollectorType)}
                    disabled={isEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLLECTOR_TYPES.map((ct) => (
                        <SelectItem key={ct.value} value={ct.value}>
                          {ct.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Source ID</label>
                  <Input
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    placeholder="e.g., coingecko, rss:coindesk"
                    disabled={isEdit}
                  />
                  <p className="text-xs text-muted-foreground">
                    Unique identifier for this source
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Display Name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., CoinGecko, CoinDesk RSS"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Interval (min)</label>
                  <Input
                    type="number"
                    value={intervalMinutes}
                    onChange={(e) => setIntervalMinutes(e.target.value)}
                    min="1"
                    max="1440"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    min="1"
                    max="1000"
                  />
                  <p className="text-xs text-muted-foreground">Lower = higher priority</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={enabled ? 'enabled' : 'disabled'}
                    onValueChange={(v) => setEnabled(v === 'enabled')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enabled">Enabled</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* RSS Config */}
            {collectorType === 'rss' && (
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-medium">RSS Configuration</h3>

                <div className="space-y-2">
                  <label className="text-sm font-medium">RSS Feed URL</label>
                  <Input
                    value={rssUrl}
                    onChange={(e) => setRssUrl(e.target.value)}
                    placeholder="https://example.com/rss.xml"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Max Items</label>
                    <Input
                      type="number"
                      value={rssMaxItems}
                      onChange={(e) => setRssMaxItems(e.target.value)}
                      min="1"
                      max="100"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Language</label>
                    <Select value={rssLanguage} onValueChange={setRssLanguage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="zh">Chinese</SelectItem>
                        <SelectItem value="ja">Japanese</SelectItem>
                        <SelectItem value="ko">Korean</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* REST API Config */}
            {collectorType === 'api:rest' && (
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-medium">REST API Configuration</h3>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Base URL</label>
                  <Input
                    value={apiBaseUrl}
                    onChange={(e) => setApiBaseUrl(e.target.value)}
                    placeholder="https://api.example.com/v3"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Endpoints</label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addEndpoint}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Endpoint
                    </Button>
                  </div>

                  {apiEndpoints.map((endpoint, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Select
                        value={endpoint.method}
                        onValueChange={(v) =>
                          updateEndpoint(index, 'method', v as 'GET' | 'POST')
                        }
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        value={endpoint.path}
                        onChange={(e) => updateEndpoint(index, 'path', e.target.value)}
                        placeholder="/coins/markets?vs_currency=usd&per_page=100"
                        className="flex-1"
                      />

                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Limit:</span>
                        <Input
                          type="number"
                          value={endpoint.limit}
                          onChange={(e) => updateEndpoint(index, 'limit', e.target.value)}
                          placeholder="100"
                          className="w-20"
                        />
                      </div>

                      {apiEndpoints.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEndpoint(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}

                  <p className="text-xs text-muted-foreground">
                    Path can include query params, e.g., /coins/markets?vs_currency=usd
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
