'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CarouselSlide, CarouselTheme, CAROUSEL_THEMES,
  SlideCanvas, SlideCanvasHandle,
} from '@/components/carousels/SlideCanvas';
import { ContentStrategy, StrategyItem } from '@/components/carousels/ContentStrategy';
import {
  Layout, Loader2, Sparkles, Download,
  ChevronLeft, ChevronRight, ArrowLeft,
  ImagePlus, X, ChevronDown, Image as ImageIcon,
  Save, Trash2, Map, FolderOpen, Clock, Film, Type,
  GraduationCap, Megaphone, BookOpen, BarChart2,
  TableProperties, Copy, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import JSZip from 'jszip';

const PLATFORMS = ['Instagram', 'LinkedIn', 'Facebook', 'Twitter/X'];
const SLIDE_COUNTS = [5, 7, 9, 10, 12];

const CAROUSEL_TYPES = [
  { key: 'educativo',    label: 'Educativo',     icon: GraduationCap, desc: 'Tips / Pasos / Tutorial' },
  { key: 'promocional',  label: 'Promocional',   icon: Megaphone,     desc: 'Lanzamiento / Oferta' },
  { key: 'storytelling', label: 'Storytelling',  icon: BookOpen,      desc: 'Narrativo / Historia' },
  { key: 'caso_estudio', label: 'Caso de Éxito', icon: BarChart2,     desc: 'Resultados / Prueba Social' },
] as const;
type CarouselTypeKey = typeof CAROUSEL_TYPES[number]['key'];

const BRANDS = [
  { key: 'mentoriasangel', label: '@mentoriasangel', color: 'text-orange-400' },
  { key: 'generico',       label: 'Genérico',        color: 'text-zinc-400' },
] as const;
type BrandKey = typeof BRANDS[number]['key'];

const FIELD = 'w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors';

export default function CarouselsPage() {
  // — page tabs
  const [pageMode, setPageMode] = useState<'carousel' | 'strategy'>('carousel');

  // — form
  const [topic, setTopic]           = useState('');
  const [niche, setNiche]           = useState('');
  const [audience, setAudience]     = useState('');
  const [platform, setPlatform]     = useState('Instagram');
  const [carouselType, setCarouselType] = useState<CarouselTypeKey>('educativo');
  const [brand, setBrand]           = useState<BrandKey>('mentoriasangel');
  const [slideCount, setSlideCount] = useState(7);
  const [ctaText, setCtaText]       = useState('');
  const [ctaComplement, setCtaComplement] = useState('');

  // — copy review step
  type CopySlide = { id: number; type: string; number?: string; headline: string; body: string; emoji: string; highlight?: string; copy_reason?: string; canva_note?: string };
  type CopyDraft = { title: string; subtitle?: string; carousel_type: string; brand: string; coherence: { score: number; notes: string }; slides: CopySlide[] };
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [copyDraft, setCopyDraft]           = useState<CopyDraft | null>(null);
  const [copyPayload, setCopyPayload]       = useState<Record<string, unknown> | null>(null); // saved to reuse on regenerate

  // — canva guide
  const [canvaGuide, setCanvaGuide]     = useState<Array<{ id: number; type: string; headline: string; body: string; emoji: string; canva_note?: string }>>([]);
  const [showCanvaGuide, setShowCanvaGuide] = useState(false);
  const [copiedGuide, setCopiedGuide]   = useState(false);

  // — source mode (manual topic vs from uploaded video)
  type VideoProject = { id: string; title: string; status: string; transcription_segments?: Array<{ start: number; end: number; text: string }> };
  const [sourceMode, setSourceMode]           = useState<'manual' | 'video'>('manual');
  const [videoProjects, setVideoProjects]     = useState<VideoProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProject, setSelectedProject] = useState<VideoProject | null>(null);

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

  // — history
  type CarouselRecord = { id: string; title: string; topic: string; theme_key: string; slide_count: number; created_at: string };
  const [history, setHistory]     = useState<CarouselRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saving, setSaving]       = useState(false);
  const [savedId, setSavedId]     = useState<string | null>(null); // current carousel's DB id

  const thumbRefs = useRef<(SlideCanvasHandle | null)[]>([]);
  const theme: CarouselTheme = CAROUSEL_THEMES[themeKey];

  // ── History ───────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/carousels');
      if (res.ok) setHistory(await res.json());
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setVideoProjects(data.filter((p: VideoProject) => p.status === 'ready'));
      }
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  const handleSourceMode = (mode: 'manual' | 'video') => {
    setSourceMode(mode);
    if (mode === 'video' && videoProjects.length === 0) fetchProjects();
  };

  const saveCarousel = async () => {
    if (!slides.length) return;
    setSaving(true);
    try {
      const res = await fetch('/api/carousels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: carouselTitle, topic, slides, theme_key: themeKey }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Error al guardar'); return; }
      setSavedId(data.id);
      toast.success('Carrusel guardado');
      fetchHistory();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const loadCarousel = async (id: string) => {
    try {
      const res = await fetch(`/api/carousels/${id}`);
      const data = await res.json();
      if (!res.ok) { toast.error('Error al cargar'); return; }
      setSlides(data.slides ?? []);
      setCarouselTitle(data.title ?? '');
      setTopic(data.topic ?? '');
      setThemeKey(data.theme_key ?? 'dark');
      thumbRefs.current = new Array((data.slides ?? []).length).fill(null);
      setActiveIdx(0);
      setBgSlides(new Set());
      setOpenSlides(new Set([0, (data.slides?.length ?? 1) - 1]));
      setSavedId(data.id);
      setMode('editor');
      toast.success('Carrusel cargado');
    } catch {
      toast.error('Error de conexión');
    }
  };

  const deleteCarousel = async (id: string) => {
    try {
      await fetch(`/api/carousels/${id}`, { method: 'DELETE' });
      setHistory((prev) => prev.filter((c) => c.id !== id));
      if (savedId === id) setSavedId(null);
      toast.success('Carrusel eliminado');
    } catch {
      toast.error('Error al eliminar');
    }
  };

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

  // ── Build shared payload ───────────────────────────────────────────────
  const buildPayload = (): Record<string, unknown> | null => {
    if (sourceMode === 'manual' && !topic.trim()) { toast.error('Escribe el tema del carrusel'); return null; }
    if (sourceMode === 'video' && !selectedProject) { toast.error('Selecciona un video'); return null; }

    const base: Record<string, unknown> = { niche, audience, platform, slideCount, carouselType, brand, ctaText: ctaText.trim() || undefined, ctaComplement: ctaComplement.trim() || undefined };

    if (sourceMode === 'video' && selectedProject) {
      const segs = selectedProject.transcription_segments ?? [];
      const transcription = segs.map((s) => s.text).join(' ').trim();
      if (!transcription) { toast.error('Este video no tiene transcripción'); return null; }
      return { ...base, topic: topic.trim() || selectedProject.title, transcription };
    }
    return { ...base, topic };
  };

  // ── Step 1: Generate copy for review ──────────────────────────────────
  const generateCopy = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setCopyPayload(payload);
    setGeneratingCopy(true);
    setCopyDraft(null);
    try {
      const res = await fetch('/api/carousels/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Error al generar el copy'); return; }
      setCopyDraft(data as CopyDraft);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setGeneratingCopy(false);
    }
  };

  // ── Step 1b: Regenerate copy ───────────────────────────────────────────
  const regenerateCopy = async () => {
    if (!copyPayload) return;
    setGeneratingCopy(true);
    setCopyDraft(null);
    try {
      const res = await fetch('/api/carousels/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(copyPayload),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Error al regenerar'); return; }
      setCopyDraft(data as CopyDraft);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setGeneratingCopy(false);
    }
  };

  // ── Step 2: Accept copy → generate visual slides ───────────────────────
  const acceptCopy = async () => {
    if (!copyDraft) return;
    setGenerating(true);
    setSlides([]);
    setCanvaGuide([]);
    setShowCanvaGuide(false);
    try {
      // Pass the approved copy directly to the generate endpoint
      const res = await fetch('/api/carousels/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(copyPayload ?? {}), approvedCopy: copyDraft.slides }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Error al crear el diseño'); return; }
      const generated: CarouselSlide[] = data.slides ?? [];
      thumbRefs.current = new Array(generated.length).fill(null);
      setSlides(generated);
      setCanvaGuide(data.slides ?? []);
      setCarouselTitle(data.title ?? copyDraft.title);
      setActiveIdx(0);
      setBgSlides(new Set());
      setOpenSlides(new Set([0, generated.length - 1]));
      setSavedId(null);
      setCopyDraft(null);
      setMode('editor');
      toast.success(`${generated.length} diapositivas creadas`);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setGenerating(false);
    }
  };

  // ── Generate (direct, used by strategy flow) ──────────────────────────
  const generate = async (overridePayload?: Record<string, unknown>) => {
    const payload = overridePayload ?? buildPayload();
    if (!payload) return;

    setGenerating(true);
    setSlides([]);
    setCanvaGuide([]);
    setShowCanvaGuide(false);
    try {
      const res = await fetch('/api/carousels/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Error al generar'); return; }
      const generated: CarouselSlide[] = data.slides ?? [];
      thumbRefs.current = new Array(generated.length).fill(null);
      setSlides(generated);
      setCanvaGuide(data.slides ?? []);
      setCarouselTitle(data.title ?? (topic || selectedProject?.title || ''));
      setActiveIdx(0);
      setBgSlides(new Set());
      setOpenSlides(new Set([0, generated.length - 1]));
      setSavedId(null);
      setMode('editor');
      toast.success(`${generated.length} diapositivas generadas`);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setGenerating(false);
    }
  };

  // ── From strategy → pre-fill form and generate ─────────────────────
  const handleStrategySelect = async (item: StrategyItem) => {
    setPageMode('carousel');
    setMode('form');
    setTopic(item.topic);
    setCarouselType('promocional');
    setCtaText(item.cta_idea);
    await new Promise((r) => setTimeout(r, 80));
    await generate({
      topic: item.topic,
      niche,
      audience,
      platform,
      slideCount,
      carouselType: 'promocional',
      brand,
      ctaText: item.cta_idea,
      ctaComplement: ctaComplement.trim() || undefined,
    });
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
    const toastId = toast.loading(`Preparando ZIP (0/${slides.length})…`);
    try {
      const zip = new JSZip();
      const folder = zip.folder(topic.slice(0, 40).replace(/\s+/g, '-') || 'carousel')!;
      for (let i = 0; i < slides.length; i++) {
        toast.loading(`Preparando ZIP (${i + 1}/${slides.length})…`, { id: toastId });
        const handle = thumbRefs.current[i];
        if (!handle) continue;
        const blob = await new Promise<Blob | null>((res) => handle.toBlob(res));
        if (blob) {
          const name = `slide-${String(i + 1).padStart(2, '0')}.jpg`;
          folder.file(name, blob);
        }
      }
      toast.loading('Generando ZIP…', { id: toastId });
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = `${topic.slice(0, 40).replace(/\s+/g, '-') || 'carousel'}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
      toast.success(`ZIP con ${slides.length} diapositivas descargado`, { id: toastId });
    } catch {
      toast.error('Error al generar el ZIP', { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  const prev = () => setActiveIdx((i) => Math.max(0, i - 1));
  const next = () => setActiveIdx((i) => Math.min(slides.length - 1, i + 1));

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
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
        {pageMode === 'carousel' && mode === 'editor' && (
          <div className="flex items-center gap-2 shrink-0 mt-1">
            {canvaGuide.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setShowCanvaGuide(true)}
                className="gap-1.5 text-xs h-8 text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500">
                <TableProperties className="w-3.5 h-3.5" />
                Guión Canva
              </Button>
            )}
            <Button size="sm" onClick={saveCarousel} disabled={saving || !slides.length}
              className={cn(
                'gap-1.5 text-xs h-8',
                savedId ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200' : 'bg-amber-500 hover:bg-amber-600 text-black font-semibold'
              )}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {savedId ? 'Guardado' : 'Guardar'}
            </Button>
            <button onClick={() => setMode('form')}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              Nuevo
            </button>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl w-fit">
        <button
          onClick={() => setPageMode('carousel')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            pageMode === 'carousel'
              ? 'bg-amber-500 text-black'
              : 'text-zinc-400 hover:text-white'
          )}
        >
          <Layout className="w-4 h-4" />
          Carrusel
        </button>
        <button
          onClick={() => setPageMode('strategy')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            pageMode === 'strategy'
              ? 'bg-amber-500 text-black'
              : 'text-zinc-400 hover:text-white'
          )}
        >
          <Map className="w-4 h-4" />
          Estrategia (10 carruseles)
        </button>
      </div>

      {/* ── Strategy tab ── */}
      {pageMode === 'strategy' && (
        <div className="max-w-3xl">
          <ContentStrategy
            defaultNiche={niche}
            defaultAudience={audience}
            defaultCta={ctaText}
            onSelectTopic={handleStrategySelect}
          />
        </div>
      )}

      {/* ── Carousel tab ── */}
      {pageMode === 'carousel' && (
      <div className="space-y-8">
      {generating && mode === 'form' && (
        <div className="flex items-center gap-3 text-zinc-400 py-4">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span className="text-sm">Generando carrusel desde estrategia...</span>
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">

        {/* ══════════ LEFT ══════════ */}
        {mode === 'form' ? (

          /* ── Generation form ── */
          <div className="space-y-5">

            {/* ── Source toggle ── */}
            <div>
              <label className="text-xs text-zinc-400 mb-2 block">Fuente del contenido</label>
              <div className="flex gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
                <button
                  onClick={() => handleSourceMode('manual')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all',
                    sourceMode === 'manual' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
                  )}
                >
                  <Type className="w-3.5 h-3.5" />
                  Tema manual
                </button>
                <button
                  onClick={() => handleSourceMode('video')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all',
                    sourceMode === 'video' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
                  )}
                >
                  <Film className="w-3.5 h-3.5" />
                  Desde video
                </button>
              </div>
            </div>

            {/* ── Video picker (only when sourceMode === 'video') ── */}
            {sourceMode === 'video' && (
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Selecciona un video transcrito</label>
                {loadingProjects ? (
                  <div className="flex items-center gap-2 py-3 text-zinc-500 text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Cargando videos...
                  </div>
                ) : videoProjects.length === 0 ? (
                  <p className="text-xs text-zinc-600 py-2">No hay videos con transcripción disponibles. Sube y procesa un video primero.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                    {videoProjects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProject(p)}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors flex items-center gap-2',
                          selectedProject?.id === p.id
                            ? 'bg-amber-500/15 border-amber-500/40 text-white'
                            : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                        )}
                      >
                        <Film className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
                        <span className="truncate">{p.title}</span>
                        {selectedProject?.id === p.id && (
                          <span className="ml-auto text-amber-400 text-xs shrink-0">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {selectedProject && (
                  <div className="mt-2">
                    <label className="text-xs text-zinc-400 mb-1 block">Enfoque del carrusel (opcional)</label>
                    <input value={topic} onChange={(e) => setTopic(e.target.value)}
                      placeholder="ej: enfocarse en los consejos de productividad del video"
                      className={FIELD} />
                  </div>
                )}
              </div>
            )}

            {/* ── Topic input (only when sourceMode === 'manual') ── */}
            {sourceMode === 'manual' && (
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Tema del carrusel *</label>
              <input value={topic} onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generate()}
                placeholder="ej: 7 errores al invertir, cómo construir hábitos…"
                className={FIELD} />
            </div>
            )}

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

            {/* ── Tipo de carrusel ── */}
            <div>
              <label className="text-xs text-zinc-400 mb-2 block">Tipo de carrusel</label>
              <div className="grid grid-cols-2 gap-1.5">
                {CAROUSEL_TYPES.map(({ key, label, icon: Icon, desc }) => (
                  <button
                    key={key}
                    onClick={() => setCarouselType(key)}
                    className={cn(
                      'flex items-start gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors',
                      carouselType === key
                        ? 'bg-amber-500/15 border-amber-500/50 text-white'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    <Icon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', carouselType === key ? 'text-amber-400' : '')} />
                    <div>
                      <p className="text-xs font-semibold leading-tight">{label}</p>
                      <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Marca + Plataforma ── */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Marca</label>
                <div className="flex flex-col gap-1">
                  {BRANDS.map(({ key, label, color }) => (
                    <button key={key} onClick={() => setBrand(key)}
                      className={cn('px-2.5 py-1.5 text-xs rounded-lg border text-left transition-colors',
                        brand === key ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : `bg-zinc-800 ${color} border-zinc-700 hover:border-zinc-500`)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
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
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-2 block">Número de diapositivas</label>
              <div className="flex gap-2">
                {SLIDE_COUNTS.map((n) => (
                  <button key={n} onClick={() => setSlideCount(n)}
                    className={cn('w-12 py-2 text-sm font-semibold rounded-xl border transition-colors',
                      slideCount === n ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300')}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Acción del CTA</label>
              <input value={ctaText} onChange={(e) => setCtaText(e.target.value)}
                placeholder="ej: Escríbeme al DM · Visita el link en bio · Compra ahora"
                className={FIELD} />
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Frase complementaria del CTA</label>
              <input value={ctaComplement} onChange={(e) => setCtaComplement(e.target.value)}
                placeholder="ej: Si quieres duplicar tus ventas en 60 días sin invertir más en ads"
                className={FIELD} />
            </div>

            <BgUpload bgPreview={bgPreview} dragging={dragging} bgInputRef={bgInputRef}
              onClear={clearBg} onDragging={setDragging} onFile={handleBgFile} />

            <ThemeSelector themeKey={themeKey} onChange={setThemeKey} />

            <Button
              onClick={generateCopy}
              disabled={generatingCopy || generating || (sourceMode === 'manual' ? !topic.trim() : !selectedProject)}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-black font-semibold gap-2 h-11"
            >
              {generatingCopy
                ? <><Loader2 className="w-5 h-5 animate-spin" />Generando contenido…</>
                : <><Sparkles className="w-5 h-5" />Generar contenido con IA</>}
            </Button>
          </div>

        ) : (

          /* ── Slide editor ── */
          <div className="space-y-4">

            {/* ── CTA quick-edit (always visible) ── */}
            {slides.length > 0 && (() => {
              const ctaSlide = slides[slides.length - 1];
              const ctaIdx   = slides.length - 1;
              return (
                <div className="rounded-xl border border-green-500/40 bg-green-950/40 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-green-300 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-green-500/30 flex items-center justify-center text-[10px]">✦</span>
                      CTA — Última diapositiva
                    </p>
                    <button onClick={() => { setActiveIdx(ctaIdx); toggleOpen(ctaIdx); }}
                      className="text-[10px] text-green-600 hover:text-green-400 transition-colors">
                      ver en preview →
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <div className="shrink-0">
                      <label className="text-[10px] text-zinc-500 mb-1 block">Emoji</label>
                      <input value={ctaSlide.emoji ?? ''} onChange={(e) => updateSlide(ctaIdx, { emoji: e.target.value })}
                        placeholder="🚀"
                        className="w-14 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-green-500 transition-colors" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-zinc-500 mb-1 block">Titular del CTA</label>
                      <input value={ctaSlide.headline} onChange={(e) => updateSlide(ctaIdx, { headline: e.target.value })}
                        placeholder="ej: ¿Listo para empezar?"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-green-500 transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 mb-1 block">Texto del botón de acción</label>
                    <input value={ctaSlide.body ?? ''} onChange={(e) => updateSlide(ctaIdx, { body: e.target.value })}
                      placeholder="ej: Escríbeme al DM · Visita el link en bio · Compra ahora"
                      className="w-full bg-zinc-900 border border-green-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-green-500 transition-colors font-medium" />
                  </div>
                </div>
              );
            })()}

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
                  const isCTA = slide.type === 'cta';
                  return (
                    <div key={slide.id}
                      className={cn(
                        'rounded-xl border overflow-hidden transition-colors',
                        isCTA ? 'border-green-500/40 ring-1 ring-green-500/10'
                          : isActive ? 'border-amber-500/40' : 'border-zinc-800'
                      )}>

                      {/* Row header */}
                      <div className={cn(
                        'flex items-center gap-2 px-3 py-2.5',
                        isCTA ? 'bg-green-950/60' : 'bg-zinc-900'
                      )}>
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
                  {downloading ? 'Generando ZIP…' : 'Descargar ZIP'}
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

      {/* ── Copy review panel ─────────────────────────────────── */}
      {mode === 'form' && (generatingCopy || copyDraft) && !generating && (
        <CopyReview
          draft={copyDraft}
          loading={generatingCopy}
          onAccept={acceptCopy}
          onRegenerate={regenerateCopy}
          accepting={generating}
        />
      )}

      {/* ── History ─────────────────────────────────────────────── */}
      <div className="space-y-4 border-t border-zinc-800 pt-8">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-white">Mis carruseles guardados</h2>
          {history.length > 0 && (
            <span className="text-xs text-zinc-600">({history.length})</span>
          )}
        </div>

        {loadingHistory ? (
          <div className="flex items-center gap-2 text-zinc-600 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Cargando historial…</span>
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-zinc-600 py-4">
            Aún no tienes carruseles guardados. Genera uno y pulsa <strong className="text-zinc-400">Guardar</strong>.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {history.map((c) => {
              const t = CAROUSEL_THEMES[c.theme_key] ?? CAROUSEL_THEMES.dark;
              const isActive = savedId === c.id;
              return (
                <div key={c.id}
                  className={cn(
                    'rounded-xl border overflow-hidden transition-colors',
                    isActive ? 'border-amber-500/40 ring-1 ring-amber-500/10' : 'border-zinc-800 hover:border-zinc-700'
                  )}>
                  {/* Color strip */}
                  <div className="h-2 w-full" style={{
                    background: t.isGradient && t.bg2
                      ? `linear-gradient(90deg, ${t.bg}, ${t.bg2})`
                      : t.bg,
                  }} />
                  <div className="p-3 bg-zinc-900 space-y-2">
                    <p className="text-sm font-medium text-white leading-snug line-clamp-2">{c.title}</p>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span>{c.slide_count} slides</span>
                      <span>·</span>
                      <span>{new Date(c.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <div className="flex gap-1.5 pt-1">
                      <button onClick={() => loadCarousel(c.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition-colors">
                        <FolderOpen className="w-3 h-3" />
                        Abrir
                      </button>
                      <button onClick={() => deleteCarousel(c.id)}
                        className="w-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-red-900/40 hover:text-red-400 text-zinc-500 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
      )}

      {/* ── Canva Guide Modal ── */}
      {showCanvaGuide && canvaGuide.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowCanvaGuide(false)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[80vh] bg-zinc-900 rounded-2xl border border-zinc-700 overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <TableProperties className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-white text-sm">Guión para diseñador (Canva)</span>
                <span className="text-xs text-zinc-500">{canvaGuide.length} slides</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    const header = '| # | Tipo | Titular | Cuerpo | Emoji | Nota para diseñador |\n|---|------|---------|--------|-------|---------------------|\n';
                    const rows = canvaGuide.map((s, i) =>
                      `| ${i + 1} | ${s.type} | ${s.headline} | ${s.body} | ${s.emoji} | ${s.canva_note ?? '—'} |`
                    ).join('\n');
                    await navigator.clipboard.writeText(header + rows);
                    setCopiedGuide(true);
                    toast.success('Guión copiado al portapapeles');
                    setTimeout(() => setCopiedGuide(false), 2000);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition-colors"
                >
                  {copiedGuide ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedGuide ? 'Copiado' : 'Copiar tabla'}
                </button>
                <button onClick={() => setShowCanvaGuide(false)} className="text-zinc-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-zinc-800">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1 p-4">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-zinc-400 border-b border-zinc-800">
                    <th className="text-left py-2 pr-3 font-medium w-8">#</th>
                    <th className="text-left py-2 pr-3 font-medium w-20">Tipo</th>
                    <th className="text-left py-2 pr-3 font-medium">Titular</th>
                    <th className="text-left py-2 pr-3 font-medium">Cuerpo</th>
                    <th className="text-left py-2 pr-3 font-medium w-8">Em.</th>
                    <th className="text-left py-2 font-medium">Nota diseñador</th>
                  </tr>
                </thead>
                <tbody>
                  {canvaGuide.map((s, i) => (
                    <tr key={i} className={cn('border-b border-zinc-800/50 align-top', i % 2 === 0 ? 'bg-zinc-800/20' : '')}>
                      <td className="py-2.5 pr-3 text-zinc-500 font-mono">{i + 1}</td>
                      <td className="py-2.5 pr-3">
                        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', {
                          'bg-amber-500/20 text-amber-300': s.type === 'cover',
                          'bg-blue-500/20 text-blue-300': s.type === 'content',
                          'bg-green-500/20 text-green-300': s.type === 'cta',
                        })}>
                          {s.type}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-white font-medium leading-snug max-w-[180px]">{s.headline}</td>
                      <td className="py-2.5 pr-3 text-zinc-400 leading-snug max-w-[180px]">{s.body}</td>
                      <td className="py-2.5 pr-3 text-lg">{s.emoji}</td>
                      <td className="py-2.5 text-zinc-500 leading-snug italic">{s.canva_note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
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

// ── CopyReview component ───────────────────────────────────────────────────

type CopySlide = { id: number; type: string; number?: string; headline: string; body: string; emoji: string; highlight?: string; copy_reason?: string; canva_note?: string };
type CopyDraft = { title: string; subtitle?: string; coherence: { score: number; notes: string }; slides: CopySlide[] };

function CopyReview({
  draft,
  loading,
  onAccept,
  onRegenerate,
  accepting,
}: {
  draft: CopyDraft | null;
  loading: boolean;
  onAccept: () => void;
  onRegenerate: () => void;
  accepting: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-white">El agente de copywriting está trabajando…</p>
          <p className="text-xs text-zinc-500">Analizando el tema, construyendo el arco narrativo y redactando el copy para cada slide</p>
        </div>
      </div>
    );
  }

  if (!draft) return null;

  const scoreColor = draft.coherence.score >= 8 ? 'text-green-400' : draft.coherence.score >= 6 ? 'text-amber-400' : 'text-red-400';
  const scoreBg    = draft.coherence.score >= 8 ? 'bg-green-500/10 border-green-500/30' : draft.coherence.score >= 6 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-red-500/10 border-red-500/30';

  return (
    <div className="space-y-5 rounded-2xl border border-zinc-700 bg-zinc-900/40 p-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <p className="text-sm font-bold text-white">Revisión de copy</p>
            <span className="text-xs text-zinc-500">{draft.slides.length} slides</span>
          </div>
          <p className="text-xs text-zinc-400 font-semibold">{draft.title}</p>
          {draft.subtitle && <p className="text-xs text-zinc-600 italic">{draft.subtitle}</p>}
        </div>

        {/* Coherence score */}
        <div className={cn('shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border', scoreBg)}>
          <div className="text-center">
            <p className={cn('text-xl font-black leading-none', scoreColor)}>{draft.coherence.score}<span className="text-xs font-normal text-zinc-500">/10</span></p>
            <p className="text-[10px] text-zinc-500 mt-0.5">coherencia</p>
          </div>
        </div>
      </div>

      {/* Coherence notes */}
      <div className={cn('p-3 rounded-xl border text-xs leading-relaxed', scoreBg, scoreColor === 'text-green-400' ? 'text-green-300' : scoreColor === 'text-amber-400' ? 'text-amber-300' : 'text-red-300')}>
        {draft.coherence.notes}
      </div>

      {/* Slides */}
      <div className="space-y-3">
        {draft.slides.map((s, i) => (
          <div
            key={i}
            className={cn('rounded-xl border p-4 space-y-2', {
              'bg-amber-500/5 border-amber-500/20': s.type === 'cover',
              'bg-zinc-800/40 border-zinc-700/60': s.type === 'content',
              'bg-green-500/5 border-green-500/20': s.type === 'cta',
            })}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg leading-none">{s.emoji}</span>
              <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide', {
                'bg-amber-500/20 text-amber-300': s.type === 'cover',
                'bg-zinc-700 text-zinc-300': s.type === 'content',
                'bg-green-500/20 text-green-300': s.type === 'cta',
              })}>
                {s.type === 'cover' ? 'Portada' : s.type === 'cta' ? 'CTA' : `Slide ${s.number ?? i}`}
              </span>
              {s.highlight && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700">
                  highlight: {s.highlight}
                </span>
              )}
            </div>

            <div>
              <p className="text-sm font-bold text-white leading-snug">{s.headline}</p>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{s.body}</p>
            </div>

            {s.copy_reason && (
              <div className="flex items-start gap-2 pt-1 border-t border-zinc-700/40">
                <span className="text-[10px] text-amber-400 font-semibold shrink-0 mt-0.5">¿Por qué funciona?</span>
                <p className="text-[11px] text-zinc-500 leading-relaxed italic">{s.copy_reason}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <Button
          onClick={onRegenerate}
          disabled={loading || accepting}
          variant="ghost"
          className="flex-1 border border-zinc-700 hover:border-zinc-500 text-zinc-300 gap-2 h-11"
        >
          <Loader2 className={cn('w-4 h-4', loading ? 'animate-spin' : 'hidden')} />
          Regenerar contenido
        </Button>
        <Button
          onClick={onAccept}
          disabled={accepting || loading}
          className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold gap-2 h-11"
        >
          {accepting
            ? <><Loader2 className="w-4 h-4 animate-spin" />Creando diseño…</>
            : <><Sparkles className="w-4 h-4" />Aceptar y crear diseño</>
          }
        </Button>
      </div>
    </div>
  );
}
