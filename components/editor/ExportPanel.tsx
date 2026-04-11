'use client';

import { useState } from 'react';
import { VideoExport } from '@/types';
import { formatFileSize, formatDuration } from '@/lib/utils/video';
import { Download, FileVideo, Film, Headphones, Zap, Play, X, Loader2, Trash2 } from 'lucide-react';
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
}

interface PreviewState {
  url: string;
  isAudio: boolean;
  label: string;
  fileSize?: number | null;
  duration?: number | null;
}

export function ExportPanel({ exports, onDeleted }: Props) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

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

  if (exports.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm space-y-1">
        <FileVideo className="w-8 h-8 mx-auto text-slate-700 mb-2" />
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
              className="p-3 bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-600/20 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-purple-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <Badge className="text-xs border bg-slate-700 text-slate-300 border-slate-600">
                    {TYPE_LABELS[exp.export_type]}
                  </Badge>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                    {exp.duration_seconds != null && (
                      <span>{formatDuration(exp.duration_seconds)}</span>
                    )}
                    {exp.file_size_bytes != null && (
                      <span>{formatFileSize(exp.file_size_bytes)}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
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
                    className="text-slate-400 hover:text-white hover:bg-slate-700 px-2"
                  >
                    {loadingPreview === exp.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Play className="w-4 h-4" />
                    }
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownload(exp)}
                    disabled={downloading === exp.id}
                    title="Descargar"
                    className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/20 px-2"
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
                    className="text-slate-600 hover:text-red-400 hover:bg-red-900/20 px-2"
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

      {/* Preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative w-full max-w-2xl bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{preview.label}</span>
                {preview.duration != null && (
                  <span className="text-xs text-slate-500">{formatDuration(preview.duration)}</span>
                )}
                {preview.fileSize != null && (
                  <span className="text-xs text-slate-600">{formatFileSize(preview.fileSize)}</span>
                )}
              </div>
              <button
                onClick={() => setPreview(null)}
                className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Player */}
            <div className={cn('bg-black', preview.isAudio ? 'p-6' : '')}>
              {preview.isAudio ? (
                <audio
                  src={preview.url}
                  controls
                  autoPlay
                  className="w-full"
                />
              ) : (
                <video
                  src={preview.url}
                  controls
                  autoPlay
                  className="w-full max-h-[70vh] object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
