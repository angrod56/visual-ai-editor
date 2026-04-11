'use client';

import { useCallback, useRef, useState } from 'react';
import {
  CarouselSlide, CarouselTheme, CAROUSEL_THEMES,
  SlideCanvas, SlideCanvasHandle,
} from '@/components/carousels/SlideCanvas';
import {
  Layout, Loader2, Sparkles, Download,
  ChevronLeft, ChevronRight, ArrowLeft, Pencil,
  ImagePlus, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PLATFORMS = ['Instagram', 'LinkedIn', 'Facebook', 'Twitter/X'];
const TONES = ['Educativo', 'Inspirador', 'Tips prácticos', 'Historia', 'Ventas'];
const SLIDE_COUNTS = [5, 7, 9, 10];

const FIELD = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors';

export default function CarouselsPage() {
  // — form state
  const [topic, setTopic]       = useState('');
  const [niche, setNiche]       = useState('');
  const [audience, setAudience] = useState('');
  const [platform, setPlatform] = useState('Instagram');
  const [tone, setTone]         = useState('Educativo');
  const [slideCount, setSlideCount] = useState(7);

  const [ctaText, setCtaText]         = useState('');

  // — shared
  const [themeKey, setThemeKey]       = useState('dark');
  const [generating, setGenerating]   = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [slides, setSlides]           = useState<CarouselSlide[]>([]);
  const [carouselTitle, setCarouselTitle] = useState('');
  const [activeIdx, setActiveIdx]     = useState(0);
  const [mode, setMode]               = useState<'form' | 'editor'>('form');
  const [bgImageDataUrl, setBgImageDataUrl] = useState<string | null>(null);
  const [bgPreview, setBgPreview]     = useState<string | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const thumbRefs = useRef<(SlideCanvasHandle | null)[]>([]);
  const theme: CarouselTheme = CAROUSEL_THEMES[themeKey];

  // ── Background photo ────────────────────────────────────────────────────
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
      setBgImageDataUrl(dataUrl);
      setBgPreview(dataUrl);
    } catch { toast.error('Error al cargar la imagen'); }
  }, []);

  // ── Generate ────────────────────────────────────────────────────────────
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
      setMode('editor');
      toast.success(`${generated.length} diapositivas generadas`);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setGenerating(false);
    }
  };

  // ── Edit ─────────────────────────────────────────────────────────────────
  const updateSlide = (idx: number, patch: Partial<CarouselSlide>) => {
    setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  // ── Download ─────────────────────────────────────────────────────────────
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

  const activeSlide = slides[activeIdx];

  // ── Render ───────────────────────────────────────────────────────────────
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
          <button
            onClick={() => setMode('form')}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors shrink-0 mt-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Nuevo carrusel
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">

        {/* ══════════════════════════════════════════════════════════
            LEFT panel — form OR editor
        ══════════════════════════════════════════════════════════ */}

        {mode === 'form' ? (
          /* ── Generation form ── */
          <div className="space-y-5">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Tema del carrusel *</label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generate()}
                placeholder="ej: 7 errores al invertir, cómo construir hábitos…"
                className={FIELD}
              />
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

            {/* CTA text */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Texto del botón CTA (última diapositiva)</label>
              <input
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="ej: Escríbeme al DM, Visita el link en bio, Compra ahora…"
                className={FIELD}
              />
            </div>

            {/* Background photo */}
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block flex items-center gap-1.5">
                <ImagePlus className="w-3 h-3" />
                Foto de fondo
                <span className="text-zinc-600 font-normal">(opcional)</span>
              </label>
              {bgPreview ? (
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <img src={bgPreview} alt="Fondo" className="w-16 h-16 object-cover rounded-xl border border-zinc-600" />
                    <button
                      onClick={() => { setBgImageDataUrl(null); setBgPreview(null); }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-800 border border-zinc-600 rounded-full flex items-center justify-center hover:bg-red-900/40 hover:border-red-600 transition-colors"
                    >
                      <X className="w-3 h-3 text-zinc-400" />
                    </button>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-300 font-medium">Foto cargada</p>
                    <p className="text-xs text-zinc-500">Se aplicará como fondo en todas las diapositivas</p>
                    <button onClick={() => bgInputRef.current?.click()} className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2 mt-0.5">
                      Cambiar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => bgInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
                  onDragLeave={() => setDraggingOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDraggingOver(false); const f = e.dataTransfer.files[0]; if (f) handleBgFile(f); }}
                  className={cn(
                    'w-full border-2 border-dashed rounded-xl px-4 py-3 flex items-center gap-3 text-left transition-all',
                    draggingOver ? 'border-amber-500/60 bg-amber-500/10' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/50'
                  )}
                >
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
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBgFile(f); e.target.value = ''; }} />
            </div>

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
          <div className="space-y-5">
            {/* Slide navigator list */}
            <div className="space-y-1">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Diapositivas</p>
              <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                {slides.map((slide, i) => (
                  <button
                    key={slide.id}
                    onClick={() => setActiveIdx(i)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
                      activeIdx === i
                        ? 'bg-amber-500/10 border-amber-500/30 text-white'
                        : 'bg-zinc-800/50 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    )}
                  >
                    <span className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0',
                      activeIdx === i ? 'bg-amber-500 text-black' : 'bg-zinc-700 text-zinc-400'
                    )}>
                      {i + 1}
                    </span>
                    <span className="text-xs truncate flex-1">{slide.headline}</span>
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-md border shrink-0',
                      slide.type === 'cover' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                        : slide.type === 'cta' ? 'text-green-400 border-green-500/30 bg-green-500/10'
                        : 'text-zinc-500 border-zinc-700 bg-zinc-800'
                    )}>
                      {slide.type === 'cover' ? 'portada' : slide.type === 'cta' ? 'cta' : `#${slide.number}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Active slide fields */}
            {activeSlide && (
              <div className="space-y-3 border-t border-zinc-800 pt-4">
                <div className="flex items-center gap-2">
                  <Pencil className="w-3.5 h-3.5 text-amber-400" />
                  <p className="text-xs font-semibold text-white">
                    Editando diapositiva {activeIdx + 1}
                    <span className="ml-1.5 text-zinc-500 font-normal">— cambios en tiempo real</span>
                  </p>
                </div>

                {/* Emoji */}
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Emoji</label>
                  <input
                    value={activeSlide.emoji ?? ''}
                    onChange={(e) => updateSlide(activeIdx, { emoji: e.target.value })}
                    placeholder="🎯"
                    className="w-20 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors text-center"
                  />
                </div>

                {/* Headline */}
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Titular</label>
                  <input
                    value={activeSlide.headline}
                    onChange={(e) => updateSlide(activeIdx, { headline: e.target.value })}
                    placeholder="Titular impactante…"
                    className={FIELD}
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">
                    {activeSlide.type === 'cta' ? 'Texto del botón' : 'Cuerpo'}
                  </label>
                  <textarea
                    value={activeSlide.body ?? ''}
                    onChange={(e) => updateSlide(activeIdx, { body: e.target.value })}
                    placeholder={activeSlide.type === 'cta' ? 'Escríbeme al DM' : 'Amplía el titular con un dato o beneficio concreto…'}
                    rows={3}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                  />
                </div>

                {/* Highlight */}
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Palabra clave a resaltar</label>
                  <input
                    value={activeSlide.highlight ?? ''}
                    onChange={(e) => updateSlide(activeIdx, { highlight: e.target.value })}
                    placeholder="ej: gratis, ahora, clave"
                    className={FIELD}
                  />
                </div>
              </div>
            )}

            {/* Theme selector always accessible */}
            <div className="border-t border-zinc-800 pt-4">
              <ThemeSelector themeKey={themeKey} onChange={setThemeKey} />
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            RIGHT panel — preview (always visible when slides exist)
        ══════════════════════════════════════════════════════════ */}
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
              {/* Title + download all */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{carouselTitle}</p>
                  <p className="text-xs text-zinc-500">{slides.length} diapositivas · 1080×1080 px</p>
                </div>
                <Button size="sm" onClick={downloadAll} disabled={downloading}
                  className="bg-green-600 hover:bg-green-700 text-white gap-1.5 shrink-0">
                  {downloading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Download className="w-3.5 h-3.5" />}
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
                    backgroundImage={bgImageDataUrl ?? undefined}
                  />
                </div>

                <button onClick={next} disabled={activeIdx === slides.length - 1}
                  className="absolute right-0 z-10 w-9 h-9 rounded-full bg-zinc-800/90 border border-zinc-700 flex items-center justify-center disabled:opacity-25 hover:bg-zinc-700 transition-colors translate-x-4">
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Download current */}
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
                      backgroundImage={bgImageDataUrl ?? undefined}
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

// ── Theme selector (shared between form and editor modes) ──────────────────
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
