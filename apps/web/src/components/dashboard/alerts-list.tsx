import { AlertTriangle, TrendingUp, TrendingDown, Info, Shield, Newspaper } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@crypto-dashboard/shared';
import type { ProjectEvent, NewsSentiment } from '@crypto-dashboard/shared';

interface AlertsListProps {
  events: ProjectEvent[];
  title?: string;
  maxItems?: number;
}

const eventTypeIcons: Record<string, React.ReactNode> = {
  news: <Newspaper className="h-4 w-4" />,
  funding: <TrendingUp className="h-4 w-4" />,
  product: <Info className="h-4 w-4" />,
  security: <Shield className="h-4 w-4" />,
  regulatory: <AlertTriangle className="h-4 w-4" />,
};

const sentimentColors: Record<NewsSentiment, string> = {
  positive: 'border-l-green-500',
  neutral: 'border-l-gray-400',
  negative: 'border-l-red-500',
};

export function AlertsList({ events, title = 'Recent Events', maxItems = 5 }: AlertsListProps) {
  const displayEvents = events.slice(0, maxItems);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {displayEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent events
          </p>
        ) : (
          <div className="space-y-3">
            {displayEvents.map((event) => (
              <div
                key={event.id}
                className={cn(
                  'p-3 rounded-lg border-l-4 bg-muted/50',
                  sentimentColors[event.sentiment]
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 text-muted-foreground">
                      {eventTypeIcons[event.eventType] || <Info className="h-4 w-4" />}
                    </div>
                    <div>
                      <h4 className="font-medium text-sm leading-tight">
                        {event.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {event.description}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">
                    {event.source}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(event.date)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
