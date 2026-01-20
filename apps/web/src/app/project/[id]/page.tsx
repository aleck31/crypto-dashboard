'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  TrendingUp,
  Globe,
  Twitter,
  Loader2,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertsList } from '@/components/dashboard/alerts-list';
import { useProject } from '@/hooks/use-projects';
import { formatNumber, formatRelativeTime, CATEGORY_INFO, STATUS_INFO } from '@crypto-dashboard/shared';
import type { Project } from '@crypto-dashboard/shared';

function HealthScoreRing({ score }: { score: number }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 80) return '#22c55e';
    if (s >= 60) return '#eab308';
    if (s >= 40) return '#f97316';
    return '#ef4444';
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="transform -rotate-90 w-32 h-32">
        <circle
          cx="64"
          cy="64"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          className="text-muted"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          stroke={getColor(score)}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold">{score}</span>
        <span className="text-xs text-muted-foreground">Health</span>
      </div>
    </div>
  );
}

function AttributeRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function renderAttributes(project: Project) {
  const attrs = project.attributes as Record<string, unknown>;
  const rows: { label: string; value: React.ReactNode }[] = [];

  // Common attributes
  if ('tvl' in attrs && typeof attrs.tvl === 'number') {
    rows.push({ label: 'TVL', value: formatNumber(attrs.tvl, { style: 'currency' }) });
  }
  if ('tvlChange24h' in attrs && typeof attrs.tvlChange24h === 'number') {
    const change = attrs.tvlChange24h as number;
    rows.push({
      label: 'TVL 24h Change',
      value: (
        <span className={change >= 0 ? 'text-green-600' : 'text-red-600'}>
          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
        </span>
      ),
    });
  }
  if ('dailyVolume' in attrs && typeof attrs.dailyVolume === 'number') {
    rows.push({ label: '24h Volume', value: formatNumber(attrs.dailyVolume, { style: 'currency' }) });
  }
  if ('tokenPrice' in attrs && typeof attrs.tokenPrice === 'number') {
    rows.push({ label: 'Token Price', value: `$${attrs.tokenPrice.toLocaleString()}` });
  }
  if ('tokenMarketCap' in attrs && typeof attrs.tokenMarketCap === 'number') {
    rows.push({ label: 'Market Cap', value: formatNumber(attrs.tokenMarketCap, { style: 'currency' }) });
  }
  if ('marketCap' in attrs && typeof attrs.marketCap === 'number') {
    rows.push({ label: 'Market Cap', value: formatNumber(attrs.marketCap, { style: 'currency' }) });
  }
  if ('activeAddresses24h' in attrs && typeof attrs.activeAddresses24h === 'number') {
    rows.push({ label: 'Active Addresses (24h)', value: formatNumber(attrs.activeAddresses24h, { compact: true }) });
  }
  if ('tps' in attrs && typeof attrs.tps === 'number') {
    rows.push({ label: 'TPS', value: formatNumber(attrs.tps, { compact: true }) });
  }
  if ('auditStatus' in attrs) {
    rows.push({
      label: 'Audit Status',
      value: (
        <Badge variant={attrs.auditStatus === 'audited' ? 'normal' : 'warning'}>
          {String(attrs.auditStatus)}
        </Badge>
      ),
    });
  }
  if ('reservesTransparency' in attrs) {
    rows.push({ label: 'Reserves Transparency', value: String(attrs.reservesTransparency) });
  }
  if ('regulatoryStatus' in attrs) {
    rows.push({ label: 'Regulatory Status', value: String(attrs.regulatoryStatus) });
  }
  if ('chains' in attrs && Array.isArray(attrs.chains)) {
    rows.push({ label: 'Chains', value: (attrs.chains as string[]).join(', ') });
  }

  return rows;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch project from API
  const { project, loading, error } = useProject(projectId);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="md:pl-64 pt-4">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading project...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="md:pl-64 pt-4">
          <div className="container mx-auto px-4 py-6">
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-4">
              <p>Failed to load project: {error.message}</p>
            </div>
            <Link href="/">
              <Button variant="link" className="p-0">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Not found state
  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="md:pl-64 pt-4">
          <div className="container mx-auto px-4 py-6">
            <p>Project not found</p>
            <Link href="/">
              <Button variant="link" className="p-0">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const categoryInfo = CATEGORY_INFO.find((c) => c.id === project.category);
  const statusInfo = STATUS_INFO.find((s) => s.id === project.status);
  const attributes = renderAttributes(project);

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentCategory={project.category}
      />

      <main className="md:pl-64 pt-4">
        <div className="container mx-auto px-4 py-6 space-y-6">
          {/* Back Button */}
          <Link href={`/category/${project.category}`}>
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to {categoryInfo?.name}
            </Button>
          </Link>

          {/* Project Header */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex items-center gap-4 flex-1">
              {project.logo ? (
                <img
                  src={project.logo}
                  alt={project.name}
                  className="h-20 w-20 rounded-xl object-cover bg-muted"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="h-20 w-20 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold text-2xl">
                    {project.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold">{project.name}</h1>
                  <Badge variant={statusInfo?.id as 'normal' | 'watch' | 'warning' | 'danger'}>
                    {statusInfo?.name}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1">
                  {categoryInfo?.name} - {categoryInfo?.nameCN}
                </p>
                <div className="flex gap-2 mt-2">
                  {project.website && (
                    <a href={project.website} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-1">
                        <Globe className="h-4 w-4" />
                        Website
                      </Button>
                    </a>
                  )}
                  {project.twitter && (
                    <a
                      href={`https://twitter.com/${project.twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm" className="gap-1">
                        <Twitter className="h-4 w-4" />
                        Twitter
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>

            <HealthScoreRing score={project.healthScore} />
          </div>

          {/* Description */}
          {project.description && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground">{project.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
              <TabsTrigger value="risks">Risks & Opportunities</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Key Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Key Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {attributes.length > 0 ? (
                      attributes.map((attr, i) => (
                        <AttributeRow key={i} label={attr.label} value={attr.value} />
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No metrics available</p>
                    )}
                  </CardContent>
                </Card>

                {/* Status Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Status Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <AttributeRow
                      label="Current Status"
                      value={
                        <Badge variant={statusInfo?.id as 'normal' | 'watch' | 'warning' | 'danger'}>
                          {statusInfo?.name}
                        </Badge>
                      }
                    />
                    <AttributeRow
                      label="News Sentiment"
                      value={
                        <Badge variant={project.newsSentiment}>
                          {project.newsSentiment}
                        </Badge>
                      }
                    />
                    <AttributeRow
                      label="Risk Flags"
                      value={project.riskFlags.length}
                    />
                    <AttributeRow
                      label="Opportunity Flags"
                      value={project.opportunityFlags.length}
                    />
                    <AttributeRow
                      label="Last Updated"
                      value={formatRelativeTime(project.lastUpdated)}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="events">
              <AlertsList events={project.recentEvents} title="Recent Events" maxItems={10} />
            </TabsContent>

            <TabsContent value="risks" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Risk Flags */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      Risk Flags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {project.riskFlags.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No active risk flags</p>
                    ) : (
                      <div className="space-y-3">
                        {project.riskFlags.map((flag, i) => (
                          <div key={i} className="p-3 rounded-lg bg-muted">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm capitalize">
                                {flag.type.replace('_', ' ')}
                              </span>
                              <Badge
                                variant={
                                  flag.severity === 'critical' || flag.severity === 'high'
                                    ? 'danger'
                                    : flag.severity === 'medium'
                                    ? 'warning'
                                    : 'secondary'
                                }
                              >
                                {flag.severity}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {flag.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Opportunity Flags */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      Opportunity Flags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {project.opportunityFlags.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No active opportunity flags</p>
                    ) : (
                      <div className="space-y-3">
                        {project.opportunityFlags.map((flag, i) => (
                          <div key={i} className="p-3 rounded-lg bg-muted">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm capitalize">
                                {flag.type.replace('_', ' ')}
                              </span>
                              <Badge
                                variant={
                                  flag.importance === 'high'
                                    ? 'normal'
                                    : flag.importance === 'medium'
                                    ? 'watch'
                                    : 'secondary'
                                }
                              >
                                {flag.importance}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {flag.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
