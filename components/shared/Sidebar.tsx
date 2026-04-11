'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Film, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/projects', label: 'Proyectos', icon: Film },
  { href: '/settings', label: 'Configuración', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 min-h-screen bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-slate-800">
        <Link href="/projects" className="flex items-center gap-2">
          <span className="text-2xl">🎬</span>
          <span className="font-bold text-white text-lg leading-tight">
            VisualAI<br />
            <span className="text-purple-400 text-sm font-normal">Editor</span>
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800">
        <p className="text-xs text-slate-600 text-center">VisualAI Editor v1.0</p>
      </div>
    </aside>
  );
}
