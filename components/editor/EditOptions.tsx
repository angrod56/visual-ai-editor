'use client';

import { useState } from 'react';
import { Loader2, Sparkles, FileVideo, Zap, VolumeX, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SUBTITLE_STYLES } from '@/lib/ffmpeg/subtitle-style-defs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SPEED_OPTIONS = [
  { label: '0.75x', value: 0.75 },
  { label: '1.25x', value: 1.25 },
  { label: '1.5x', value: 1.5 },
  { label: '2x', value: 2.0 },
];

interface SelectedOps {
  subtitles: boolean;
  subtitleStyle: string;
  speed: boolean;
  speedFactor: number;
  verticalCrop: boolean;
  removeSilence: boolean;
}

interface Props {
  projectId: string;
  projectReady: boolean;
  onOperationStarted: (id: string) => void;
}

export function EditOptions({ projectId, projectReady, onOperationStarted }: Props) {
  const [ops, setOps] = useState<SelectedOps>({
    subtitles: false,
    subtitleStyle: 'clasico',
    speed: false,
    speedFactor: 1.5,
    verticalCrop: false,
    removeSilence: false,
  });
  const [customInstruction, setCustomInstruction] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const toggle = (key: 'subtitles' | 'speed' | 'verticalCrop' | 'removeSilence') =>
    setOps((prev) => ({ ...prev, [key]: !prev[key] }));

  const hasDirectOps = ops.subtitles || ops.speed || ops.verticalCrop || ops.removeSilence;
  const canSubmit = (hasDirectOps || customInstruction.trim().length > 0) && projectReady && !isProcessing;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsProcessing(true);
    try {
      const body: Record<string, unknown> = { project_id: projectId };

      if (hasDirectOps) {
        body.direct_options = {
          subtitles: ops.subtitles,
          subtitleStyle: ops.subtitleStyle,
          speed: ops.speed ? ops.speedFactor : null,
          verticalCrop: ops.verticalCrop,
          removeSilence: ops.removeSilence,
        };
        if (customInstruction.trim()) body.instruction = customInstruction.trim();
      } else {
        body.instruction = customInstruction.trim();
        body.subtitle_style = ops.subtitleStyle;
      }

      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Error al iniciar');
        return;
      }

      onOperationStarted(data.operation_id);
      setOps({ subtitles: false, subtitleStyle: 'clasico', speed: false, speedFactor: 1.5, verticalCrop: false, removeSilence: false });
      setCustomInstruction('');
      toast.success('Procesando exportación...');

      fetch(`/api/edit/${data.operation_id}/process`, { method: 'POST', keepalive: true }).catch(() => {});
    } catch {
      toast.error('Error de conexión');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* Operation toggle cards */}
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
          Selecciona las transformaciones
        </p>
        <div className="grid grid-cols-2 gap-2">

          {/* Subtitles */}
          <button
            onClick={() => toggle('subtitles')}
            disabled={!projectReady}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              ops.subtitles
                ? 'bg-purple-600/20 border-purple-500 ring-1 ring-purple-500'
                : 'bg-slate-800 border-slate-700 hover:border-slate-500'
            )}
          >
            <Type className={cn('w-5 h-5 shrink-0', ops.subtitles ? 'text-purple-400' : 'text-slate-400')} />
            <div className="min-w-0">
              <p className={cn('text-sm font-medium', ops.subtitles ? 'text-white' : 'text-slate-300')}>
                Subtítulos
              </p>
              <p className="text-xs text-slate-500 truncate">Texto visible en el video</p>
            </div>
          </button>

          {/* 9:16 vertical */}
          <button
            onClick={() => toggle('verticalCrop')}
            disabled={!projectReady}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              ops.verticalCrop
                ? 'bg-purple-600/20 border-purple-500 ring-1 ring-purple-500'
                : 'bg-slate-800 border-slate-700 hover:border-slate-500'
            )}
          >
            <FileVideo className={cn('w-5 h-5 shrink-0', ops.verticalCrop ? 'text-purple-400' : 'text-slate-400')} />
            <div className="min-w-0">
              <p className={cn('text-sm font-medium', ops.verticalCrop ? 'text-white' : 'text-slate-300')}>
                Formato 9:16
              </p>
              <p className="text-xs text-slate-500 truncate">TikTok · Reels · Shorts</p>
            </div>
          </button>

          {/* Speed */}
          <button
            onClick={() => toggle('speed')}
            disabled={!projectReady}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              ops.speed
                ? 'bg-purple-600/20 border-purple-500 ring-1 ring-purple-500'
                : 'bg-slate-800 border-slate-700 hover:border-slate-500'
            )}
          >
            <Zap className={cn('w-5 h-5 shrink-0', ops.speed ? 'text-purple-400' : 'text-slate-400')} />
            <div className="min-w-0">
              <p className={cn('text-sm font-medium', ops.speed ? 'text-white' : 'text-slate-300')}>
                Velocidad
              </p>
              <p className="text-xs text-slate-500 truncate">
                {ops.speed ? `${ops.speedFactor}x seleccionado` : 'Cambia la velocidad'}
              </p>
            </div>
          </button>

          {/* Remove silence */}
          <button
            onClick={() => toggle('removeSilence')}
            disabled={!projectReady}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              ops.removeSilence
                ? 'bg-purple-600/20 border-purple-500 ring-1 ring-purple-500'
                : 'bg-slate-800 border-slate-700 hover:border-slate-500'
            )}
          >
            <VolumeX className={cn('w-5 h-5 shrink-0', ops.removeSilence ? 'text-purple-400' : 'text-slate-400')} />
            <div className="min-w-0">
              <p className={cn('text-sm font-medium', ops.removeSilence ? 'text-white' : 'text-slate-300')}>
                Sin silencios
              </p>
              <p className="text-xs text-slate-500 truncate">Elimina pausas</p>
            </div>
          </button>

        </div>
      </div>

      {/* Subtitle style picker — shown only when subtitles selected */}
      {ops.subtitles && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Estilo de subtítulos
          </p>
          <div className="flex flex-wrap gap-2">
            {SUBTITLE_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => setOps((prev) => ({ ...prev, subtitleStyle: style.id }))}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-all min-w-[64px]',
                  ops.subtitleStyle === style.id
                    ? 'border-purple-500 bg-purple-600/20 ring-1 ring-purple-500'
                    : `${style.preview.bg} ${style.preview.border} hover:border-slate-500`
                )}
              >
                <span className={cn('text-base font-bold leading-none', style.preview.textColor)}>Aa</span>
                <span className="text-[10px] text-slate-400">{style.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Speed selector — shown only when speed selected */}
      {ops.speed && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Velocidad</p>
          <div className="flex gap-2">
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setOps((prev) => ({ ...prev, speedFactor: opt.value }))}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                  ops.speedFactor === opt.value
                    ? 'bg-purple-600/20 border-purple-500 text-white ring-1 ring-purple-500'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected ops summary */}
      {hasDirectOps && (
        <div className="flex flex-wrap gap-1.5">
          {ops.removeSilence && <Tag>Sin silencios</Tag>}
          {ops.speed && <Tag>{ops.speedFactor}x velocidad</Tag>}
          {ops.verticalCrop && <Tag>9:16 vertical</Tag>}
          {ops.subtitles && <Tag>Subtítulos · {SUBTITLE_STYLES.find(s => s.id === ops.subtitleStyle)?.label}</Tag>}
        </div>
      )}

      {/* Separator */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-slate-800" />
        <span className="text-xs text-slate-600">o instrucción personalizada</span>
        <div className="flex-1 h-px bg-slate-800" />
      </div>

      {/* Custom instruction */}
      <div className="relative">
        <Textarea
          value={customInstruction}
          onChange={(e) => setCustomInstruction(e.target.value)}
          placeholder={
            projectReady
              ? 'Ej: "Recorta del minuto 1:30 al 3:45" o "Genera un reel de 60 segundos"'
              : 'Esperando que el video termine de procesarse...'
          }
          disabled={!projectReady || isProcessing}
          rows={2}
          className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-purple-500 resize-none text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
        />
      </div>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-semibold gap-2"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Procesando...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            {hasDirectOps ? 'Exportar video' : 'Editar con IA'}
          </>
        )}
      </Button>

      <p className="text-xs text-slate-600 text-center">
        <kbd className="bg-slate-800 border border-slate-700 rounded px-1">⌘ Enter</kbd> para exportar
      </p>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs bg-purple-600/20 text-purple-300 border border-purple-500/40">
      {children}
    </span>
  );
}
