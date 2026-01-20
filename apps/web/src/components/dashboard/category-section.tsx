import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectCard } from './project-card';
import type { Project, ProjectCategory } from '@crypto-dashboard/shared';
import { CATEGORY_INFO } from '@crypto-dashboard/shared';

interface CategorySectionProps {
  category: ProjectCategory;
  projects: Project[];
  maxItems?: number;
}

export function CategorySection({ category, projects, maxItems = 4 }: CategorySectionProps) {
  const categoryInfo = CATEGORY_INFO.find((c) => c.id === category);
  const displayProjects = projects.slice(0, maxItems);

  if (projects.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{categoryInfo?.name || category}</h2>
          <p className="text-sm text-muted-foreground">{categoryInfo?.nameCN}</p>
        </div>
        <Link href={`/category/${category}`}>
          <Button variant="ghost" size="sm" className="gap-1">
            View All
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {displayProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}
