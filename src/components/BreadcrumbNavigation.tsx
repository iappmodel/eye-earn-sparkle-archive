import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

interface BreadcrumbConfig {
  path: string;
  label: string;
  icon?: React.ReactNode;
}

const routeLabels: Record<string, string> = {
  '/': 'Home',
  '/create': 'Create',
  '/studio': 'Studio',
  '/admin': 'Admin',
  '/my-page': 'My Page',
  '/install': 'Install',
  '/auth': 'Login',
};

export const BreadcrumbNavigation: React.FC = () => {
  const location = useLocation();
  
  // Don't show breadcrumbs on home or auth
  if (location.pathname === '/' || location.pathname === '/auth') {
    return null;
  }

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbConfig[] = [
    { path: '/', label: 'Home', icon: <Home className="w-4 h-4" /> },
  ];

  let currentPath = '';
  pathSegments.forEach((segment) => {
    currentPath += `/${segment}`;
    const label = routeLabels[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1);
    breadcrumbs.push({ path: currentPath, label });
  });

  return (
    <div className="fixed top-4 left-4 z-40 animate-fade-in">
      <div className="glass-card rounded-full px-4 py-2">
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.path}>
                <BreadcrumbItem>
                  {index === breadcrumbs.length - 1 ? (
                    <BreadcrumbPage className="flex items-center gap-1.5 text-foreground">
                      {crumb.icon}
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link 
                        to={crumb.path}
                        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {crumb.icon}
                        {crumb.label}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {index < breadcrumbs.length - 1 && (
                  <BreadcrumbSeparator>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </BreadcrumbSeparator>
                )}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
};
