'use client';

import { useEffect, useState } from 'react';
import { VideoProject } from '@/types';
import { ProjectCard } from '@/components/dashboard/ProjectCard';
import { UploadZone } from '@/components/dashboard/UploadZone';
import { UrlUpload } from '@/components/dashboard/UrlUpload';
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
    if (res.ok) {
      const data = await res.json();
      setProjects(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

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
          <p className="text-sm text-slate-400 mt-1">
            {projects.length} {projects.length === 1 ? 'video' : 'videos'} en tu biblioteca
          </p>
        </div>
        <Button
          onClick={() => setShowUpload(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-medium gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Agregar video
        </Button>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Agregar video</DialogTitle>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-slate-800 rounded-lg">
            <button
              onClick={() => setUploadTab('file')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all',
                uploadTab === 'file'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <Upload className="w-4 h-4" />
              Subir archivo
            </button>
            <button
              onClick={() => setUploadTab('url')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all',
                uploadTab === 'url'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <Link className="w-4 h-4" />
              Pegar URL
            </button>
          </div>

          {uploadTab === 'file' ? (
            <UploadZone />
          ) : (
            <UrlUpload onSuccess={handleUploadSuccess} />
          )}
        </DialogContent>
      </Dialog>

      {/* Empty state */}
      {!loading && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center">
            <Film className="w-10 h-10 text-slate-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">No tienes videos aún</h3>
            <p className="text-slate-400 text-sm mt-1">
              Sube un archivo o pega un link de YouTube para comenzar
            </p>
          </div>
          <Button
            onClick={() => setShowUpload(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Agregar primer video
          </Button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-800 rounded-xl overflow-hidden animate-pulse">
              <div className="aspect-video bg-slate-700" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-slate-700 rounded w-3/4" />
                <div className="h-3 bg-slate-700 rounded w-1/2" />
                <div className="h-8 bg-slate-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Projects Grid */}
      {!loading && projects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDeleted={fetchProjects}
            />
          ))}
        </div>
      )}
    </div>
  );
}
