'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { VideoProject, EditOperation, VideoExport, TranscriptionSegment } from '@/types';
import { VideoPlayer, VideoPlayerHandle } from '@/components/editor/VideoPlayer';
import { InstructionInput } from '@/components/editor/InstructionInput';
import { TranscriptionPanel } from '@/components/editor/TranscriptionPanel';
import { OperationHistory } from '@/components/editor/OperationHistory';
import { ExportPanel } from '@/components/editor/ExportPanel';
import { ProcessingStatus } from '@/components/editor/ProcessingStatus';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Info, RefreshCw } from 'lucide-react';
import { formatDuration } from '@/lib/utils/video';
import { toast } from 'sonner';

export default function ProjectEditorPage() {
  const { id } = useParams<{ id: string }>();
  const playerRef = useRef<VideoPlayerHandle>(null);

  const [project, setProject] = useState<VideoProject | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [operations, setOperations] = useState<EditOperation[]>([]);
  const [exports, setExports] = useState<VideoExport[]>([]);
  const [activeOperationIds, setActiveOperationIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!id) return;
    loadProject();
  }, [id]);

  const loadProject = async () => {
    try {
      const [projectRes, opsRes, exportsRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/projects/${id}/operations`),
        fetch(`/api/projects/${id}/exports`),
      ]);

      if (projectRes.ok) {
        const proj: VideoProject = await projectRes.json();
        setProject(proj);

        // Get signed URL for video from R2 via API
        const urlRes = await fetch(`/api/projects/${id}/signed-url`);
        if (urlRes.ok) {
          const { signed_url } = await urlRes.json();
          setVideoUrl(signed_url);
        }
      }

      if (opsRes.ok) setOperations(await opsRes.json());
      if (exportsRes.ok) setExports(await exportsRes.json());
    } finally {
      setLoading(false);
    }
  };

  const handleOperationStarted = useCallback((operationId: string) => {
    setActiveOperationIds((prev) => [...prev, operationId]);
    // Refresh operations list
    fetch(`/api/projects/${id}/operations`)
      .then((r) => r.json())
      .then(setOperations)
      .catch(() => {});
  }, [id]);

  const handleOperationCompleted = useCallback(() => {
    // Refresh exports list
    fetch(`/api/projects/${id}/exports`)
      .then((r) => r.json())
      .then(setExports)
      .catch(() => {});
    // Refresh operations
    fetch(`/api/projects/${id}/operations`)
      .then((r) => r.json())
      .then(setOperations)
      .catch(() => {});
  }, [id]);

  const handleRetryTranscription = async () => {
    if (!id || retrying) return;
    setRetrying(true);
    try {
      const res = await fetch(`/api/projects/${id}/retry-transcribe`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success('Transcripción completada. Recargando...');
        setTimeout(() => loadProject(), 500);
      } else {
        toast.error(data.error ?? 'Error al reintentar transcripción');
      }
    } catch {
      toast.error('Error de conexión al reintentar');
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 bg-slate-800 rounded w-1/3" />
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1 h-64 bg-slate-800 rounded-xl" />
          <div className="col-span-1 h-64 bg-slate-800 rounded-xl" />
          <div className="col-span-1 h-64 bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 text-center text-slate-400">
        <p>Proyecto no encontrado.</p>
        <Link href="/projects" className="text-purple-400 hover:underline text-sm mt-2 block">
          ← Volver a proyectos
        </Link>
      </div>
    );
  }

  const segments: TranscriptionSegment[] = project.transcription?.segments ?? [];
  const isReady = project.status === 'ready';

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="border-b border-slate-800 bg-slate-900/50 px-6 py-3 flex items-center gap-4">
        <Link
          href="/projects"
          className="text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-white truncate">{project.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {project.duration_seconds != null && (
              <span className="text-xs text-slate-500">{formatDuration(project.duration_seconds)}</span>
            )}
            {project.resolution && (
              <span className="text-xs text-slate-600">{project.resolution}</span>
            )}
            <Badge
              className={
                isReady
                  ? 'bg-green-900/40 text-green-300 border-green-700 text-xs'
                  : 'bg-yellow-900/40 text-yellow-300 border-yellow-700 text-xs'
              }
            >
              {isReady ? 'Listo' : 'Procesando'}
            </Badge>
            {!isReady && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetryTranscription}
                disabled={retrying}
                className="h-6 px-2 text-xs border-slate-700 text-slate-400 hover:text-white"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? 'Transcribiendo...' : 'Reintentar'}
              </Button>
            )}
          </div>
        </div>
        <Link
          href={`/projects/${id}/exports`}
          className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
        >
          <Info className="w-4 h-4" />
          Ver exports
        </Link>
      </div>

      {/* Main editor grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">

          {/* Left column: Player + Transcription */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              {videoUrl ? (
                <VideoPlayer ref={playerRef} url={videoUrl} title={project.original_filename} />
              ) : (
                <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center text-slate-500 text-sm">
                  {isReady ? 'Cargando reproductor...' : 'Video procesándose...'}
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Transcripción</h3>
              <TranscriptionPanel
                segments={segments}
                onSeek={(s) => playerRef.current?.seekTo(s)}
              />
            </div>
          </div>

          {/* Center column: Instruction + Status + History */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Editar con IA</h3>
              <InstructionInput
                projectId={id}
                projectReady={isReady}
                onOperationStarted={handleOperationStarted}
              />
            </div>

            {/* Active operation statuses */}
            {activeOperationIds.length > 0 && (
              <div className="space-y-2">
                {activeOperationIds.slice(-3).map((opId) => (
                  <ProcessingStatus
                    key={opId}
                    operationId={opId}
                    onCompleted={handleOperationCompleted}
                  />
                ))}
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Historial de ediciones</h3>
              <OperationHistory
                operations={operations}
                onDeleted={(id) => setOperations((prev) => prev.filter((op) => op.id !== id))}
              />
            </div>
          </div>

          {/* Right column: Exports */}
          <div className="lg:col-span-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">
                Exports ({exports.length})
              </h3>
              <ExportPanel exports={exports} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
