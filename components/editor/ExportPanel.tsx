'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { VideoExport } from '@/types';
import { formatFileSize, formatDuration } from '@/lib/utils/video';
import { Download, FileVideo, Film, Headphones, Zap, Play, X, Loader2, Trash2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TYPE_ICONS = {
  clip: Film,
  trim: Film,
  reel: Zap,
  summary: FileVideo,
  subtitled: FileVideo,
  audio: Headphones,
  resized: FileVideo,
};

const TYPE_LABELS: Record<string, string> = {
  clip: 'Clip',
  trim: 'Recorte',
  reel: 'Reel',
  summary: 'Resumen',
  subtitled: 'Con subtítulos',
  audio: 'Audio MP3',
  resized: 'Redimensionado',
};

interface Props {
  exports: VideoExport[];
  onDeleted?: (id: string) => void;
  onPreviewOpen?: () => void;
  onPreviewClose?: () => void;
}

interface PreviewState {
  url: string;
  isAudio: boolean;
  label: string;
  fileSize?: number | null;
  duration?: number | null;
}

export function ExportPanel({ exports, onDeleted, onPreviewOpen, onPreviewClose }: Props) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [mounted, setMounted] = useState(false);
  const portalRootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    portalRootRef.current = document.body;
    setMounted(true);
  }, []);

  const fetchSignedUrl = async (exportId: string) => {
    const res = await fetch(`/api/exports/${exportId}`);
    if (!res.ok) throw new Error('No se pudo obtener el enlace');
    const { download_url } = await res.json();
    return download_url as string;
  };

  const handlePreview = async (exp: VideoExport) => {
    setLoadingPreview(exp.id);
    try {
      const url = await fetchSignedUrl(exp.id);
      // Pause any playing video in the page so it doesn't show through the modal
      document.querySelectorAll<HTMLVideoElement>('video').forEach((v) => v.pause());
      onPreviewOpen?.();
      setPreview({
        url,
        isAudio: exp.export_type === 'audio',
        label: TYPE_LABELS[exp.export_type] ?? exp.export_type,
        fileSize: exp.file_size_bytes,
        duration: exp.duration_seconds,
      });
    } catch {
      toast.error('Error al cargar la preview');
    } finally {
      setLoadingPreview(null);
    }
  };

  const handleDelete = async (exp: VideoExport) => {
    setDeleting(exp.id);
    try {
      const res = await fetch(`/api/exports/${exp.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDeleted?.(exp.id);
        toast.success('Exportación eliminada');
      } else {
        toast.error('Error al eliminar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = async (exp: VideoExport) => {
    setDownloading(exp.id);
    try {
      const url = await fetchSignedUrl(exp.id);
      window.open(url, '_blank');
      toast.success('Descarga iniciada');
    } catch {
      toast.error('Error al descargar');
    } finally {
      setDownloading(null);
    }
  };

  const handleShare = async (exp: VideoExport) => {
    setSharing(exp.id);
    try {
      const url = await fetchSignedUrl(exp.id);
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado al portapapeles', {
        description: 'Válido por 1 hora',
      });
    } catch {
      toast.error('No se pudo copiar el link');
    } finally {
      setSharing(null);
    }
  };

  if (exports.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm space-y-1">
        <FileVideo className="w-8 h-8 mx-auto text-zinc-700 mb-2" />
        <p>No hay exportaciones aún.</p>
        <p className="text-xs">Los videos editados aparecerán aquí.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 overflow-y-auto max-h-[420px] pr-1">
        {[...exports].reverse().map((exp) => {
          const Icon = TYPE_ICONS[exp.export_type] ?? FileVideo;
          const isAudio = exp.export_type === 'audio';

          return (
            <div
              key={exp.id}
              className="p-3 bg-zinc-800 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-amber-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <Badge className="text-xs border bg-zinc-700 text-zinc-300 border-zinc-600">
                    {TYPE_LABELS[exp.export_type]}
                  </Badge>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500">
                    {exp.duration_seconds != null && (
                      <span>{formatDuration(exp.duration_seconds)}</span>
                    )}
                    {exp.file_size_bytes != null && (
                      <span>{formatFileSize(exp.file_size_bytes)}</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {new Date(exp.created_at).toLocaleDateString('es', {
                      day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handlePreview(exp)}
                    disabled={loadingPreview === exp.id}
                    title={isAudio ? 'Escuchar' : 'Ver preview'}
                    className="text-zinc-400 hover:text-white hover:bg-zinc-700 px-2"
                  >
                    {loadingPreview === exp.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Play className="w-4 h-4" />
                    }
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleShare(exp)}
                    disabled={sharing === exp.id}
                    title="Compartir link"
                    className="text-zinc-400 hover:text-sky-400 hover:bg-sky-900/20 px-2"
                  >
                    {sharing === exp.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Share2 className="w-4 h-4" />
                    }
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownload(exp)}
                    disabled={downloading === exp.id}
                    title="Descargar"
                    className="text-amber-400 hover:text-amber-300 hover:bg-amber-900/20 px-2"
                  >
                    {downloading === exp.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Download className="w-4 h-4" />
                    }
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(exp)}
                    disabled={deleting === exp.id}
                    title="Eliminar"
                    className="text-zinc-600 hover:text-red-400 hover:bg-red-900/20 px-2"
                  >
                    {deleting === exp.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />
                    }
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview modal — rendered in document.body via portal to escape all stacking contexts */}
      {mounted && preview && portalRootRef.current && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center bg-black p-4"
          style={{ zIndex: 9999 }}
          onClick={() => { setPreview(null); onPreviewClose?.(); }}
        >
          <div
            className="relative w-full max-w-2xl bg-zinc-900 rounded-2xl border border-zinc-700 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{preview.label}</span>
                {preview.duration != null && (
                  <span className="text-xs text-zinc-500">{formatDuration(preview.duration)}</span>
                )}
                {preview.fileSize != null && (
                  <span className="text-xs text-zinc-600">{formatFileSize(preview.fileSize)}</span>
                )}
              </div>
              <button
                onClick={() => { setPreview(null); onPreviewClose?.(); }}
                className="text-zinc-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Player */}
            <div className={cn('bg-black', preview.isAudio ? 'p-6' : '')}>
              {preview.isAudio ? (
                <audio src={preview.url} controls autoPlay className="w-full" />
              ) : (
                <video src={preview.url} controls autoPlay className="w-full max-h-[70vh] object-contain" />
              )}
            </div>
          </div>
        </div>,
        portalRootRef.current
      )}
    </>
  );
}
