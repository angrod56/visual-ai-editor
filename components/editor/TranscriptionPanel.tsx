'use client';

import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TranscriptionSegment } from '@/types';
import { secondsToTimecode } from '@/lib/ffmpeg/utils';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Props {
  segments: TranscriptionSegment[];
  onSeek?: (seconds: number) => void;
  currentTime?: number;
}

export function TranscriptionPanel({ segments, onSeek, currentTime = 0 }: Props) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? segments.filter((s) => s.text.toLowerCase().includes(search.toLowerCase()))
    : segments;

  const activeSegment = segments.findIndex(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  if (segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-zinc-500 text-sm gap-2">
        <p>Sin transcripción disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
        <Input
          placeholder="Buscar en transcripción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
        />
      </div>

      <ScrollArea className="h-64">
        <div className="space-y-0.5 pr-3">
          {filtered.map((seg, i) => {
            const originalIndex = segments.indexOf(seg);
            const isActive = originalIndex === activeSegment;

            return (
              <button
                key={i}
                onClick={() => onSeek?.(seg.start)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg transition-colors group',
                  isActive
                    ? 'bg-amber-500/20 border border-amber-500/40'
                    : 'hover:bg-zinc-800'
                )}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      'text-xs tabular-nums mt-0.5 shrink-0 font-mono',
                      isActive ? 'text-amber-400' : 'text-zinc-500 group-hover:text-zinc-400'
                    )}
                  >
                    {secondsToTimecode(seg.start)}
                  </span>
                  <p
                    className={cn(
                      'text-xs leading-relaxed',
                      isActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-300'
                    )}
                  >
                    {search.trim()
                      ? highlightText(seg.text, search)
                      : seg.text}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function highlightText(text: string, query: string): React.ReactNode {
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-amber-500/40 text-white rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
