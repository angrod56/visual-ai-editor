'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Film, Trash2, Clock, HardDrive } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VideoProject } from '@/types';
import { formatDuration, formatFileSize } from '@/lib/utils/video';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  uploading: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  processing: 'bg-blue-900/50 text-blue-300 border-blue-700',
  ready: 'bg-green-900/50 text-green-300 border-green-700',
  error: 'bg-red-900/50 text-red-300 border-red-700',
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
}

export function ProjectCard({ project, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm(`¿Eliminar "${project.title}"?`)) return;
    setDeleting(true);

    await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
    onDeleted();
  };

  return (
    <div className="group relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-600 transition-all duration-200">
      {/* Thumbnail / placeholder */}
      <Link href={`/projects/${project.id}`} className="block">
        <div className="aspect-video bg-slate-800 flex items-center justify-center overflow-hidden">
          {project.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.thumbnail_url}
              alt={project.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <Film className="w-12 h-12 text-slate-600" />
          )}
        </div>
      </Link>

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/projects/${project.id}`}>
            <h3 className="font-semibold text-white text-sm leading-tight hover:text-purple-300 transition-colors line-clamp-2">
              {project.title}
            </h3>
          </Link>
          <Badge
            className={cn(
              'shrink-0 text-xs px-2 py-0.5 border',
              STATUS_STYLES[project.status]
            )}
          >
            {STATUS_LABELS[project.status]}
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          {project.duration_seconds != null && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(project.duration_seconds)}
            </span>
          )}
          {project.file_size_bytes != null && (
            <span className="flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              {formatFileSize(project.file_size_bytes)}
            </span>
          )}
          {project.resolution && (
            <span className="hidden sm:block">{project.resolution}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            disabled={project.status !== 'ready'}
            className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs"
          >
            <Link href={`/projects/${project.id}`}>
              {project.status === 'ready' ? 'Editar con IA' : 'Procesando...'}
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-slate-500 hover:text-red-400 hover:bg-red-900/20 px-2"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
