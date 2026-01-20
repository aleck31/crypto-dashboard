'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { AlertTriangle, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatNumber, formatRelativeTime } from '@crypto-dashboard/shared';
import type { Project, ProjectStatus, NewsSentiment } from '@crypto-dashboard/shared';

interface ProjectsTableProps {
  projects: Project[];
  showCategory?: boolean;
}

type SortField = 'name' | 'status' | 'healthScore' | 'sentiment' | 'risks' | 'opportunities' | 'lastUpdated';
type SortDirection = 'asc' | 'desc';

const statusConfig: Record<ProjectStatus, { label: string; variant: 'normal' | 'watch' | 'warning' | 'danger'; order: number }> = {
  danger: { label: 'Danger', variant: 'danger', order: 0 },
  warning: { label: 'Warning', variant: 'warning', order: 1 },
  watch: { label: 'Watch', variant: 'watch', order: 2 },
  normal: { label: 'Normal', variant: 'normal', order: 3 },
};

const sentimentConfig: Record<NewsSentiment, { label: string; variant: 'positive' | 'neutral' | 'negative'; order: number }> = {
  negative: { label: 'Negative', variant: 'negative', order: 0 },
  neutral: { label: 'Neutral', variant: 'neutral', order: 1 },
  positive: { label: 'Positive', variant: 'positive', order: 2 },
};

function HealthScoreBar({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 80) return 'bg-green-500';
    if (s >= 60) return 'bg-yellow-500';
    if (s >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', getColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-medium w-8 text-right">{score}</span>
    </div>
  );
}

function SortableHeader({
  label,
  field,
  currentSort,
  currentDirection,
  onSort,
}: {
  label: string;
  field: SortField;
  currentSort: SortField;
  currentDirection: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const isActive = currentSort === field;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => onSort(field)}
    >
      {label}
      {isActive ? (
        currentDirection === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : (
          <ArrowDown className="ml-2 h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
      )}
    </Button>
  );
}

export function ProjectsTable({ projects, showCategory = false }: ProjectsTableProps) {
  const [sortField, setSortField] = useState<SortField>('healthScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'status':
          comparison = statusConfig[a.status].order - statusConfig[b.status].order;
          break;
        case 'healthScore':
          comparison = a.healthScore - b.healthScore;
          break;
        case 'sentiment':
          comparison = sentimentConfig[a.newsSentiment].order - sentimentConfig[b.newsSentiment].order;
          break;
        case 'risks':
          comparison = a.riskFlags.length - b.riskFlags.length;
          break;
        case 'opportunities':
          comparison = a.opportunityFlags.length - b.opportunityFlags.length;
          break;
        case 'lastUpdated':
          comparison = new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime();
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [projects, sortField, sortDirection]);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">
              <SortableHeader
                label="Project"
                field="name"
                currentSort={sortField}
                currentDirection={sortDirection}
                onSort={handleSort}
              />
            </TableHead>
            {showCategory && <TableHead>Category</TableHead>}
            <TableHead>
              <SortableHeader
                label="Status"
                field="status"
                currentSort={sortField}
                currentDirection={sortDirection}
                onSort={handleSort}
              />
            </TableHead>
            <TableHead className="w-[180px]">
              <SortableHeader
                label="Health Score"
                field="healthScore"
                currentSort={sortField}
                currentDirection={sortDirection}
                onSort={handleSort}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label="Sentiment"
                field="sentiment"
                currentSort={sortField}
                currentDirection={sortDirection}
                onSort={handleSort}
              />
            </TableHead>
            <TableHead className="text-center">
              <SortableHeader
                label="Risks"
                field="risks"
                currentSort={sortField}
                currentDirection={sortDirection}
                onSort={handleSort}
              />
            </TableHead>
            <TableHead className="text-center">
              <SortableHeader
                label="Opportunities"
                field="opportunities"
                currentSort={sortField}
                currentDirection={sortDirection}
                onSort={handleSort}
              />
            </TableHead>
            <TableHead className="text-right">
              <SortableHeader
                label="Updated"
                field="lastUpdated"
                currentSort={sortField}
                currentDirection={sortDirection}
                onSort={handleSort}
              />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedProjects.map((project) => {
            const statusInfo = statusConfig[project.status];
            const sentimentInfo = sentimentConfig[project.newsSentiment];

            return (
              <TableRow key={project.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Link href={`/project/${project.id}`} className="flex items-center gap-3">
                    {project.logo ? (
                      <img
                        src={project.logo}
                        alt={project.name}
                        className="h-8 w-8 rounded-full object-cover bg-muted"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white font-bold text-xs">
                          {project.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="font-medium">{project.name}</span>
                  </Link>
                </TableCell>
                {showCategory && (
                  <TableCell className="text-muted-foreground capitalize">
                    {project.category.replace('_', ' ')}
                  </TableCell>
                )}
                <TableCell>
                  <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                </TableCell>
                <TableCell>
                  <HealthScoreBar score={project.healthScore} />
                </TableCell>
                <TableCell>
                  <Badge variant={sentimentInfo.variant}>{sentimentInfo.label}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  {project.riskFlags.length > 0 ? (
                    <div className="flex items-center justify-center gap-1 text-yellow-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{project.riskFlags.length}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {project.opportunityFlags.length > 0 ? (
                    <div className="flex items-center justify-center gap-1 text-green-600">
                      <TrendingUp className="h-4 w-4" />
                      <span>{project.opportunityFlags.length}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-muted-foreground text-sm">
                  {formatRelativeTime(project.lastUpdated)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
