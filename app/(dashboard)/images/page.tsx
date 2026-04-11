'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AdScript, GeneratedImage } from '@/types';
import { ScriptGenerator } from '@/components/images/ScriptGenerator';
import { ImageGallery } from '@/components/images/ImageGallery';
import { Wand2, Loader2, Sparkles, Upload, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const FORMATS = [
  { id: 'square',     label: 'Cuadrado',  ratio: '1:1',  desc: 'Instagram / Facebook' },
  { id: 'portrait',   label: 'Vertical',  ratio: '9:16', desc: 'Stories / Reels / TikTok' },
  { id: 'portrait43', label: 'Retrato',   ratio: '3:4',  desc: 'Instagram Portrait' },
  { id: 'landscape',  label: 'Horizontal',ratio: '16:9', desc: 'Banner / YouTube' },
] as const;

type FormatId = typeof FORMATS[number]['id'];

const PROVIDERS = [
  { id: 'dalle3',  label: 'DALL-E 3',     sublabel: 'OpenAI · Recomendado', color: 'sky' },
  { id: 'dalle3hd', label: 'DALL-E 3 HD', sublabel: 'OpenAI · Alta calidad', color: 'violet' },
] as const;

type ProviderId = typeof PROVIDERS[number]['id'];

export default function ImagesPage() {
  const [prompt, setPrompt] = useState('');
  const [format, setFormat] = useState<FormatId>('square');
  const [count, setCount] = useState(4);
  const [quality, setQuality] = useState<'standard' | 'hd'>('standard');
  const [provider, setProvider] = useState<ProviderId>('dalle3');
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [referenceImage, setReferenceImage] = useState<string | null>(null); // base64
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [allProgress, setAllProgress] = useState<{ current: number; total: number } | null>(null);

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
    // Auto-generate immediately with this script's visual description
    generateImages(script.visual_description);
  };

  const compressImage = (file: File): Promise<{ base64: string; previewUrl: string }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 1024;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        URL.revokeObjectURL(objectUrl);
        resolve({ base64: dataUrl.split(',')[1], previewUrl: dataUrl });
      };
      img.onerror = reject;
      img.src = objectUrl;
    });
  };

  const handleReferenceFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Solo se aceptan imágenes'); return; }
    try {
      const { base64, previewUrl } = await compressImage(file);
      setReferenceImage(base64);
      setReferencePreview(previewUrl);
    } catch {
      toast.error('Error al procesar la imagen');
    }
  }, []);

  const generateImages = async (promptOverride?: string) => {
    const activePrompt = promptOverride ?? prompt;
    if (!activePrompt.trim()) { toast.error('Escribe un prompt o genera scripts primero'); return; }
    if (generating) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: activePrompt, format, count, quality, provider, reference_image: referenceImage ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Error al generar'); return; }

      const generated = data.images?.length ?? 0;
      const failed = data.failed ?? 0;

      if (generated > 0) {
        toast.success(`${generated} imagen${generated !== 1 ? 'es' : ''} generada${generated !== 1 ? 's' : ''}`);
        await fetchImages();
      }
      if (failed > 0) {
        const reason = data.errors?.[0] ?? 'Error desconocido';
        toast.warning(`${failed} imagen${failed !== 1 ? 'es' : ''} falló: ${reason.slice(0, 120)}`);
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = () => generateImages();

  const handleGenerateAll = async (scripts: AdScript[]) => {
    if (generatingAll || generating) return;
    setGeneratingAll(true);
    setAllProgress({ current: 0, total: scripts.length });
    let totalGenerated = 0;
    for (let i = 0; i < scripts.length; i++) {
      setAllProgress({ current: i + 1, total: scripts.length });
      try {
        const res = await fetch('/api/images/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: scripts[i].visual_description,
            format, count, quality, provider,
            reference_image: referenceImage ?? undefined,
          }),
        });
        const data = await res.json();
        if (res.ok) totalGenerated += data.images?.length ?? 0;
      } catch { /* continue with next */ }
    }
    await fetchImages();
    toast.success(`${totalGenerated} imágenes generadas para ${scripts.length} scripts`);
    setGeneratingAll(false);
    setAllProgress(null);
  };

  const selectedFormat = FORMATS.find((f) => f.id === format)!;
  const estimatedSeconds = Math.ceil(count * 12);

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
          <ScriptGenerator
            onUseVisual={handleUseVisual}
            onGenerateAll={handleGenerateAll}
            generatingAll={generatingAll}
            allProgress={allProgress}
          />
        </div>

        {/* RIGHT: Image Generator */}
        <div className="space-y-4" ref={generatorRef}>
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
            <div className="w-6 h-6 rounded-full bg-sky-500/20 flex items-center justify-center">
              <span className="text-sky-400 text-xs font-bold">2</span>
            </div>
            <h2 className="text-sm font-semibold text-white">Genera imágenes en masa</h2>
          </div>

          {/* Provider selector */}
          <div>
            <label className="text-xs text-zinc-400 mb-2 block">Motor de IA</label>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={cn(
                    'p-3 rounded-xl border-2 text-left transition-all',
                    provider === p.id
                      ? p.color === 'sky'
                        ? 'bg-sky-500/10 border-sky-500/60'
                        : 'bg-violet-500/10 border-violet-500/60'
                      : 'bg-zinc-800 border-zinc-700 hover:border-zinc-500'
                  )}
                >
                  <p className={cn('text-sm font-semibold', provider === p.id ? (p.color === 'sky' ? 'text-sky-300' : 'text-violet-300') : 'text-zinc-300')}>
                    {p.label}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">{p.sublabel}</p>
                  {p.id === 'dalle3hd' && (
                    <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 bg-violet-500/20 text-violet-400 rounded-md font-medium">
                      Mayor detalle y nitidez
                    </span>
                  )}
                </button>
              ))}
            </div>
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

          {/* Reference image */}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <User className="w-3 h-3" />
              Imagen de referencia
              <span className="text-zinc-600 font-normal">(opcional · humaniza el resultado)</span>
            </label>

            {referencePreview ? (
              <div className="relative inline-flex">
                <img
                  src={referencePreview}
                  alt="Referencia"
                  className="h-20 w-20 object-cover rounded-xl border-2 border-sky-500/40"
                />
                <button
                  onClick={() => { setReferenceImage(null); setReferencePreview(null); }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-zinc-800 border border-zinc-600 rounded-full flex items-center justify-center hover:bg-red-900/40 hover:border-red-600 transition-colors"
                >
                  <X className="w-3 h-3 text-zinc-400" />
                </button>
                <div className="ml-3 flex flex-col justify-center gap-1">
                  <p className="text-xs text-sky-300 font-medium">Referencia cargada</p>
                  <p className="text-xs text-zinc-500">GPT-4 Vision analizará esta persona</p>
                  <button
                    onClick={() => referenceInputRef.current?.click()}
                    className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-2 text-left"
                  >
                    Cambiar imagen
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => referenceInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
                onDragLeave={() => setDraggingOver(false)}
                onDrop={(e) => { e.preventDefault(); setDraggingOver(false); const f = e.dataTransfer.files[0]; if (f) handleReferenceFile(f); }}
                className={cn(
                  'w-full border-2 border-dashed rounded-xl px-4 py-3 flex items-center gap-3 transition-all text-left',
                  draggingOver
                    ? 'border-sky-500/60 bg-sky-500/10'
                    : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/50 hover:bg-zinc-800'
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center shrink-0">
                  <Upload className="w-4 h-4 text-zinc-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-300">Subir foto de persona</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Arrastra o haz clic · JPG, PNG</p>
                </div>
              </button>
            )}

            <input
              ref={referenceInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReferenceFile(f); e.target.value = ''; }}
            />
          </div>

          {/* Format selector */}
          <div>
            <label className="text-xs text-zinc-400 mb-2 block">Formato</label>
            <div className="grid grid-cols-4 gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={cn(
                    'p-2.5 rounded-xl border-2 transition-all text-center',
                    format === f.id
                      ? 'bg-sky-500/10 border-sky-500/60 text-sky-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                  )}
                >
                  {/* Aspect ratio visual */}
                  <div className="flex items-center justify-center mb-2 h-8">
                    <div
                      className={cn(
                        'border-2 rounded',
                        format === f.id ? 'border-sky-400/60 bg-sky-500/10' : 'border-zinc-600 bg-zinc-700/40'
                      )}
                      style={{
                        width:  f.ratio === '16:9' ? 28 : f.ratio === '9:16' ? 14 : f.ratio === '3:4' ? 16 : 20,
                        height: f.ratio === '16:9' ? 16 : f.ratio === '9:16' ? 25 : f.ratio === '3:4' ? 21 : 20,
                      }}
                    />
                  </div>
                  <p className="text-xs font-semibold">{f.label}</p>
                  <p className="text-xs opacity-60">{f.ratio}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-600 mt-1.5">{selectedFormat.desc}</p>
          </div>

          {/* Count + Quality */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 mb-2 block">Cantidad</label>
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

            {/* Quality only for DALL-E */}
            {provider === 'dalle3' && (
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">Calidad</label>
                <div className="flex gap-1.5">
                  {[{ id: 'standard', label: 'Rápido' }, { id: 'hd', label: 'HD' }].map((q) => (
                    <button
                      key={q.id}
                      onClick={() => setQuality(q.id as 'standard' | 'hd')}
                      className={cn(
                        'flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors',
                        quality === q.id
                          ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                          : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'
                      )}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Estimate */}
          <div className="text-xs text-zinc-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500/60 inline-block" />
            Tiempo estimado: ~{estimatedSeconds}s · {count} imagen{count !== 1 ? 'es' : ''} · {selectedFormat.ratio}
          </div>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white font-semibold gap-2 h-11"
          >
            {generating
              ? <><Loader2 className="w-5 h-5 animate-spin" />Generando {count} imagen{count !== 1 ? 'es' : ''}...</>
              : <><Wand2 className="w-5 h-5" />Generar {count} imagen{count !== 1 ? 'es' : ''} · {selectedFormat.ratio}</>
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
