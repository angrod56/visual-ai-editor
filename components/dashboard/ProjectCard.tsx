'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Film, Trash2, Loader2, Play, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { VideoProject } from '@/types';
import { formatDuration, formatFileSize } from '@/lib/utils/video';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  uploading: 'bg-yellow-900/70 text-yellow-300 border-yellow-700/50',
  processing: 'bg-blue-900/70 text-blue-300 border-blue-700/50',
  ready: 'bg-green-900/70 text-green-300 border-green-700/50',
  error: 'bg-red-900/70 text-red-300 border-red-700/50',
};

const STATUS_LABELS: Record<string, string> = {
  uploading: 'Subiendo',
  processing: 'Procesando',
  ready: 'Listo',
  error: 'Error',
};

interface Props {
  project: VideoProject;
  onDeleted: () => void;
  thumbnailDelay?: number; // ms to wait before requesting thumbnail (stagger across cards)
}

export function ProjectCard({ project, onDeleted, thumbnailDelay = 0 }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState(project.thumbnail_url ?? null);
  const [thumbLoading, setThumbLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (project.status !== 'ready') return;
    if (thumbnailUrl && !imgError) return;

    let cancelled = false;
    const request = () => {
      if (cancelled) return;
      setThumbLoading(true);
      fetch(`/api/projects/${project.id}/thumbnail`, { method: 'POST' })
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data.thumbnail_url) {
            setThumbnailUrl(data.thumbnail_url);
            setImgError(false);
          }
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setThumbLoading(false); });
    };

    const timer = setTimeout(request, thumbnailDelay);
    return () => { cancelled = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.status, thumbnailDelay]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${project.title}"?`)) return;
    setDeleting(true);
    await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
    onDeleted();
  };

  const showThumbnail = thumbnailUrl && !imgError;
  const isReady = project.status === 'ready';

  return (
    <Link
      href={isReady ? `/projects/${project.id}` : '#'}
      className={cn('group block relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 transition-all duration-300', isReady ? 'hover:border-amber-500/40 hover:shadow-xl hover:shadow-black/40 cursor-pointer' : 'cursor-default')}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-zinc-800 relative overflow-hidden">
        {showThumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={project.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {thumbLoading ? (
              <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
            ) : (
              <Film className="w-12 h-12 text-zinc-700" />
            )}
          </div>
        )}

        {/* Dark gradient overlay — always present at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Status badge — top left */}
        <div className="absolute top-2.5 left-2.5">
          <Badge className={cn('text-xs border backdrop-blur-sm', STATUS_STYLES[project.status])}>
            {STATUS_LABELS[project.status]}
          </Badge>
        </div>

        {/* Delete button — top right */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-red-900/60 hover:border-red-700/50 transition-all opacity-0 group-hover:opacity-100"
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>

        {/* Play / Edit button — center, appears on hover */}
        {isReady && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
            <div className="w-14 h-14 rounded-full bg-amber-500/90 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-amber-500/30 transition-transform duration-200 group-hover:scale-110">
              <Play className="w-6 h-6 text-black fill-black ml-0.5" />
            </div>
          </div>
        )}

        {/* Bottom info bar */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2.5 flex items-end justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold leading-tight truncate drop-shadow">
              {project.title}
            </p>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
              {project.duration_seconds != null && (
                <span className="font-mono">{formatDuration(project.duration_seconds)}</span>
              )}
              {project.file_size_bytes != null && (
                <span>{formatFileSize(project.file_size_bytes)}</span>
              )}
              {project.resolution && (
                <span className="hidden sm:inline text-zinc-500">{project.resolution}</span>
              )}
            </div>
          </div>
          {isReady && (
            <div className="shrink-0 w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Pencil className="w-3.5 h-3.5 text-amber-400" />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
