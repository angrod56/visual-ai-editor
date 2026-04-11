'use client';

import { useState } from 'react';
import { VideoExport } from '@/types';
import { formatFileSize, formatDuration } from '@/lib/utils/video';
import { Download, FileVideo, Film, Headphones, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
}

export function ExportPanel({ exports }: Props) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (exportItem: VideoExport) => {
    setDownloading(exportItem.id);
    try {
      const res = await fetch(`/api/exports/${exportItem.id}`);
      if (!res.ok) throw new Error('No se pudo obtener el enlace de descarga');
      const { download_url } = await res.json();

      // Open in new tab to trigger download
      window.open(download_url, '_blank');
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
    <ScrollArea className="max-h-72">
      <div className="space-y-2 pr-2">
        {[...exports].reverse().map((exp) => {
          const Icon = TYPE_ICONS[exp.export_type] ?? FileVideo;
          const isDownloading = downloading === exp.id;

          return (
            <div
              key={exp.id}
              className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-purple-600/20 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-purple-400" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge className={cn('text-xs border', 'bg-slate-700 text-slate-300 border-slate-600')}>
                    {TYPE_LABELS[exp.export_type]}
                  </Badge>
                </div>
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
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDownload(exp)}
                disabled={isDownloading}
                className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/20 px-2"
              >
                <Download className={cn('w-4 h-4', isDownloading && 'animate-bounce')} />
              </Button>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
