'use client';

import { useEffect, useState } from 'react';
import { VideoProject } from '@/types';
import { ProjectCard } from '@/components/dashboard/ProjectCard';
import { UploadZone } from '@/components/dashboard/UploadZone';
import { UrlUpload } from '@/components/dashboard/UrlUpload';
import { ViralClipsFromUrl } from '@/components/dashboard/ViralClipsFromUrl';
import { PlusCircle, Film, Upload, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type UploadTab = 'file' | 'url';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTab, setUploadTab] = useState<UploadTab>('file');

  const fetchProjects = async () => {
    const res = await fetch('/api/projects');
    if (res.ok) setProjects(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleUploadSuccess = () => {
    setShowUpload(false);
    fetchProjects();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mis Proyectos</h1>
          <p className="text-sm text-zinc-400 mt-1">
            {projects.length} {projects.length === 1 ? 'video' : 'videos'} en tu biblioteca
          </p>
        </div>
        <Button
          onClick={() => setShowUpload(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white font-medium gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Subir video
        </Button>
      </div>

      {/* Viral clips from URL — prominent hero card */}
      <ViralClipsFromUrl />

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Subir video</DialogTitle>
          </DialogHeader>

          <div className="flex gap-1 p-1 bg-zinc-800 rounded-lg">
            <button
              onClick={() => setUploadTab('file')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all',
                uploadTab === 'file' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
              )}
            >
              <Upload className="w-4 h-4" />
              Subir archivo
            </button>
            <button
              onClick={() => setUploadTab('url')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all',
                uploadTab === 'url' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
              )}
            >
              <Link className="w-4 h-4" />
              Solo importar
            </button>
          </div>

          {uploadTab === 'file' ? <UploadZone /> : <UrlUpload onSuccess={handleUploadSuccess} />}
        </DialogContent>
      </Dialog>

      {/* Empty state */}
      {!loading && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center">
            <Film className="w-10 h-10 text-zinc-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">No tienes proyectos aún</h3>
            <p className="text-zinc-400 text-sm mt-1">
              Usa el campo de arriba o sube un archivo
            </p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-zinc-800 rounded-xl overflow-hidden animate-pulse">
              <div className="aspect-video bg-zinc-700" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-zinc-700 rounded w-3/4" />
                <div className="h-3 bg-zinc-700 rounded w-1/2" />
                <div className="h-8 bg-zinc-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Projects Grid */}
      {!loading && projects.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Biblioteca</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} onDeleted={fetchProjects} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
