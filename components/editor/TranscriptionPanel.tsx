'use client';

import { useState, useCallback, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TranscriptionSegment } from '@/types';
import { secondsToTimecode } from '@/lib/ffmpeg/utils';
import { Search, Pencil, Check, X, Copy, FileDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  segments: TranscriptionSegment[];
  onSeek?: (seconds: number) => void;
  currentTime?: number;
  /** Called with updated segments when user saves a change */
  onSegmentsChange?: (updated: TranscriptionSegment[]) => void;
  /** Whether save operation is in progress */
  saving?: boolean;
}

export function TranscriptionPanel({
  segments,
  onSeek,
  currentTime = 0,
  onSegmentsChange,
  saving = false,
}: Props) {
  const [search, setSearch] = useState('');
  const [editMode, setEditMode] = useState(false);
  // Local copy for edits — keyed by segment index
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = search.trim()
    ? segments.filter((s) => s.text.toLowerCase().includes(search.toLowerCase()))
    : segments;

  const activeSegment = segments.findIndex(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  const enterEditMode = () => {
    // Initialise drafts from current text
    const d: Record<number, string> = {};
    segments.forEach((s, i) => { d[i] = s.text; });
    setDrafts(d);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setDrafts({});
    setEditMode(false);
  };

  const saveEdits = useCallback(() => {
    if (!onSegmentsChange) return;
    const updated: TranscriptionSegment[] = segments.map((s, i) => ({
      ...s,
      text: drafts[i] ?? s.text,
    }));
    onSegmentsChange(updated);
    setEditMode(false);
    setDrafts({});
  }, [drafts, onSegmentsChange, segments]);

  const handleDraftChange = (idx: number, value: string) => {
    setDrafts((prev) => ({ ...prev, [idx]: value }));
  };

  // Auto-save on keydown Ctrl/Cmd+S inside a textarea
  const handleTextareaKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      // Debounce to avoid double-trigger
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(saveEdits, 50);
    }
    if (e.key === 'Escape') cancelEdit();
  };

  if (segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-zinc-500 text-sm gap-2">
        <p>Sin transcripción disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row: search + edit toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <Input
            placeholder="Buscar en transcripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={editMode}
            className="pl-8 h-8 text-xs bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
          />
        </div>

        {!editMode && segments.length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(segments.map((s) => s.text.trim()).join(' '));
                toast.success('Transcripción copiada');
              }}
              title="Copiar texto completo"
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => downloadText(buildSRT(segments), 'transcripcion.srt', 'text/plain')}
              title="Descargar como SRT"
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
            </button>
            {onSegmentsChange && (
              <button
                onClick={enterEditMode}
                title="Editar transcripción"
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {editMode && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={saveEdits}
              disabled={saving}
              title="Guardar cambios"
              className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={cancelEdit}
              title="Cancelar"
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {editMode && (
        <p className="text-[10px] text-zinc-500">
          Edita el texto de cada segmento. Guarda con <kbd className="bg-zinc-800 px-1 rounded">⌘S</kbd> o el botón ✓
        </p>
      )}

      <ScrollArea className="h-64">
        <div className="space-y-0.5 pr-3">
          {filtered.map((seg, i) => {
            const originalIndex = segments.indexOf(seg);
            const isActive = originalIndex === activeSegment;

            if (editMode) {
              return (
                <div
                  key={i}
                  className="px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs tabular-nums mt-1.5 shrink-0 font-mono text-zinc-500">
                      {secondsToTimecode(seg.start)}
                    </span>
                    <textarea
                      value={drafts[originalIndex] ?? seg.text}
                      onChange={(e) => handleDraftChange(originalIndex, e.target.value)}
                      onKeyDown={handleTextareaKeyDown}
                      rows={Math.max(1, Math.ceil((drafts[originalIndex] ?? seg.text).length / 60))}
                      className="flex-1 bg-zinc-900 border border-zinc-600 rounded-md px-2 py-1 text-xs text-white resize-none focus:outline-none focus:border-amber-500/60 transition-colors leading-relaxed"
                    />
                  </div>
                </div>
              );
            }

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

function toSrtTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
}

function buildSRT(segments: TranscriptionSegment[]): string {
  return segments
    .map((s, i) => `${i + 1}\n${toSrtTimestamp(s.start)} --> ${toSrtTimestamp(s.end)}\n${s.text.trim()}`)
    .join('\n\n');
}

function downloadText(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
