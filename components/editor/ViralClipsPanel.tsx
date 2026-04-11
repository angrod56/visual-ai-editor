'use client';

import { useState } from 'react';
import { Zap, Loader2, TrendingUp, BookOpen, Laugh, Heart, Flame, Lightbulb, BookMarked } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ViralClip } from '@/lib/claude/viral-clips';

interface Props {
  projectId: string;
  projectReady: boolean;
  onClipsStarted: (ids: string[]) => void;
}

const CONTENT_ICONS: Record<string, React.ReactNode> = {
  education: <BookOpen className="w-3.5 h-3.5" />,
  humor: <Laugh className="w-3.5 h-3.5" />,
  emotion: <Heart className="w-3.5 h-3.5" />,
  controversy: <Flame className="w-3.5 h-3.5" />,
  story: <BookMarked className="w-3.5 h-3.5" />,
  tip: <Lightbulb className="w-3.5 h-3.5" />,
};

const CONTENT_LABELS: Record<string, string> = {
  education: 'Educativo',
  humor: 'Humor',
  emotion: 'Emocional',
  controversy: 'Impactante',
  story: 'Historia',
  tip: 'Consejo',
};

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-green-500' :
    score >= 60 ? 'bg-yellow-500' :
    'bg-orange-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn(
        'text-xs font-bold tabular-nums',
        score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-orange-400'
      )}>
        {score}
      </span>
    </div>
  );
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function ViralClipsPanel({ projectId, projectReady, onClipsStarted }: Props) {
  const [loading, setLoading] = useState(false);
  const [clips, setClips] = useState<ViralClip[]>([]);
  const [done, setDone] = useState(false);

  const handleGenerate = async () => {
    if (!projectReady || loading) return;
    setLoading(true);
    setClips([]);
    setDone(false);

    try {
      const res = await fetch(`/api/projects/${projectId}/viral-clips`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'Error al analizar el video');
        return;
      }

      setClips(data.clips ?? []);
      setDone(true);
      onClipsStarted(data.operation_ids ?? []);
      toast.success(`${data.clips?.length ?? 0} clips virales en procesamiento`);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header + button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-pink-400" />
            Clips virales con IA
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Detecta los mejores momentos para TikTok, Reels y Shorts
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={!projectReady || loading}
          className="bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white gap-1.5 shrink-0"
        >
          {loading ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" />Analizando...</>
          ) : (
            <><Zap className="w-3.5 h-3.5" />{done ? 'Re-analizar' : 'Generar clips'}</>
          )}
        </Button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/60 text-center space-y-2">
          <Loader2 className="w-6 h-6 animate-spin text-pink-400 mx-auto" />
          <p className="text-xs text-slate-400">Claude está analizando el contenido...</p>
          <p className="text-xs text-slate-600">Busca hooks, momentos virales y narrativas completas</p>
        </div>
      )}

      {/* Results */}
      {!loading && clips.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">{clips.length} clips encontrados — procesando en segundo plano</p>
          {clips.map((clip, i) => (
            <div
              key={i}
              className="p-3 rounded-xl border border-slate-700 bg-slate-800/60 space-y-2"
            >
              {/* Title + type badge */}
              <div className="flex items-start gap-2">
                <span className="text-xs font-bold text-pink-400 shrink-0 mt-0.5">#{i + 1}</span>
                <p className="text-sm font-medium text-white leading-tight flex-1">{clip.title}</p>
                <span className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-700 rounded-full px-2 py-0.5 shrink-0">
                  {CONTENT_ICONS[clip.content_type]}
                  {CONTENT_LABELS[clip.content_type]}
                </span>
              </div>

              {/* Score bar */}
              <ScoreBar score={clip.viral_score} />

              {/* Hook */}
              <p className="text-xs text-slate-400 italic">&ldquo;{clip.hook}&rdquo;</p>

              {/* Reason + time range */}
              <div className="flex items-end justify-between gap-2">
                <p className="text-xs text-slate-500 leading-snug">{clip.reason}</p>
                <span className="text-xs text-slate-600 shrink-0 font-mono">
                  {fmtTime(clip.start)} → {fmtTime(clip.end)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state after run with no results */}
      {!loading && done && clips.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-3">
          No se encontraron segmentos virales. Intenta con un video de mayor duración.
        </p>
      )}
    </div>
  );
}
