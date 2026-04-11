'use client';

import { useState } from 'react';
import { Zap, Loader2, TrendingUp, BookOpen, Laugh, Heart, Flame, Lightbulb, BookMarked, Type, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ViralClip } from '@/lib/claude/viral-clips';
import { SUBTITLE_STYLES } from '@/lib/ffmpeg/subtitle-style-defs';

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
      <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
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
  const [subtitles, setSubtitles] = useState(false);
  const [subtitleStyle, setSubtitleStyle] = useState('clasico');
  const [verticalCrop, setVerticalCrop] = useState(false);

  const handleGenerate = async () => {
    if (!projectReady || loading) return;
    setLoading(true);
    setClips([]);
    setDone(false);

    try {
      const res = await fetch(`/api/projects/${projectId}/viral-clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtitles, subtitleStyle, verticalCrop }),
      });
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
      {/* Header */}
      <div>
        <p className="text-sm font-semibold text-white flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          Clips virales con IA
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          Detecta los mejores momentos para TikTok, Reels y Shorts
        </p>
      </div>

      {/* Export options */}
      <div className="flex flex-wrap gap-2">
        {/* Subtitles toggle */}
        <button
          onClick={() => setSubtitles((v) => !v)}
          disabled={loading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all',
            subtitles
              ? 'bg-amber-500/20 border-amber-500 text-white ring-1 ring-amber-500'
              : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
          )}
        >
          <Type className="w-3.5 h-3.5" />
          Subtítulos
        </button>

        {/* 9:16 toggle */}
        <button
          onClick={() => setVerticalCrop((v) => !v)}
          disabled={loading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all',
            verticalCrop
              ? 'bg-amber-500/20 border-amber-500 text-white ring-1 ring-amber-500'
              : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
          )}
        >
          <Smartphone className="w-3.5 h-3.5" />
          Formato 9:16
        </button>
      </div>

      {/* Subtitle style picker — only visible when subtitles is on */}
      {subtitles && (
        <div className="flex flex-wrap gap-2 p-2.5 bg-zinc-800/60 rounded-xl border border-zinc-700">
          <p className="w-full text-[10px] text-zinc-500 uppercase tracking-wider">Estilo de subtítulos</p>
          {SUBTITLE_STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => setSubtitleStyle(style.id)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-all min-w-[56px]',
                subtitleStyle === style.id
                  ? 'border-amber-500 bg-amber-500/20 ring-1 ring-amber-500'
                  : `${style.preview.bg} ${style.preview.border} hover:border-zinc-500`
              )}
            >
              <span className={cn('text-base font-bold leading-none', style.preview.textColor)}>Aa</span>
              <span className="text-[10px] text-zinc-400">{style.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={!projectReady || loading}
        className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white gap-1.5"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Analizando...</>
        ) : (
          <><Zap className="w-4 h-4" />{done ? 'Re-analizar' : 'Generar clips virales'}</>
        )}
      </Button>

      {/* Loading state */}
      {loading && (
        <div className="p-4 rounded-xl border border-zinc-700 bg-zinc-800/60 text-center space-y-2">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400 mx-auto" />
          <p className="text-xs text-zinc-400">Claude está analizando el contenido...</p>
          <p className="text-xs text-zinc-600">Busca hooks, momentos virales y narrativas completas</p>
        </div>
      )}

      {/* Results */}
      {!loading && clips.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500">{clips.length} clips encontrados — procesando en segundo plano</p>
          {clips.map((clip, i) => (
            <div
              key={i}
              className="p-3 rounded-xl border border-zinc-700 bg-zinc-800/60 space-y-2"
            >
              {/* Title + type badge */}
              <div className="flex items-start gap-2">
                <span className="text-xs font-bold text-amber-400 shrink-0 mt-0.5">#{i + 1}</span>
                <p className="text-sm font-medium text-white leading-tight flex-1">{clip.title}</p>
                <span className="flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-700 rounded-full px-2 py-0.5 shrink-0">
                  {CONTENT_ICONS[clip.content_type]}
                  {CONTENT_LABELS[clip.content_type]}
                </span>
              </div>

              {/* Score bar */}
              <ScoreBar score={clip.viral_score} />

              {/* Hook */}
              <p className="text-xs text-zinc-400 italic">&ldquo;{clip.hook}&rdquo;</p>

              {/* Reason + time range */}
              <div className="flex items-end justify-between gap-2">
                <p className="text-xs text-zinc-500 leading-snug">{clip.reason}</p>
                <span className="text-xs text-zinc-600 shrink-0 font-mono">
                  {fmtTime(clip.start)} → {fmtTime(clip.end)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state after run with no results */}
      {!loading && done && clips.length === 0 && (
        <p className="text-xs text-zinc-500 text-center py-3">
          No se encontraron segmentos virales. Intenta con un video de mayor duración.
        </p>
      )}
    </div>
  );
}
