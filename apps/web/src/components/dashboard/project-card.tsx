import Link from 'next/link';
import { ExternalLink, AlertTriangle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatNumber, formatRelativeTime } from '@crypto-dashboard/shared';
import type { Project, ProjectStatus, NewsSentiment } from '@crypto-dashboard/shared';

interface ProjectCardProps {
  project: Project;
  showCategory?: boolean;
}

const statusConfig: Record<ProjectStatus, { label: string; variant: 'normal' | 'watch' | 'warning' | 'danger' }> = {
  normal: { label: 'Normal', variant: 'normal' },
  watch: { label: 'Watch', variant: 'watch' },
  warning: { label: 'Warning', variant: 'warning' },
  danger: { label: 'Danger', variant: 'danger' },
};

const sentimentConfig: Record<NewsSentiment, { label: string; variant: 'positive' | 'neutral' | 'negative' }> = {
  positive: { label: 'Positive', variant: 'positive' },
  neutral: { label: 'Neutral', variant: 'neutral' },
  negative: { label: 'Negative', variant: 'negative' },
};

function HealthScoreBar({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 80) return 'bg-green-500';
    if (s >= 60) return 'bg-yellow-500';
    if (s >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', getColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-medium w-8">{score}</span>
    </div>
  );
}

function getMetricValue(project: Project): { label: string; value: string } | null {
  const attrs = project.attributes as Record<string, unknown>;

  if ('tvl' in attrs && typeof attrs.tvl === 'number') {
    return { label: 'TVL', value: formatNumber(attrs.tvl, { style: 'currency', compact: true }) };
  }
  if ('dailyVolume' in attrs && typeof attrs.dailyVolume === 'number') {
    return { label: '24h Vol', value: formatNumber(attrs.dailyVolume, { style: 'currency', compact: true }) };
  }
  if ('marketCap' in attrs && typeof attrs.marketCap === 'number') {
    return { label: 'MCap', value: formatNumber(attrs.marketCap, { style: 'currency', compact: true }) };
  }
  if ('tokenMarketCap' in attrs && typeof attrs.tokenMarketCap === 'number') {
    return { label: 'MCap', value: formatNumber(attrs.tokenMarketCap, { style: 'currency', compact: true }) };
  }
  return null;
}

export function ProjectCard({ project, showCategory = false }: ProjectCardProps) {
  const statusInfo = statusConfig[project.status];
  const sentimentInfo = sentimentConfig[project.newsSentiment];
  const metric = getMetricValue(project);
  const hasRisks = project.riskFlags.length > 0;
  const hasOpportunities = project.opportunityFlags.length > 0;

  return (
    <Link href={`/project/${project.id}`}>
      <Card className="project-card hover:border-primary/50 cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {project.logo ? (
                <img
                  src={project.logo}
                  alt={project.name}
                  className="h-10 w-10 rounded-full object-cover bg-muted shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-sm">
                    {project.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-semibold text-base leading-tight truncate">{project.name}</h3>
                {showCategory && (
                  <p className="text-xs text-muted-foreground capitalize truncate">
                    {project.category.replace('_', ' ')}
                  </p>
                )}
              </div>
            </div>
            <Badge variant={statusInfo.variant} className="shrink-0">
              {statusInfo.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Health Score */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">Health Score</div>
            <HealthScoreBar score={project.healthScore} />
          </div>

          {/* Key Metric */}
          {metric && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{metric.label}</span>
              <span className="font-medium">{metric.value}</span>
            </div>
          )}

          {/* Sentiment */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Sentiment</span>
            <Badge variant={sentimentInfo.variant} className="text-xs">
              {sentimentInfo.label}
            </Badge>
          </div>

          {/* Flags */}
          {(hasRisks || hasOpportunities) && (
            <div className="flex gap-2 pt-2 border-t">
              {hasRisks && (
                <div className="flex items-center gap-1 text-xs text-yellow-600">
                  <AlertTriangle className="h-3 w-3" />
                  <span>{project.riskFlags.length} Risk{project.riskFlags.length > 1 ? 's' : ''}</span>
                </div>
              )}
              {hasOpportunities && (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <TrendingUp className="h-3 w-3" />
                  <span>{project.opportunityFlags.length} Opportunity</span>
                </div>
              )}
            </div>
          )}

          {/* Last Updated */}
          <div className="text-xs text-muted-foreground pt-2 border-t">
            Updated {formatRelativeTime(project.lastUpdated)}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
