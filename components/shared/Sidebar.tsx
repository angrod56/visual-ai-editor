'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Film, Settings, Sparkles, ImagePlus, Layout, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const NAV_ITEMS = [
  { href: '/projects',  label: 'Proyectos',   icon: Film,      section: 'Video' },
  { href: '/images',    label: 'Imágenes IA', icon: ImagePlus, section: 'Imágenes' },
  { href: '/carousels', label: 'Carruseles',  icon: Layout,    section: 'Imágenes' },
  { href: '/settings',  label: 'Config',      icon: Settings,  section: 'bottom' },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  const inner = (
    <aside className="w-60 bg-black border-r border-zinc-800/60 flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-zinc-800/60 flex items-center justify-between">
        <Link href="/projects" className="flex items-center gap-2.5" onClick={onClose}>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="leading-tight">
            <span className="font-bold text-white text-sm block tracking-wide">VISUAL AI</span>
            <span className="text-amber-400/80 text-[10px] font-medium tracking-widest uppercase">Editor</span>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-zinc-500 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {['Video', 'Imágenes'].map((section) => (
          <div key={section} className="space-y-1">
            <p className="px-3 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">{section}</p>
            {NAV_ITEMS.filter((i) => i.section === section).map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  pathname === href || pathname.startsWith(href + '/')
                    ? section === 'Video'
                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                      : 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
                    : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>
        ))}

        <div className="space-y-1">
          {NAV_ITEMS.filter((i) => i.section === 'bottom').map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                pathname === href
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                  : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="p-4 border-t border-zinc-800/60">
        <p className="text-xs text-zinc-700 text-center tracking-widest uppercase">v1.0</p>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — always visible md+ */}
      <div className="hidden md:flex min-h-screen">
        {inner}
      </div>

      {/* Mobile drawer — overlay */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <div className="absolute left-0 top-0 h-full">
            {inner}
          </div>
        </div>
      )}
    </>
  );
}
