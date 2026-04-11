'use client';

import { useCallback, useRef, useState } from 'react';
import {
  CarouselSlide, CarouselTheme, CAROUSEL_THEMES,
  SlideCanvas, SlideCanvasHandle,
} from '@/components/carousels/SlideCanvas';
import {
  Layout, Loader2, Sparkles, Download,
  ChevronLeft, ChevronRight, ArrowLeft,
  ImagePlus, X, ChevronDown, Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PLATFORMS = ['Instagram', 'LinkedIn', 'Facebook', 'Twitter/X'];
const TONES = ['Educativo', 'Inspirador', 'Tips prácticos', 'Historia', 'Ventas'];
const SLIDE_COUNTS = [5, 7, 9, 10];

const FIELD = 'w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors';

export default function CarouselsPage() {
  // — form
  const [topic, setTopic]         = useState('');
  const [niche, setNiche]         = useState('');
  const [audience, setAudience]   = useState('');
  const [platform, setPlatform]   = useState('Instagram');
  const [tone, setTone]           = useState('Educativo');
  const [slideCount, setSlideCount] = useState(7);
  const [ctaText, setCtaText]     = useState('');

  // — shared
  const [themeKey, setThemeKey]         = useState('dark');
  const [generating, setGenerating]     = useState(false);
  const [downloading, setDownloading]   = useState(false);
  const [slides, setSlides]             = useState<CarouselSlide[]>([]);
  const [carouselTitle, setCarouselTitle] = useState('');
  const [activeIdx, setActiveIdx]       = useState(0);
  const [mode, setMode]                 = useState<'form' | 'editor'>('form');

  // — background photo
  const [bgDataUrl, setBgDataUrl]   = useState<string | null>(null);
  const [bgPreview, setBgPreview]   = useState<string | null>(null);
  const [dragging, setDragging]     = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // — per-slide bg: Set of indices that show the photo
  const [bgSlides, setBgSlides] = useState<Set<number>>(new Set());

  // — accordion: Set of indices whose fields are expanded
  const [openSlides, setOpenSlides] = useState<Set<number>>(new Set());

  const thumbRefs = useRef<(SlideCanvasHandle | null)[]>([]);
  const theme: CarouselTheme = CAROUSEL_THEMES[themeKey];

  // ── Compress bg photo ──────────────────────────────────────────────────
  const compressBg = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 1440;
        let { width: w, height: h } = img;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
          else { w = Math.round((w * MAX) / h); h = MAX; }
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d')!.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = url;
    });

  const handleBgFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Solo se aceptan imágenes'); return; }
    try {
      const dataUrl = await compressBg(file);
      setBgDataUrl(dataUrl);
      setBgPreview(dataUrl);
    } catch { toast.error('Error al cargar la imagen'); }
  }, []);

  const clearBg = () => {
    setBgDataUrl(null);
    setBgPreview(null);
    setBgSlides(new Set());
  };

  // ── Per-slide bg toggle ────────────────────────────────────────────────
  const toggleBgSlide = (i: number) => {
    setBgSlides((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  // ── Accordion toggle ───────────────────────────────────────────────────
  const toggleOpen = (i: number) => {
    setOpenSlides((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  // ── Generate ───────────────────────────────────────────────────────────
  const generate = async () => {
    if (!topic.trim()) { toast.error('Escribe el tema del carrusel'); return; }
    setGenerating(true);
    setSlides([]);
    try {
      const res = await fetch('/api/carousels/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, niche, audience, platform, slideCount, tone, ctaText: ctaText.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Error al generar'); return; }
      const generated: CarouselSlide[] = data.slides ?? [];
      thumbRefs.current = new Array(generated.length).fill(null);
      setSlides(generated);
      setCarouselTitle(data.title ?? topic);
      setActiveIdx(0);
      setBgSlides(new Set());
      setOpenSlides(new Set([0])); // first slide open by default
      setMode('editor');
      toast.success(`${generated.length} diapositivas generadas`);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setGenerating(false);
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────
  const updateSlide = (idx: number, patch: Partial<CarouselSlide>) =>
    setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  // ── Download ──────────────────────────────────────────────────────────
  const downloadOne = (idx: number) => {
    const handle = thumbRefs.current[idx];
    if (!handle) return;
    const a = document.createElement('a');
    a.href = handle.toDataURL();
    a.download = `${topic.slice(0, 30).replace(/\s+/g, '-')}-${String(idx + 1).padStart(2, '0')}.jpg`;
    a.click();
  };

  const downloadAll = async () => {
    if (!slides.length) return;
    setDownloading(true);
    toast.info(`Descargando ${slides.length} diapositivas…`);
    for (let i = 0; i < slides.length; i++) {
      await new Promise<void>((resolve) => setTimeout(() => { downloadOne(i); resolve(); }, i * 350));
    }
    setDownloading(false);
    toast.success('Carrusel descargado');
  };

  const prev = () => setActiveIdx((i) => Math.max(0, i - 1));
  const next = () => setActiveIdx((i) => Math.min(slides.length - 1, i + 1));

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layout className="w-6 h-6 text-amber-400" />
            Creador de Carruseles
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Genera carruseles profesionales con IA listos para publicar en redes sociales
          </p>
        </div>
        {mode === 'editor' && (
          <button onClick={() => setMode('form')}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors shrink-0 mt-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Nuevo carrusel
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">

        {/* ══════════ LEFT ══════════ */}
        {mode === 'form' ? (

          /* ── Generation form ── */
          <div className="space-y-5">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Tema del carrusel *</label>
              <input value={topic} onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generate()}
                placeholder="ej: 7 errores al invertir, cómo construir hábitos…"
                className={FIELD} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Nicho</label>
                <input value={niche} onChange={(e) => setNiche(e.target.value)}
                  placeholder="ej: finanzas personales" className={FIELD} />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Audiencia</label>
                <input value={audience} onChange={(e) => setAudience(e.target.value)}
                  placeholder="ej: emprendedores latinos" className={FIELD} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Plataforma</label>
                <div className="flex flex-wrap gap-1">
                  {PLATFORMS.map((p) => (
                    <button key={p} onClick={() => setPlatform(p)}
                      className={cn('px-2 py-1 text-xs rounded-md border transition-colors',
                        platform === p ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300')}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Tono</label>
                <div className="flex flex-wrap gap-1">
                  {TONES.map((t) => (
                    <button key={t} onClick={() => setTone(t)}
                      className={cn('px-2 py-1 text-xs rounded-md border transition-colors',
                        tone === t ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300')}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-2 block">Número de diapositivas</label>
              <div className="flex gap-2">
                {SLIDE_COUNTS.map((n) => (
                  <button key={n} onClick={() => setSlideCount(n)}
                    className={cn('w-14 py-2 text-sm font-semibold rounded-xl border transition-colors',
                      slideCount === n ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300')}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Texto del botón CTA (última diapositiva)</label>
              <input value={ctaText} onChange={(e) => setCtaText(e.target.value)}
                placeholder="ej: Escríbeme al DM, Visita el link en bio, Compra ahora…"
                className={FIELD} />
            </div>

            <BgUpload bgPreview={bgPreview} dragging={dragging} bgInputRef={bgInputRef}
              onClear={clearBg} onDragging={setDragging} onFile={handleBgFile} />

            <ThemeSelector themeKey={themeKey} onChange={setThemeKey} />

            <Button onClick={generate} disabled={generating || !topic.trim()}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-black font-semibold gap-2 h-11">
              {generating
                ? <><Loader2 className="w-5 h-5 animate-spin" />Generando carrusel…</>
                : <><Sparkles className="w-5 h-5" />Generar carrusel con IA</>}
            </Button>
          </div>

        ) : (

          /* ── Slide editor ── */
          <div className="space-y-4">

            {/* Bg photo (accessible in editor too) */}
            <BgUpload bgPreview={bgPreview} dragging={dragging} bgInputRef={bgInputRef}
              onClear={clearBg} onDragging={setDragging} onFile={handleBgFile} compact />

            {/* Theme */}
            <ThemeSelector themeKey={themeKey} onChange={setThemeKey} />

            {/* Accordion list */}
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Editar diapositivas</p>
              <div className="space-y-2">
                {slides.map((slide, i) => {
                  const isOpen   = openSlides.has(i);
                  const hasBg    = bgSlides.has(i);
                  const isActive = activeIdx === i;
                  return (
                    <div key={slide.id}
                      className={cn(
                        'rounded-xl border overflow-hidden transition-colors',
                        isActive ? 'border-amber-500/40' : 'border-zinc-800'
                      )}>

                      {/* Row header */}
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-zinc-900">
                        {/* Preview selector */}
                        <button onClick={() => setActiveIdx(i)}
                          className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors',
                            isActive ? 'bg-amber-500 text-black' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                          )}>
                          {i + 1}
                        </button>

                        {/* Headline (click to preview) */}
                        <button onClick={() => setActiveIdx(i)} className="flex-1 text-left min-w-0">
                          <span className="text-xs text-zinc-300 truncate block">{slide.headline || '—'}</span>
                        </button>

                        {/* Type chip */}
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded border shrink-0',
                          slide.type === 'cover' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                            : slide.type === 'cta' ? 'text-green-400 border-green-500/30 bg-green-500/10'
                            : 'text-zinc-500 border-zinc-700 bg-zinc-800/80'
                        )}>
                          {slide.type === 'cover' ? 'portada' : slide.type === 'cta' ? 'cta' : `#${slide.number}`}
                        </span>

                        {/* Bg photo toggle (only if photo is loaded) */}
                        {bgDataUrl && (
                          <button onClick={() => toggleBgSlide(i)} title="Foto de fondo en esta slide"
                            className={cn(
                              'w-6 h-6 rounded-md flex items-center justify-center transition-colors shrink-0',
                              hasBg ? 'bg-sky-500/20 text-sky-400' : 'bg-zinc-800 text-zinc-600 hover:text-zinc-400'
                            )}>
                            <ImageIcon className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Expand / collapse */}
                        <button onClick={() => toggleOpen(i)}
                          className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors shrink-0">
                          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-180')} />
                        </button>
                      </div>

                      {/* Editable fields */}
                      {isOpen && (
                        <div className="px-3 pb-3 pt-2 space-y-2.5 bg-zinc-950/60 border-t border-zinc-800">
                          <div className="flex gap-2">
                            {/* Emoji */}
                            <div className="shrink-0">
                              <label className="text-[10px] text-zinc-500 mb-1 block">Emoji</label>
                              <input value={slide.emoji ?? ''} onChange={(e) => updateSlide(i, { emoji: e.target.value })}
                                placeholder="🎯"
                                className="w-14 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-amber-500 transition-colors" />
                            </div>
                            {/* Headline */}
                            <div className="flex-1">
                              <label className="text-[10px] text-zinc-500 mb-1 block">Titular</label>
                              <input value={slide.headline} onChange={(e) => updateSlide(i, { headline: e.target.value })}
                                placeholder="Titular…" className={FIELD} />
                            </div>
                          </div>

                          {/* Body */}
                          <div>
                            <label className="text-[10px] text-zinc-500 mb-1 block">
                              {slide.type === 'cta' ? 'Texto del botón' : 'Cuerpo'}
                            </label>
                            <textarea value={slide.body ?? ''} onChange={(e) => updateSlide(i, { body: e.target.value })}
                              placeholder={slide.type === 'cta' ? 'Escríbeme al DM' : 'Amplía el titular…'}
                              rows={2}
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors resize-none" />
                          </div>

                          {/* Highlight + bg row */}
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <label className="text-[10px] text-zinc-500 mb-1 block">Palabra clave</label>
                              <input value={slide.highlight ?? ''} onChange={(e) => updateSlide(i, { highlight: e.target.value })}
                                placeholder="palabra a resaltar" className={FIELD} />
                            </div>
                            {bgDataUrl && (
                              <button onClick={() => toggleBgSlide(i)}
                                className={cn(
                                  'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all shrink-0',
                                  hasBg
                                    ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                                    : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                                )}>
                                <ImageIcon className="w-3 h-3" />
                                {hasBg ? 'Foto activada' : 'Añadir foto'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ RIGHT: Preview ══════════ */}
        <div className="space-y-4">
          {slides.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-800 text-zinc-600 gap-3"
              style={{ height: 480 }}>
              <Layout className="w-14 h-14 opacity-20" />
              <p className="text-sm">El carrusel aparecerá aquí</p>
              <p className="text-xs opacity-60">Completa el formulario y pulsa Generar</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{carouselTitle}</p>
                  <p className="text-xs text-zinc-500">{slides.length} diapositivas · 1080×1080 px</p>
                </div>
                <Button size="sm" onClick={downloadAll} disabled={downloading}
                  className="bg-green-600 hover:bg-green-700 text-white gap-1.5 shrink-0">
                  {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Descargar todo
                </Button>
              </div>

              {/* Large preview */}
              <div className="relative flex items-center justify-center select-none">
                <button onClick={prev} disabled={activeIdx === 0}
                  className="absolute left-0 z-10 w-9 h-9 rounded-full bg-zinc-800/90 border border-zinc-700 flex items-center justify-center disabled:opacity-25 hover:bg-zinc-700 transition-colors -translate-x-4">
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>

                <div className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/5">
                  <SlideCanvas
                    key={`preview-${activeIdx}-${themeKey}`}
                    slide={slides[activeIdx]}
                    theme={theme}
                    slideIndex={activeIdx}
                    totalSlides={slides.length}
                    displaySize={420}
                    backgroundImage={bgDataUrl && bgSlides.has(activeIdx) ? bgDataUrl : undefined}
                  />
                </div>

                <button onClick={next} disabled={activeIdx === slides.length - 1}
                  className="absolute right-0 z-10 w-9 h-9 rounded-full bg-zinc-800/90 border border-zinc-700 flex items-center justify-center disabled:opacity-25 hover:bg-zinc-700 transition-colors translate-x-4">
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>
              </div>

              <div className="flex justify-center">
                <button onClick={() => downloadOne(activeIdx)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5 transition-colors">
                  <Download className="w-3 h-3" />
                  Descargar diapositiva {activeIdx + 1}
                </button>
              </div>

              {/* Thumbnail strip */}
              <div className="flex gap-2 overflow-x-auto pb-1 pt-1">
                {slides.map((slide, i) => (
                  <button key={`thumb-${i}-${themeKey}`} onClick={() => setActiveIdx(i)}
                    className={cn(
                      'shrink-0 overflow-hidden rounded-lg border-2 transition-all',
                      activeIdx === i
                        ? 'border-amber-400 scale-105 shadow-lg shadow-amber-500/20'
                        : 'border-zinc-700 opacity-50 hover:opacity-90 hover:border-zinc-500'
                    )}>
                    <SlideCanvas
                      ref={(el) => { thumbRefs.current[i] = el; }}
                      slide={slide}
                      theme={theme}
                      slideIndex={i}
                      totalSlides={slides.length}
                      displaySize={74}
                      backgroundImage={bgDataUrl && bgSlides.has(i) ? bgDataUrl : undefined}
                    />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────

function BgUpload({ bgPreview, dragging, bgInputRef, onClear, onDragging, onFile, compact = false }: {
  bgPreview: string | null;
  dragging: boolean;
  bgInputRef: React.RefObject<HTMLInputElement>;
  onClear: () => void;
  onDragging: (v: boolean) => void;
  onFile: (f: File) => void;
  compact?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-zinc-400 mb-1.5 flex items-center gap-1.5">
        <ImagePlus className="w-3 h-3" />
        Foto de fondo
        <span className="text-zinc-600 font-normal">(opcional · elige en qué slides aparece)</span>
      </label>
      {bgPreview ? (
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <img src={bgPreview} alt="Fondo" className="w-14 h-14 object-cover rounded-xl border border-zinc-600" />
            <button onClick={onClear}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-800 border border-zinc-600 rounded-full flex items-center justify-center hover:bg-red-900/40 hover:border-red-600 transition-colors">
              <X className="w-3 h-3 text-zinc-400" />
            </button>
          </div>
          <div>
            <p className="text-xs text-zinc-300 font-medium">Foto cargada</p>
            <p className="text-xs text-zinc-500">{compact ? 'Actívala slide por slide con el ícono 🖼' : 'Actívala en cada diapositiva desde el editor'}</p>
            <button onClick={() => bgInputRef.current?.click()} className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2 mt-0.5">
              Cambiar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => bgInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); onDragging(true); }}
          onDragLeave={() => onDragging(false)}
          onDrop={(e) => { e.preventDefault(); onDragging(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
          className={cn(
            'w-full border-2 border-dashed rounded-xl px-4 py-3 flex items-center gap-3 text-left transition-all',
            dragging ? 'border-amber-500/60 bg-amber-500/10' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/50'
          )}>
          <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center shrink-0">
            <ImagePlus className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-300">Subir foto de fondo</p>
            <p className="text-xs text-zinc-500 mt-0.5">Arrastra o haz clic · JPG, PNG</p>
          </div>
        </button>
      )}
      <input ref={bgInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </div>
  );
}

function ThemeSelector({ themeKey, onChange }: { themeKey: string; onChange: (k: string) => void }) {
  return (
    <div>
      <label className="text-xs text-zinc-400 mb-2 block">Tema visual</label>
      <div className="grid grid-cols-5 gap-2">
        {Object.entries(CAROUSEL_THEMES).map(([key, t]) => (
          <button key={key} onClick={() => onChange(key)} title={t.name}
            className={cn(
              'relative h-14 rounded-xl border-2 overflow-hidden transition-all',
              themeKey === key ? 'border-amber-400 scale-[1.06]' : 'border-zinc-700 hover:border-zinc-500'
            )}
            style={{ background: t.isGradient && t.bg2 ? `linear-gradient(135deg, ${t.bg}, ${t.bg2})` : t.bg }}>
            <div className="absolute inset-x-2 top-2 h-1.5 rounded-full" style={{ background: t.accent }} />
            <p className="absolute bottom-1.5 inset-x-0 text-center font-semibold"
              style={{ fontSize: 9, color: t.text }}>{t.name}</p>
            {themeKey === key && (
              <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-amber-400 flex items-center justify-center">
                <span style={{ fontSize: 8, color: '#000', fontWeight: 900 }}>✓</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
