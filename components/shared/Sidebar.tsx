'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Film, Settings, Sparkles, ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';

const videoItems = [
  { href: '/projects', label: 'Proyectos', icon: Film },
];

const imageItems = [
  { href: '/images', label: 'Imágenes IA', icon: ImagePlus },
];

const bottomItems = [
  { href: '/settings', label: 'Configuración', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 min-h-screen bg-black border-r border-zinc-800/60 flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-zinc-800/60">
        <Link href="/projects" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="leading-tight">
            <span className="font-bold text-white text-sm block tracking-wide">VISUAL AI</span>
            <span className="text-amber-400/80 text-[10px] font-medium tracking-widest uppercase">Editor</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-4">
        {/* Video section */}
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">Video</p>
          {videoItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                pathname === href || pathname.startsWith(href + '/')
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                  : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </div>

        {/* Images section */}
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">Imágenes</p>
          {imageItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                pathname === href || pathname.startsWith(href + '/')
                  ? 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
                  : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </div>

        {/* Settings at bottom */}
        <div className="space-y-1">
          {bottomItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
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

      {/* Footer */}
      <div className="p-4 border-t border-zinc-800/60">
        <p className="text-xs text-zinc-700 text-center tracking-widest uppercase">v1.0</p>
      </div>
    </aside>
  );
}
