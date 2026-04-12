'use client';

import { useState } from 'react';
import { Loader2, Sparkles, Copy, Check, Tv2, Share2, Hash, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { GeneratedDescription, VideoChapter } from '@/lib/claude/description-generator';

interface Props {
  projectId: string;
  projectReady: boolean;
}

type Tab = 'descriptions' | 'chapters';
type Platform = 'youtube' | 'instagram' | 'tiktok';

const PLATFORMS: { key: Platform; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'youtube',   label: 'YouTube',   icon: <Tv2 className="w-3.5 h-3.5" />,    color: 'text-red-400' },
  { key: 'instagram', label: 'Instagram', icon: <Share2 className="w-3.5 h-3.5" />, color: 'text-pink-400' },
  { key: 'tiktok',    label: 'TikTok',    icon: <Hash className="w-3.5 h-3.5" />,   color: 'text-sky-400' },
];

export function DescriptionGenerator({ projectId, projectReady }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('descriptions');

  // Descriptions state
  const [loadingDesc, setLoadingDesc] = useState(false);
  const [result, setResult] = useState<GeneratedDescription | null>(null);
  const [activePlatform, setActivePlatform] = useState<Platform>('youtube');

  // Chapters state
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [chapters, setChapters] = useState<VideoChapter[] | null>(null);

  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Copiado al portapapeles');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleGenerateDesc = async () => {
    if (!projectReady || loadingDesc) return;
    setLoadingDesc(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/description`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Error al generar'); return; }
      setResult(data as GeneratedDescription);
      toast.success('Descripciones generadas');
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoadingDesc(false);
    }
  };

  const handleGenerateChapters = async () => {
    if (!projectReady || loadingChapters) return;
    setLoadingChapters(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/chapters`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Error al generar'); return; }
      setChapters(data.chapters as VideoChapter[]);
      toast.success('Capítulos generados');
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoadingChapters(false);
    }
  };

  const chaptersText = chapters?.map((c) => `${c.time} ${c.title}`).join('\n') ?? '';

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-400" />
          Contenido con IA
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-zinc-800/60 rounded-xl border border-zinc-700">
        <button
          onClick={() => setActiveTab('descriptions')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all',
            activeTab === 'descriptions' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          <Tv2 className="w-3.5 h-3.5" />
          Descripciones
        </button>
        <button
          onClick={() => setActiveTab('chapters')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all',
            activeTab === 'chapters' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          <ListOrdered className="w-3.5 h-3.5" />
          Capítulos YT
        </button>
      </div>

      {/* ── DESCRIPTIONS TAB ── */}
      {activeTab === 'descriptions' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              onClick={handleGenerateDesc}
              disabled={!projectReady || loadingDesc}
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white gap-1.5 text-xs"
            >
              {loadingDesc
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generando...</>
                : result
                ? <><Sparkles className="w-3.5 h-3.5" />Re-generar</>
                : <><Sparkles className="w-3.5 h-3.5" />Generar</>
              }
            </Button>
          </div>

          {loadingDesc && (
            <div className="p-4 rounded-xl border border-zinc-700 bg-zinc-800/60 text-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400 mx-auto" />
              <p className="text-xs text-zinc-400">Claude está leyendo la transcripción...</p>
            </div>
          )}

          {!loadingDesc && result && (
            <div className="space-y-3">
              {/* Suggested title */}
              <div className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Título sugerido</p>
                  <button onClick={() => copy(result.title, 'title')} className="text-zinc-500 hover:text-white transition-colors" title="Copiar">
                    {copied === 'title' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-sm font-semibold text-white leading-snug">{result.title}</p>
              </div>

              {/* Platform tabs */}
              <div className="flex gap-1 p-1 bg-zinc-800/60 rounded-xl border border-zinc-700">
                {PLATFORMS.map(({ key, label, icon, color }) => (
                  <button
                    key={key}
                    onClick={() => setActivePlatform(key)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                      activePlatform === key ? `bg-zinc-700 ${color}` : 'text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    {icon}{label}
                  </button>
                ))}
              </div>

              {PLATFORMS.map(({ key }) => activePlatform === key && (
                <div key={key} className="relative">
                  <div className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700 pr-8">
                    <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{result[key]}</p>
                  </div>
                  <button onClick={() => copy(result[key], key)} className="absolute top-2.5 right-2.5 text-zinc-500 hover:text-white transition-colors" title="Copiar">
                    {copied === key ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}

              {/* Tags */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Hashtags</p>
                  <button onClick={() => copy(result.tags.map((t) => `#${t}`).join(' '), 'tags')} className="text-zinc-500 hover:text-white transition-colors" title="Copiar todos">
                    {copied === 'tags' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.tags.map((tag) => (
                    <button key={tag} onClick={() => copy(`#${tag}`, tag)}
                      className="px-2 py-0.5 rounded-full text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors">
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!loadingDesc && !result && (
            <p className="text-xs text-zinc-600 text-center py-2">
              {projectReady ? 'Genera descripciones optimizadas para YouTube, Instagram y TikTok' : 'Disponible cuando el video termine de procesarse'}
            </p>
          )}
        </div>
      )}

      {/* ── CHAPTERS TAB ── */}
      {activeTab === 'chapters' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">Formato listo para pegar en la descripción de YouTube</p>
            <Button
              onClick={handleGenerateChapters}
              disabled={!projectReady || loadingChapters}
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white gap-1.5 text-xs"
            >
              {loadingChapters
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generando...</>
                : chapters
                ? <><Sparkles className="w-3.5 h-3.5" />Re-generar</>
                : <><Sparkles className="w-3.5 h-3.5" />Generar</>
              }
            </Button>
          </div>

          {loadingChapters && (
            <div className="p-4 rounded-xl border border-zinc-700 bg-zinc-800/60 text-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400 mx-auto" />
              <p className="text-xs text-zinc-400">Detectando cambios de tema...</p>
            </div>
          )}

          {!loadingChapters && chapters && (
            <div className="space-y-2">
              <div className="relative">
                <div className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700 pr-8 space-y-1.5">
                  {chapters.map((c, i) => (
                    <div key={i} className="flex items-baseline gap-3">
                      <span className="text-xs font-mono text-amber-400 shrink-0 w-10">{c.time}</span>
                      <span className="text-xs text-zinc-300">{c.title}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => copy(chaptersText, 'chapters')}
                  className="absolute top-2.5 right-2.5 text-zinc-500 hover:text-white transition-colors"
                  title="Copiar todo"
                >
                  {copied === 'chapters' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 text-center">
                {chapters.length} capítulos · Copia y pega en la descripción del video
              </p>
            </div>
          )}

          {!loadingChapters && !chapters && (
            <p className="text-xs text-zinc-600 text-center py-2">
              {projectReady ? 'Claude detecta los cambios de tema y genera timestamps automáticamente' : 'Disponible cuando el video termine de procesarse'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
