import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { TooltipProvider } from '@/components/ui/tooltip';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Crypto Dashboard - Track Crypto Projects by Category',
  description: 'Monitor cryptocurrency projects across CEX, DEX, DeFi, Layer 1, Layer 2, and more. Get real-time insights and risk alerts.',
  keywords: ['crypto', 'dashboard', 'defi', 'cex', 'dex', 'blockchain', 'trading'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TooltipProvider>
          <div className="min-h-screen bg-background">
            {children}
          </div>
        </TooltipProvider>
      </body>
    </html>
  );
}
