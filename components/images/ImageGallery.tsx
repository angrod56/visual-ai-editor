'use client';

import { useState } from 'react';
import { GeneratedImage } from '@/types';
import { Download, Trash2, Loader2, CheckSquare, Square, DownloadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const FORMAT_LABELS: Record<string, string> = {
  square: '1:1',
  portrait: '9:16',
  landscape: '16:9',
};

interface Props {
  images: GeneratedImage[];
  onDeleted: (id: string) => void;
}

export function ImageGallery({ images, onDeleted }: Props) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);

  const handleDelete = async (img: GeneratedImage) => {
    setDeleting(img.id);
    try {
      const res = await fetch(`/api/images/${img.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDeleted(img.id);
        setSelected((prev) => { const n = new Set(prev); n.delete(img.id); return n; });
        toast.success('Imagen eliminada');
      } else {
        toast.error('Error al eliminar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setDeleting(null);
    }
  };

  const downloadImage = async (img: GeneratedImage) => {
    if (!img.signed_url) {
      toast.error('URL no disponible');
      return;
    }
    const a = document.createElement('a');
    a.href = img.signed_url;
    a.download = `imagen-${img.format}-${img.id.slice(0, 8)}.jpg`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const selectAll = () => setSelected(new Set(images.map((i) => i.id)));
  const clearSelection = () => setSelected(new Set());

  const bulkDownload = async () => {
    const toDownload = images.filter((i) => selected.has(i.id));
    if (toDownload.length === 0) return;
    setBulkDownloading(true);
    try {
      for (const img of toDownload) {
        await downloadImage(img);
        await new Promise((r) => setTimeout(r, 300)); // stagger downloads
      }
      toast.success(`${toDownload.length} imágenes descargadas`);
    } finally {
      setBulkDownloading(false);
    }
  };

  if (images.length === 0) {
    return (
      <div className="text-center py-10 text-zinc-600 text-sm">
        <DownloadCloud className="w-8 h-8 mx-auto mb-2 text-zinc-700" />
        <p>Las imágenes generadas aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bulk actions bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs text-zinc-500">{images.length} imagen{images.length !== 1 ? 'es' : ''}</p>
          {selected.size > 0 && (
            <Badge className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/40">
              {selected.size} seleccionada{selected.size !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selected.size === images.length
            ? <button onClick={clearSelection} className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1"><CheckSquare className="w-3.5 h-3.5" /> Deseleccionar</button>
            : <button onClick={selectAll} className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1"><Square className="w-3.5 h-3.5" /> Seleccionar todo</button>
          }
          {selected.size > 0 && (
            <Button
              size="sm"
              disabled={bulkDownloading}
              onClick={bulkDownload}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-1.5 text-xs h-7"
            >
              {bulkDownloading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Download className="w-3.5 h-3.5" />
              }
              Descargar ({selected.size})
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {images.map((img) => {
          const isSelected = selected.has(img.id);
          const aspectClass = img.format === 'portrait' ? 'aspect-[9/16]' : img.format === 'landscape' ? 'aspect-video' : 'aspect-square';

          return (
            <div
              key={img.id}
              className={cn(
                'group relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all',
                isSelected ? 'border-amber-500 shadow-lg shadow-amber-500/20' : 'border-zinc-700 hover:border-zinc-500'
              )}
              onClick={() => toggleSelect(img.id)}
            >
              {/* Image */}
              <div className={aspectClass}>
                {img.signed_url ? (
                  <img
                    src={img.signed_url}
                    alt={img.prompt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
                  </div>
                )}
              </div>

              {/* Selection checkbox */}
              <div className={cn(
                'absolute top-2 left-2 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                isSelected ? 'bg-amber-500 border-amber-500' : 'bg-black/50 border-white/30 opacity-0 group-hover:opacity-100'
              )}>
                {isSelected && <span className="text-black text-xs font-bold">✓</span>}
              </div>

              {/* Format badge */}
              <div className="absolute top-2 right-2">
                <Badge className="text-xs bg-black/70 text-white border-white/20 backdrop-blur-sm">
                  {FORMAT_LABELS[img.format] ?? img.format}
                </Badge>
              </div>

              {/* Actions overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => downloadImage(img)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-amber-500/90 hover:bg-amber-500 text-black text-xs font-semibold rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar
                  </button>
                  <button
                    onClick={() => handleDelete(img)}
                    disabled={deleting === img.id}
                    className="p-1.5 bg-red-900/60 hover:bg-red-900/90 text-red-400 rounded-lg transition-colors"
                  >
                    {deleting === img.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />
                    }
                  </button>
                </div>
              </div>

              {/* Prompt tooltip on hover */}
              {img.script_data && (
                <div className="absolute bottom-12 left-2 right-2 bg-black/90 rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <p className="text-xs text-amber-300 font-medium truncate">{img.script_data.hook}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
