'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GeneratedImage, AdScript } from '@/types';
import { X, Download, Loader2, Type, AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TextLayer {
  text: string;
  size: 'sm' | 'md' | 'lg' | 'xl';
  position: 'top' | 'center' | 'bottom';
  style: 'white-shadow' | 'black-shadow' | 'gold-shadow' | 'dark-bg' | 'light-bg';
  align: 'left' | 'center' | 'right';
}

const SIZE_LABELS = { sm: 'S', md: 'M', lg: 'L', xl: 'XL' };
const STYLE_OPTIONS = [
  { id: 'white-shadow', label: 'Blanco',       preview: 'text-white drop-shadow-lg' },
  { id: 'black-shadow', label: 'Negro',         preview: 'text-zinc-900 drop-shadow-lg' },
  { id: 'gold-shadow',  label: 'Dorado',        preview: 'text-amber-400 drop-shadow-lg' },
  { id: 'dark-bg',      label: 'Fondo oscuro',  preview: 'text-white bg-black/60 px-1 rounded' },
  { id: 'light-bg',     label: 'Fondo claro',   preview: 'text-zinc-900 bg-white/80 px-1 rounded' },
] as const;

interface Props {
  image: GeneratedImage;
  scriptData?: AdScript | null;
  onClose: () => void;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  layer: TextLayer
) {
  if (!layer.text.trim()) return;

  const sizePct = { sm: 0.04, md: 0.06, lg: 0.085, xl: 0.12 }[layer.size];
  const fontSize = Math.round(ch * sizePct);
  const maxW = cw * 0.88;
  const xAlign = layer.align === 'center' ? cw / 2 : layer.align === 'left' ? cw * 0.06 : cw * 0.94;
  const textAlign = layer.align;

  ctx.save();
  ctx.font = `bold ${fontSize}px 'Arial Black', 'Arial Bold', Arial, sans-serif`;
  ctx.textAlign = textAlign;
  ctx.textBaseline = 'middle';

  const lines = wrapText(ctx, layer.text, maxW);
  const lineH = fontSize * 1.35;
  const totalH = lines.length * lineH;

  const yCenter =
    layer.position === 'top'    ? ch * 0.14 :
    layer.position === 'center' ? ch * 0.50 :
                                   ch * 0.86;

  const startY = yCenter - (totalH / 2) + lineH / 2;

  // Background rect for bg styles
  if (layer.style === 'dark-bg' || layer.style === 'light-bg') {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    const pad = fontSize * 0.35;
    const bgW = Math.min(
      Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2,
      cw * 0.95
    );
    const bgH = totalH + pad;
    const bgX = layer.align === 'center' ? cw / 2 - bgW / 2 : layer.align === 'left' ? cw * 0.06 - pad : cw * 0.94 - bgW + pad;
    const radius = fontSize * 0.15;
    ctx.fillStyle = layer.style === 'dark-bg' ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.82)';
    ctx.beginPath();
    ctx.roundRect(bgX, startY - lineH / 2 - pad / 2, bgW, bgH, radius);
    ctx.fill();
  }

  // Text style
  const colors = { 'white-shadow': '#FFFFFF', 'black-shadow': '#0A0A0A', 'gold-shadow': '#F59E0B', 'dark-bg': '#FFFFFF', 'light-bg': '#111111' };
  ctx.fillStyle = colors[layer.style];

  if (['white-shadow', 'black-shadow', 'gold-shadow'].includes(layer.style)) {
    ctx.shadowColor = layer.style === 'black-shadow' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = fontSize * 0.35;
    ctx.shadowOffsetX = fontSize * 0.04;
    ctx.shadowOffsetY = fontSize * 0.04;
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  lines.forEach((line, i) => {
    ctx.fillText(line, xAlign, startY + i * lineH, maxW);
  });

  ctx.restore();
}

export function AdTextEditor({ image, scriptData, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);
  const [loadingImg, setLoadingImg] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const [hook, setHook] = useState<TextLayer>({
    text: scriptData?.hook ?? '',
    size: 'lg',
    position: 'bottom',
    style: 'white-shadow',
    align: 'center',
  });
  const [cta, setCta] = useState<TextLayer>({
    text: scriptData?.cta ?? '',
    size: 'sm',
    position: 'bottom',
    style: 'gold-shadow',
    align: 'center',
  });

  // Load image via proxy to avoid CORS
  useEffect(() => {
    setLoadingImg(true);
    const img = new Image();
    img.onload = () => { setLoadedImg(img); setLoadingImg(false); };
    img.onerror = () => { setLoadingImg(false); toast.error('Error al cargar imagen'); };
    img.src = `/api/images/${image.id}/proxy`;
  }, [image.id]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImg) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = loadedImg.naturalWidth;
    canvas.height = loadedImg.naturalHeight;
    ctx.drawImage(loadedImg, 0, 0);

    // Hook layer (drawn first so CTA can overlap)
    drawLayer(ctx, canvas.width, canvas.height, hook);

    // CTA layer — offset downward if same position as hook
    const ctaLayer = { ...cta };
    if (ctaLayer.position === hook.position && ctaLayer.text && hook.text) {
      // shift CTA slightly down/up to avoid overlap
      const ctaOffset = ctaLayer.position === 'top' ? 0.10 : -0.10;
      const originalPos = ctaLayer.position;
      // We handle this by drawing after calculating offset
      drawLayerWithOffset(ctx, canvas.width, canvas.height, ctaLayer, ctaOffset);
      void originalPos;
    } else {
      drawLayer(ctx, canvas.width, canvas.height, ctaLayer);
    }
  }, [loadedImg, hook, cta]);

  useEffect(() => { redraw(); }, [redraw]);

  const handleDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDownloading(true);
    try {
      canvas.toBlob((blob) => {
        if (!blob) { toast.error('Error al exportar'); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ad-${image.format}-${image.id.slice(0, 6)}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Imagen descargada con texto');
      }, 'image/jpeg', 0.95);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-3" onClick={onClose}>
      <div
        className="relative w-full max-w-5xl max-h-[95vh] bg-zinc-900 rounded-2xl border border-zinc-700 overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-white">Editor de Anuncio</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={downloading || loadingImg}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-1.5"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Descargar
            </Button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Canvas preview */}
          <div className="flex-1 bg-zinc-950 flex items-center justify-center p-4 overflow-hidden">
            {loadingImg ? (
              <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
            ) : (
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                style={{ maxHeight: 'calc(95vh - 130px)' }}
              />
            )}
          </div>

          {/* Controls */}
          <div className="w-72 shrink-0 border-l border-zinc-800 overflow-y-auto p-4 space-y-5">
            <TextLayerControls
              label="Hook / Titular"
              layer={hook}
              color="amber"
              onChange={setHook}
            />
            <div className="border-t border-zinc-800" />
            <TextLayerControls
              label="CTA / Llamada a la acción"
              layer={cta}
              color="sky"
              onChange={setCta}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper to draw CTA with a Y offset to avoid overlap
function drawLayerWithOffset(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  layer: TextLayer,
  offsetFraction: number
) {
  const modified = { ...layer };
  const sizePct = { sm: 0.04, md: 0.06, lg: 0.085, xl: 0.12 }[layer.size];
  const fontSize = Math.round(ch * sizePct);
  const maxW = cw * 0.88;
  const xAlign = layer.align === 'center' ? cw / 2 : layer.align === 'left' ? cw * 0.06 : cw * 0.94;

  ctx.save();
  ctx.font = `bold ${fontSize}px 'Arial Black', 'Arial Bold', Arial, sans-serif`;
  ctx.textAlign = layer.align;
  ctx.textBaseline = 'middle';

  const lines = wrapText(ctx, layer.text, maxW);
  const lineH = fontSize * 1.35;
  const totalH = lines.length * lineH;

  const baseY =
    layer.position === 'top'    ? ch * 0.14 :
    layer.position === 'center' ? ch * 0.50 :
                                   ch * 0.86;
  const yCenter = baseY + ch * offsetFraction;
  const startY = yCenter - totalH / 2 + lineH / 2;

  if (modified.style === 'dark-bg' || modified.style === 'light-bg') {
    ctx.shadowColor = 'transparent';
    const pad = fontSize * 0.35;
    const bgW = Math.min(Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2, cw * 0.95);
    const bgH = totalH + pad;
    const bgX = layer.align === 'center' ? cw / 2 - bgW / 2 : layer.align === 'left' ? cw * 0.06 - pad : cw * 0.94 - bgW + pad;
    ctx.fillStyle = modified.style === 'dark-bg' ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.82)';
    ctx.beginPath();
    ctx.roundRect(bgX, startY - lineH / 2 - pad / 2, bgW, bgH, fontSize * 0.15);
    ctx.fill();
  }

  const colors: Record<string, string> = { 'white-shadow': '#FFFFFF', 'black-shadow': '#0A0A0A', 'gold-shadow': '#F59E0B', 'dark-bg': '#FFFFFF', 'light-bg': '#111111' };
  ctx.fillStyle = colors[modified.style] ?? '#FFFFFF';
  if (['white-shadow', 'black-shadow', 'gold-shadow'].includes(modified.style)) {
    ctx.shadowColor = modified.style === 'black-shadow' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = fontSize * 0.35;
    ctx.shadowOffsetX = fontSize * 0.04;
    ctx.shadowOffsetY = fontSize * 0.04;
  }

  lines.forEach((line, i) => ctx.fillText(line, xAlign, startY + i * lineH, maxW));
  ctx.restore();
}

// ── TextLayerControls ──────────────────────────────────────────────────────────

interface ControlsProps {
  label: string;
  layer: TextLayer;
  color: 'amber' | 'sky';
  onChange: (l: TextLayer) => void;
}

function TextLayerControls({ label, layer, color, onChange }: ControlsProps) {
  const accent = color === 'amber' ? 'border-amber-500/60 bg-amber-500/10 text-amber-300' : 'border-sky-500/60 bg-sky-500/10 text-sky-300';
  const inactive = 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200';

  const set = (patch: Partial<TextLayer>) => onChange({ ...layer, ...patch });

  return (
    <div className="space-y-3">
      <p className={cn('text-xs font-semibold', color === 'amber' ? 'text-amber-400' : 'text-sky-400')}>{label}</p>

      <textarea
        value={layer.text}
        onChange={(e) => set({ text: e.target.value })}
        placeholder="Escribe el texto..."
        rows={2}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 resize-none"
      />

      {/* Size */}
      <div>
        <p className="text-xs text-zinc-500 mb-1.5">Tamaño</p>
        <div className="flex gap-1">
          {(['sm', 'md', 'lg', 'xl'] as const).map((s) => (
            <button key={s} onClick={() => set({ size: s })}
              className={cn('flex-1 py-1.5 text-xs font-bold rounded-lg border transition-colors', layer.size === s ? accent : inactive)}>
              {SIZE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Position */}
      <div>
        <p className="text-xs text-zinc-500 mb-1.5">Posición</p>
        <div className="flex gap-1">
          {(['top', 'center', 'bottom'] as const).map((p) => (
            <button key={p} onClick={() => set({ position: p })}
              className={cn('flex-1 py-1.5 text-xs rounded-lg border transition-colors capitalize', layer.position === p ? accent : inactive)}>
              {p === 'top' ? 'Arriba' : p === 'center' ? 'Centro' : 'Abajo'}
            </button>
          ))}
        </div>
      </div>

      {/* Align */}
      <div>
        <p className="text-xs text-zinc-500 mb-1.5">Alineación</p>
        <div className="flex gap-1">
          {(['left', 'center', 'right'] as const).map((a) => (
            <button key={a} onClick={() => set({ align: a })}
              className={cn('flex-1 py-2 rounded-lg border transition-colors flex items-center justify-center', layer.align === a ? accent : inactive)}>
              {a === 'left' ? <AlignLeft className="w-3.5 h-3.5" /> : a === 'center' ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignRight className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>

      {/* Style */}
      <div>
        <p className="text-xs text-zinc-500 mb-1.5">Estilo</p>
        <div className="space-y-1">
          {STYLE_OPTIONS.map((s) => (
            <button key={s.id} onClick={() => set({ style: s.id })}
              className={cn('w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-colors text-left', layer.style === s.id ? accent : inactive)}>
              <span className={cn('text-xs font-bold', s.preview)}>{label.split(' ')[0]}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
