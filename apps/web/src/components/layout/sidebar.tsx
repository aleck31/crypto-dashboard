'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Building2,
  Repeat,
  TrendingUp,
  CreditCard,
  Layers,
  Landmark,
  Wallet,
  Server,
  DollarSign,
  AlertTriangle,
  Star,
  ChevronDown,
  ChevronRight,
  Settings,
  Database,
  FileSearch,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ProjectCategory } from '@crypto-dashboard/shared';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  currentCategory?: string;
}

interface NavItem {
  id: string;
  label: string;
  labelCN: string;
  icon: React.ReactNode;
  href: string;
  category?: ProjectCategory;
}

const mainNavItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    labelCN: '概览',
    icon: <LayoutDashboard className="h-4 w-4" />,
    href: '/',
  },
  {
    id: 'alerts',
    label: 'Alerts',
    labelCN: '告警',
    icon: <AlertTriangle className="h-4 w-4" />,
    href: '/alerts',
  },
  {
    id: 'watchlist',
    label: 'Watchlist',
    labelCN: '关注',
    icon: <Star className="h-4 w-4" />,
    href: '/watchlist',
  },
];

const adminNavItems: NavItem[] = [
  {
    id: 'sources',
    label: 'Data Sources',
    labelCN: '数据源',
    icon: <Database className="h-4 w-4" />,
    href: '/admin/sources',
  },
  {
    id: 'data',
    label: 'Raw Data',
    labelCN: '数据浏览',
    icon: <FileSearch className="h-4 w-4" />,
    href: '/admin/data',
  },
];

const categoryNavItems: NavItem[] = [
  {
    id: 'cex',
    label: 'CEX',
    labelCN: '中心化交易所',
    icon: <Building2 className="h-4 w-4" />,
    href: '/category/cex',
    category: 'cex',
  },
  {
    id: 'dex',
    label: 'DEX',
    labelCN: '去中心化交易所',
    icon: <Repeat className="h-4 w-4" />,
    href: '/category/dex',
    category: 'dex',
  },
  {
    id: 'market_maker',
    label: 'Market Maker',
    labelCN: '做市/量化',
    icon: <TrendingUp className="h-4 w-4" />,
    href: '/category/market_maker',
    category: 'market_maker',
  },
  {
    id: 'payment',
    label: 'Payment',
    labelCN: '支付',
    icon: <CreditCard className="h-4 w-4" />,
    href: '/category/payment',
    category: 'payment',
  },
  {
    id: 'wallet',
    label: 'Wallet',
    labelCN: '钱包',
    icon: <Wallet className="h-4 w-4" />,
    href: '/category/wallet',
    category: 'wallet',
  },
  {
    id: 'stablecoin',
    label: 'Stablecoin',
    labelCN: '稳定币',
    icon: <DollarSign className="h-4 w-4" />,
    href: '/category/stablecoin',
    category: 'stablecoin',
  },
  {
    id: 'defi',
    label: 'DeFi',
    labelCN: 'DeFi 协议',
    icon: <Landmark className="h-4 w-4" />,
    href: '/category/defi',
    category: 'defi',
  },
  {
    id: 'layer1',
    label: 'Layer 1',
    labelCN: '公链',
    icon: <Layers className="h-4 w-4" />,
    href: '/category/layer1',
    category: 'layer1',
  },
  {
    id: 'layer2',
    label: 'Layer 2',
    labelCN: 'L2',
    icon: <Layers className="h-4 w-4" />,
    href: '/category/layer2',
    category: 'layer2',
  },
  {
    id: 'infrastructure',
    label: 'Infrastructure',
    labelCN: '基础设施',
    icon: <Server className="h-4 w-4" />,
    href: '/category/infrastructure',
    category: 'infrastructure',
  },
];

export function Sidebar({ isOpen = true, onClose, currentCategory }: SidebarProps) {
  const [categoriesExpanded, setCategoriesExpanded] = useState(true);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-16 left-0 z-40 h-[calc(100vh-4rem)] w-64 border-r bg-background transition-transform duration-200 md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full overflow-y-auto py-4">
          {/* Main Navigation */}
          <nav className="px-3 space-y-1">
            {mainNavItems.map((item) => (
              <Link key={item.id} href={item.href}>
                <Button
                  variant={currentCategory === item.id ? 'secondary' : 'ghost'}
                  className="w-full justify-start gap-3"
                  onClick={onClose}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {item.labelCN}
                  </span>
                </Button>
              </Link>
            ))}
          </nav>

          {/* Categories Section */}
          <div className="mt-6 px-3">
            <Button
              variant="ghost"
              className="w-full justify-between px-3 text-sm font-medium text-muted-foreground"
              onClick={() => setCategoriesExpanded(!categoriesExpanded)}
            >
              <span>Categories / 赛道</span>
              {categoriesExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>

            {categoriesExpanded && (
              <nav className="mt-2 space-y-1">
                {categoryNavItems.map((item) => (
                  <Link key={item.id} href={item.href}>
                    <Button
                      variant={currentCategory === item.category ? 'secondary' : 'ghost'}
                      className="w-full justify-start gap-3 text-sm"
                      onClick={onClose}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {item.labelCN}
                      </span>
                    </Button>
                  </Link>
                ))}
              </nav>
            )}
          </div>

          {/* Admin Section */}
          <div className="mt-6 px-3">
            <p className="px-3 text-sm font-medium text-muted-foreground mb-2">
              Admin / 管理
            </p>
            <nav className="space-y-1">
              {adminNavItems.map((item) => (
                <Link key={item.id} href={item.href}>
                  <Button
                    variant={currentCategory === item.id ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3 text-sm"
                    onClick={onClose}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {item.labelCN}
                    </span>
                  </Button>
                </Link>
              ))}
            </nav>
          </div>

          {/* Footer */}
          <div className="mt-auto px-3 py-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Last updated: Just now
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
