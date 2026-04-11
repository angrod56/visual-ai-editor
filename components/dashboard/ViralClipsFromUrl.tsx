'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, Loader2, CheckCircle2, ArrowRight, Type, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SUBTITLE_STYLES } from '@/lib/ffmpeg/subtitle-style-defs';

type Stage = 'idle' | 'downloading' | 'transcribing' | 'analyzing' | 'done';

const STAGES: Record<Stage, { label: string; sub: string }> = {
  idle: { label: '', sub: '' },
  downloading: { label: 'Descargando video...', sub: 'Obteniendo el video de YouTube' },
  transcribing: { label: 'Transcribiendo con IA...', sub: 'Whisper analiza el audio' },
  analyzing: { label: 'Detectando momentos virales...', sub: 'Claude busca los mejores hooks' },
  done: { label: '¡Clips encontrados!', sub: 'Abriendo el editor...' },
};

const STAGE_ORDER: Stage[] = ['downloading', 'transcribing', 'analyzing', 'done'];

export function ViralClipsFromUrl() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [subtitles, setSubtitles] = useState(false);
  const [subtitleStyle, setSubtitleStyle] = useState('clasico');
  const [verticalCrop, setVerticalCrop] = useState(false);

  const isYouTube = /youtube\.com|youtu\.be/.test(url);
  const isBusy = stage !== 'idle' && stage !== 'done';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !isYouTube || isBusy) return;

    try {
      // 1. Download
      setStage('downloading');
      const uploadRes = await fetch('/api/upload/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        toast.error(uploadData.error ?? 'Error al descargar el video');
        setStage('idle');
        return;
      }
      const projectId: string = uploadData.project_id;

      // 2. Metadata
      await fetch('/api/process/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      });

      // 3. Transcribe
      setStage('transcribing');
      const transcribeRes = await fetch('/api/process/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      });
      if (!transcribeRes.ok) {
        toast.error('Error al transcribir el video');
        setStage('idle');
        return;
      }

      // 4. Generate viral clips
      setStage('analyzing');
      const clipsRes = await fetch(`/api/projects/${projectId}/viral-clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtitles, subtitleStyle, verticalCrop }),
      });
      const clipsData = await clipsRes.json();
      if (!clipsRes.ok) {
        // Still redirect even if clips failed — user can generate manually in editor
        toast.warning(clipsData.error ?? 'No se encontraron clips virales');
      } else {
        toast.success(`${clipsData.clips?.length ?? 0} clips virales en procesamiento`);
      }

      // 5. Redirect to editor
      setStage('done');
      setTimeout(() => router.push(`/projects/${projectId}`), 600);
    } catch {
      toast.error('Error de conexión');
      setStage('idle');
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-zinc-900 via-black to-zinc-900 p-6">
      {/* Background glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base">Clips virales desde YouTube</h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              Pega un link y la IA detecta los mejores momentos para TikTok, Reels y Shorts
            </p>
          </div>
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            disabled={isBusy}
            className="flex-1 bg-zinc-800/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-amber-500 h-10"
          />
          <Button
            type="submit"
            disabled={!isYouTube || isBusy}
            className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-semibold gap-2 h-10 shrink-0 px-5"
          >
            {isBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : stage === 'done' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            {stage === 'idle' ? 'Generar clips' : STAGES[stage].label || 'Generar clips'}
          </Button>
        </form>

        {/* Export options */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubtitles((v) => !v)}
            disabled={isBusy}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all',
              subtitles
                ? 'bg-amber-500/20 border-amber-500 text-white ring-1 ring-amber-500'
                : 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
            )}
          >
            <Type className="w-3.5 h-3.5" />
            Subtítulos
          </button>
          <button
            type="button"
            onClick={() => setVerticalCrop((v) => !v)}
            disabled={isBusy}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all',
              verticalCrop
                ? 'bg-amber-500/20 border-amber-500 text-white ring-1 ring-amber-500'
                : 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
            )}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Formato 9:16
          </button>
        </div>

        {/* Subtitle style picker */}
        {subtitles && !isBusy && (
          <div className="flex flex-wrap gap-2 p-2.5 bg-zinc-800/50 rounded-xl border border-zinc-700/60">
            <p className="w-full text-[10px] text-zinc-500 uppercase tracking-wider">Estilo de subtítulos</p>
            {SUBTITLE_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
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

        {/* Progress stages */}
        {stage !== 'idle' && (
          <div className="flex items-center gap-2 flex-wrap">
            {STAGE_ORDER.map((s, i) => {
              const stageIdx = STAGE_ORDER.indexOf(stage);
              const isDone = i < stageIdx || stage === 'done';
              const isActive = s === stage;
              return (
                <div key={s} className="flex items-center gap-1.5">
                  {i > 0 && <div className={cn('w-4 h-px', isDone ? 'bg-amber-500' : 'bg-zinc-700')} />}
                  <div className={cn(
                    'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all',
                    isDone
                      ? 'bg-amber-900/30 border-amber-600/50 text-amber-300'
                      : isActive
                      ? 'bg-amber-500/20 border-amber-500 text-white'
                      : 'bg-zinc-800/60 border-zinc-700 text-zinc-600'
                  )}>
                    {isDone
                      ? <CheckCircle2 className="w-3 h-3" />
                      : isActive
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <div className="w-3 h-3 rounded-full border border-current opacity-40" />
                    }
                    {STAGES[s].label || s}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sub-label during processing */}
        {isBusy && STAGES[stage].sub && (
          <p className="text-xs text-zinc-500 animate-pulse">{STAGES[stage].sub}</p>
        )}

        <p className="text-xs text-zinc-600">
          YouTube · Máximo 30 min · El video se guarda en tu biblioteca
        </p>
      </div>
    </div>
  );
}
