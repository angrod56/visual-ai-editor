'use client';

import { useState, useEffect } from 'react';
import { Loader2, Sparkles, FileVideo, Zap, VolumeX, Type, Scissors, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { SUBTITLE_STYLES } from '@/lib/ffmpeg/subtitle-style-defs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SPEED_OPTIONS = [
  { label: '0.5x', value: 0.5 },
  { label: '0.75x', value: 0.75 },
  { label: '1.25x', value: 1.25 },
  { label: '1.5x', value: 1.5 },
  { label: '2x', value: 2.0 },
];

const SUBTITLE_POSITIONS = [
  { id: 'bottom', label: 'Abajo',  icon: '⬇' },
  { id: 'center', label: 'Centro', icon: '↕' },
  { id: 'top',    label: 'Arriba', icon: '⬆' },
] as const;

const SUBTITLE_FONT_SIZES = [
  { id: 'sm', label: 'S' },
  { id: 'md', label: 'M' },
  { id: 'lg', label: 'L' },
  { id: 'xl', label: 'XL' },
] as const;

interface SelectedOps {
  subtitles: boolean;
  subtitleStyle: string;
  subtitlePosition: 'bottom' | 'center' | 'top';
  subtitleFontSize: 'sm' | 'md' | 'lg' | 'xl';
  speed: boolean;
  speedFactor: number;
  verticalCrop: boolean;
  removeSilence: boolean;
  trim: boolean;
  trimStart: string; // MM:SS
  trimEnd: string;   // MM:SS
  extractAudio: boolean;
}

const DEFAULT_OPS: SelectedOps = {
  subtitles: false,
  subtitleStyle: 'capcut',
  subtitlePosition: 'bottom',
  subtitleFontSize: 'md',
  speed: false,
  speedFactor: 1.5,
  verticalCrop: false,
  removeSilence: false,
  trim: false,
  trimStart: '0:00',
  trimEnd: '',
  extractAudio: false,
};

interface Props {
  projectId: string;
  projectReady: boolean;
  onOperationStarted: (id: string) => void;
  externalTrimStart?: number | null;
  externalTrimEnd?: number | null;
}

/** Parse MM:SS or M:SS into seconds */
function parseTime(val: string): number {
  const parts = val.split(':').map(Number);
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  if (parts.length === 1) return parts[0] ?? 0;
  return 0;
}

/** Convert seconds to M:SS string */
function secondsToMMSS(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function EditOptions({ projectId, projectReady, onOperationStarted, externalTrimStart, externalTrimEnd }: Props) {
  const [ops, setOps] = useState<SelectedOps>(DEFAULT_OPS);

  // Auto-fill trim fields when player sets in/out markers
  useEffect(() => {
    if (externalTrimStart != null) {
      setOps((p) => ({ ...p, trim: true, trimStart: secondsToMMSS(externalTrimStart) }));
    }
  }, [externalTrimStart]);

  useEffect(() => {
    if (externalTrimEnd != null) {
      setOps((p) => ({ ...p, trim: true, trimEnd: secondsToMMSS(externalTrimEnd) }));
    }
  }, [externalTrimEnd]);
  const [customInstruction, setCustomInstruction] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const set = (patch: Partial<SelectedOps>) => setOps((p) => ({ ...p, ...patch }));

  const toggle = (key: keyof Pick<SelectedOps, 'subtitles' | 'speed' | 'verticalCrop' | 'removeSilence' | 'trim' | 'extractAudio'>) => {
    if (key === 'extractAudio' && !ops.extractAudio) {
      // extractAudio is exclusive — clear all other video ops
      set({ ...DEFAULT_OPS, extractAudio: true });
      return;
    }
    if (key !== 'extractAudio' && ops.extractAudio) {
      set({ extractAudio: false, [key]: true });
      return;
    }
    set({ [key]: !ops[key] });
  };

  // Preset: apply multiple options at once
  const applyPreset = (preset: Partial<SelectedOps>) => set({ ...DEFAULT_OPS, ...preset });

  const hasDirectOps =
    ops.subtitles || ops.speed || ops.verticalCrop || ops.removeSilence ||
    ops.trim || ops.extractAudio;

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
          extractAudio: ops.extractAudio,
          trim: ops.trim,
          trimStart: ops.trim ? parseTime(ops.trimStart) : undefined,
          trimEnd: ops.trim && ops.trimEnd ? parseTime(ops.trimEnd) : undefined,
        };
        body.subtitle_position = ops.subtitlePosition;
        body.subtitle_fontsize = ops.subtitleFontSize;
        if (customInstruction.trim()) body.instruction = customInstruction.trim();
      } else {
        body.instruction = customInstruction.trim();
        body.subtitle_style = ops.subtitleStyle;
        body.subtitle_position = ops.subtitlePosition;
        body.subtitle_fontsize = ops.subtitleFontSize;
      }

      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Error al iniciar'); return; }

      onOperationStarted(data.operation_id);
      setOps(DEFAULT_OPS);
      setCustomInstruction('');
      toast.success('Procesando exportación...');
      fetch(`/api/edit/${data.operation_id}/process`, { method: 'POST', keepalive: true }).catch(() => {});
    } catch {
      toast.error('Error de conexión');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Active tags summary ──────────────────────────────────────────────────
  const activeTags: string[] = [];
  if (ops.trim && ops.trimEnd) activeTags.push(`✂️ ${ops.trimStart} → ${ops.trimEnd}`);
  if (ops.removeSilence) activeTags.push('🔇 Sin silencios');
  if (ops.speed) activeTags.push(`⚡ ${ops.speedFactor}x`);
  if (ops.verticalCrop) activeTags.push('📱 9:16');
  if (ops.subtitles) activeTags.push(`📝 ${SUBTITLE_STYLES.find(s => s.id === ops.subtitleStyle)?.label ?? 'Subtítulos'}`);
  if (ops.extractAudio) activeTags.push('🎵 MP3');

  return (
    <div className="space-y-4">

      {/* ── Presets ─────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Presets rápidos</p>
        <div className="flex flex-wrap gap-2">
          <PresetBtn
            icon="📱"
            label="Reel Instagram"
            active={ops.verticalCrop && ops.trim && ops.trimEnd === '1:30' && !ops.subtitles}
            onClick={() => applyPreset({ verticalCrop: true, trim: true, trimStart: '0:00', trimEnd: '1:30' })}
          />
          <PresetBtn
            icon="🎵"
            label="TikTok 30s"
            active={ops.verticalCrop && ops.trim && ops.trimEnd === '0:30'}
            onClick={() => applyPreset({ verticalCrop: true, trim: true, trimStart: '0:00', trimEnd: '0:30' })}
          />
          <PresetBtn
            icon="📝"
            label="Subtítulos + 9:16"
            active={ops.subtitles && ops.verticalCrop && !ops.trim && !ops.speed}
            onClick={() => applyPreset({ subtitles: true, verticalCrop: true, subtitleStyle: ops.subtitleStyle })}
          />
          <PresetBtn
            icon="🚀"
            label="Reel con subtítulos"
            active={ops.subtitles && ops.verticalCrop && ops.trim && ops.trimEnd === '1:30'}
            onClick={() => applyPreset({ subtitles: true, verticalCrop: true, trim: true, trimStart: '0:00', trimEnd: '1:30', subtitleStyle: ops.subtitleStyle })}
          />
        </div>
      </div>

      {/* ── Operation cards ─────────────────────────────────────── */}
      <div>
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Transformaciones</p>
        <div className="grid grid-cols-2 gap-2">

          <OpCard icon={<Scissors className="w-5 h-5" />} label="Recortar" desc="Elige inicio y fin" active={ops.trim} disabled={!projectReady || ops.extractAudio} onClick={() => toggle('trim')} />
          <OpCard icon={<VolumeX className="w-5 h-5" />} label="Sin silencios" desc="Elimina pausas" active={ops.removeSilence} disabled={!projectReady || ops.extractAudio} onClick={() => toggle('removeSilence')} />
          <OpCard icon={<Zap className="w-5 h-5" />} label="Velocidad" desc={ops.speed ? `${ops.speedFactor}x seleccionado` : 'Cambia la velocidad'} active={ops.speed} disabled={!projectReady || ops.extractAudio} onClick={() => toggle('speed')} />
          <OpCard icon={<FileVideo className="w-5 h-5" />} label="Formato 9:16" desc="TikTok · Reels · Shorts" active={ops.verticalCrop} disabled={!projectReady || ops.extractAudio} onClick={() => toggle('verticalCrop')} />
          <OpCard icon={<Type className="w-5 h-5" />} label="Subtítulos" desc="Texto en el video" active={ops.subtitles} disabled={!projectReady || ops.extractAudio} onClick={() => toggle('subtitles')} />
          <OpCard icon={<Music className="w-5 h-5" />} label="Extraer audio" desc="Exportar como MP3" active={ops.extractAudio} disabled={!projectReady} onClick={() => toggle('extractAudio')} />

        </div>
      </div>

      {/* ── Sub-options ─────────────────────────────────────────── */}

      {/* Trim time inputs */}
      {ops.trim && (
        <div className="space-y-2 p-3 bg-zinc-800/60 rounded-xl border border-zinc-700">
          <p className="text-xs font-medium text-zinc-400">Tiempo de recorte (MM:SS)</p>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-zinc-500 mb-1 block">Inicio</label>
              <Input
                value={ops.trimStart}
                onChange={(e) => set({ trimStart: e.target.value })}
                placeholder="0:00"
                className="h-8 text-sm bg-zinc-800 border-zinc-600 text-white"
              />
            </div>
            <span className="text-zinc-600 mt-4">→</span>
            <div className="flex-1">
              <label className="text-[10px] text-zinc-500 mb-1 block">Fin</label>
              <Input
                value={ops.trimEnd}
                onChange={(e) => set({ trimEnd: e.target.value })}
                placeholder="1:30"
                className="h-8 text-sm bg-zinc-800 border-zinc-600 text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Speed selector */}
      {ops.speed && (
        <div className="space-y-2 p-3 bg-zinc-800/60 rounded-xl border border-zinc-700">
          <p className="text-xs font-medium text-zinc-400">Velocidad de reproducción</p>
          <div className="flex gap-2 flex-wrap">
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => set({ speedFactor: opt.value })}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                  ops.speedFactor === opt.value
                    ? 'bg-amber-500/20 border-amber-500 text-white ring-1 ring-amber-500'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Subtitle style + position + size */}
      {ops.subtitles && (
        <div className="space-y-3 p-3 bg-zinc-800/60 rounded-xl border border-zinc-700">
          {/* Style */}
          <div>
            <p className="text-xs font-medium text-zinc-400 mb-2">Estilo</p>
            <div className="flex flex-wrap gap-2">
              {SUBTITLE_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => set({ subtitleStyle: style.id })}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-all min-w-[60px]',
                    ops.subtitleStyle === style.id
                      ? 'border-amber-500 bg-amber-500/20 ring-1 ring-amber-500'
                      : `${style.preview.bg} ${style.preview.border} hover:border-zinc-500`
                  )}
                >
                  <span className={cn('text-base font-bold leading-none', style.preview.textColor)}>Aa</span>
                  <span className="text-[10px] text-zinc-400">{style.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Position + Size in one row */}
          <div className="flex gap-4">
            <div className="flex-1">
              <p className="text-xs font-medium text-zinc-400 mb-1.5">Posición</p>
              <div className="flex gap-1.5">
                {SUBTITLE_POSITIONS.map((pos) => (
                  <button
                    key={pos.id}
                    onClick={() => set({ subtitlePosition: pos.id })}
                    title={pos.label}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg border text-sm transition-all',
                      ops.subtitlePosition === pos.id
                        ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                        : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-500 hover:text-white'
                    )}
                  >
                    {pos.icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-zinc-400 mb-1.5">Tamaño</p>
              <div className="flex gap-1.5">
                {SUBTITLE_FONT_SIZES.map((sz) => (
                  <button
                    key={sz.id}
                    onClick={() => set({ subtitleFontSize: sz.id })}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all',
                      ops.subtitleFontSize === sz.id
                        ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                        : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-500 hover:text-white'
                    )}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active tags */}
      {activeTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeTags.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-zinc-800" />
        <span className="text-xs text-zinc-600">o instrucción personalizada</span>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>

      {/* Custom instruction */}
      <Textarea
        value={customInstruction}
        onChange={(e) => setCustomInstruction(e.target.value)}
        placeholder={projectReady ? 'Ej: "Genera un resumen de los mejores momentos"' : 'Esperando que el video termine de procesarse...'}
        disabled={!projectReady || isProcessing}
        rows={2}
        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-amber-500 resize-none text-sm"
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
      />

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-semibold gap-2"
      >
        {isProcessing ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Procesando...</>
        ) : (
          <><Sparkles className="w-4 h-4" />{hasDirectOps ? 'Exportar video' : 'Editar con IA'}</>
        )}
      </Button>

      <p className="text-xs text-zinc-600 text-center">
        <kbd className="bg-zinc-800 border border-zinc-700 rounded px-1">⌘ Enter</kbd> para exportar
      </p>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function OpCard({
  icon, label, desc, active, disabled, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        active
          ? 'bg-amber-500/20 border-amber-500 ring-1 ring-amber-500'
          : 'bg-zinc-800 border-zinc-700 hover:border-zinc-500'
      )}
    >
      <span className={cn('shrink-0', active ? 'text-amber-400' : 'text-zinc-400')}>{icon}</span>
      <div className="min-w-0">
        <p className={cn('text-sm font-medium leading-tight', active ? 'text-white' : 'text-zinc-300')}>{label}</p>
        <p className="text-xs text-zinc-500 truncate mt-0.5">{desc}</p>
      </div>
    </button>
  );
}

function PresetBtn({
  icon, label, active, onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all',
        active
          ? 'bg-amber-500/20 border-amber-500 text-white ring-1 ring-amber-500'
          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
      )}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}
