'use client';

import { useEffect, useRef, useState } from 'react';
import { AdScript, GeneratedImage } from '@/types';
import { ScriptGenerator } from '@/components/images/ScriptGenerator';
import { ImageGallery } from '@/components/images/ImageGallery';
import { Wand2, Loader2, Zap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Format options
const FORMATS = [
  { id: 'square',    label: 'Cuadrado',   ratio: '1:1',    desc: 'Instagram / Facebook',     w: 1024, h: 1024 },
  { id: 'portrait',  label: 'Vertical',   ratio: '9:16',   desc: 'Stories / Reels / TikTok', w: 1024, h: 1792 },
  { id: 'landscape', label: 'Horizontal', ratio: '16:9',   desc: 'Banner / YouTube',         w: 1792, h: 1024 },
] as const;

const QUALITY_OPTIONS = [
  { id: 'standard', label: 'Rápido', desc: 'DALL-E 3 Standard' },
  { id: 'hd',       label: 'HD',     desc: 'DALL-E 3 HD' },
];

export default function ImagesPage() {
  const [prompt, setPrompt] = useState('');
  const [format, setFormat] = useState<'square' | 'portrait' | 'landscape'>('square');
  const [count, setCount] = useState(4);
  const [quality, setQuality] = useState<'standard' | 'hd'>('standard');
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(true);

  const generatorRef = useRef<HTMLDivElement>(null);

  const fetchImages = async () => {
    setLoadingGallery(true);
    try {
      const res = await fetch('/api/images');
      if (res.ok) setImages(await res.json());
    } finally {
      setLoadingGallery(false);
    }
  };

  useEffect(() => { fetchImages(); }, []);

  const handleUseVisual = (script: AdScript) => {
    setPrompt(script.visual_description);
    generatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) { toast.error('Escribe un prompt o genera scripts primero'); return; }
    setGenerating(true);
    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, format, count, quality }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Error al generar'); return; }

      const generated = data.images?.length ?? 0;
      const failed = data.failed ?? 0;

      if (generated > 0) {
        toast.success(`${generated} imagen${generated !== 1 ? 'es' : ''} generada${generated !== 1 ? 's' : ''}`);
        await fetchImages();
      }
      if (failed > 0) toast.warning(`${failed} imagen${failed !== 1 ? 'es' : ''} fallaron`);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-amber-400" />
          Generador de Imágenes
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Crea scripts profesionales con IA y genera imágenes en masa para tus anuncios de Meta
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* LEFT: Script Generator */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
              <span className="text-amber-400 text-xs font-bold">1</span>
            </div>
            <h2 className="text-sm font-semibold text-white">Genera tu script con IA</h2>
          </div>
          <ScriptGenerator onUseVisual={handleUseVisual} />
        </div>

        {/* RIGHT: Image Generator */}
        <div className="space-y-4" ref={generatorRef}>
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
            <div className="w-6 h-6 rounded-full bg-sky-500/20 flex items-center justify-center">
              <span className="text-sky-400 text-xs font-bold">2</span>
            </div>
            <h2 className="text-sm font-semibold text-white">Genera imágenes en masa</h2>
          </div>

          {/* Prompt */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Prompt visual</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe la imagen que quieres generar, o usa el botón 'Usar descripción' de un script generado arriba..."
              rows={4}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-500 transition-colors resize-none"
            />
          </div>

          {/* Format selector */}
          <div>
            <label className="text-xs text-zinc-400 mb-2 block">Formato</label>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={cn(
                    'p-3 rounded-xl border-2 transition-all text-left',
                    format === f.id
                      ? 'bg-sky-500/10 border-sky-500/60 text-sky-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                  )}
                >
                  {/* Aspect ratio preview */}
                  <div className="flex items-center justify-center mb-2">
                    <div
                      className={cn(
                        'border-2 rounded transition-colors',
                        format === f.id ? 'border-sky-400/60 bg-sky-500/10' : 'border-zinc-600 bg-zinc-700/40'
                      )}
                      style={{
                        width: f.id === 'landscape' ? 28 : f.id === 'portrait' ? 14 : 20,
                        height: f.id === 'landscape' ? 16 : f.id === 'portrait' ? 25 : 20,
                      }}
                    />
                  </div>
                  <p className="text-xs font-semibold">{f.label}</p>
                  <p className="text-xs opacity-60">{f.ratio}</p>
                  <p className="text-xs opacity-50 mt-0.5">{f.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Count + Quality */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 mb-2 block">Cantidad (por lote)</label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={cn(
                      'flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors',
                      count === n
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                        : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-2 block">Calidad</label>
              <div className="flex gap-1.5">
                {QUALITY_OPTIONS.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => setQuality(q.id as 'standard' | 'hd')}
                    className={cn(
                      'flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors',
                      quality === q.id
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                        : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'
                    )}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Info banner */}
          <div className="p-3 bg-zinc-800/60 border border-zinc-700 rounded-xl flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-400 leading-relaxed">
              <span className="text-zinc-300 font-medium">DALL-E 3</span> genera imágenes fotorrealistas profesionales.
              Usa el prompt de tu script para obtener imágenes coherentes con tu copy.
              {count > 1 && <span className="text-amber-400"> Generando {count} imágenes en paralelo (~{count * 12}s).</span>}
            </div>
          </div>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white font-semibold gap-2 h-11"
          >
            {generating
              ? <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generando {count} imagen{count !== 1 ? 'es' : ''}...
                </>
              : <>
                  <Wand2 className="w-5 h-5" />
                  Generar {count} imagen{count !== 1 ? 'es' : ''} · {FORMATS.find(f => f.id === format)?.ratio}
                </>
            }
          </Button>
        </div>
      </div>

      {/* Gallery */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
          <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
            <span className="text-green-400 text-xs font-bold">3</span>
          </div>
          <h2 className="text-sm font-semibold text-white">Galería de imágenes generadas</h2>
        </div>

        {loadingGallery ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
          </div>
        ) : (
          <ImageGallery
            images={images}
            onDeleted={(id) => setImages((prev) => prev.filter((i) => i.id !== id))}
          />
        )}
      </div>
    </div>
  );
}
