'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sidebar, NAV_ITEMS } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';

interface Props {
  userEmail?: string;
  userName?: string;
  children: React.ReactNode;
}

export function DashboardShell({ userEmail, userName, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Bottom nav shows all nav items except settings (too many items = crowded)
  const bottomNavItems = NAV_ITEMS.filter((i) => i.section !== 'bottom');

  return (
    <div className="min-h-screen bg-black text-white flex">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          userEmail={userEmail}
          userName={userName}
          onMenuClick={() => setSidebarOpen(true)}
        />
        {/* Extra bottom padding on mobile so content doesn't hide behind bottom nav */}
        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>

      {/* ── Bottom navigation bar — mobile only ── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-black border-t border-zinc-800/80 flex items-center safe-area-inset-bottom">
        {bottomNavItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                active ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <Icon className={cn('w-5 h-5', active && 'text-amber-400')} />
              {label}
              {active && <span className="absolute bottom-0 w-6 h-0.5 bg-amber-400 rounded-full" />}
            </Link>
          );
        })}
        {/* Settings icon at the end */}
        {NAV_ITEMS.filter((i) => i.section === 'bottom').map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                active ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
