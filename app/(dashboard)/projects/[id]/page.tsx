'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { VideoProject, EditOperation, VideoExport, TranscriptionSegment } from '@/types';
import { VideoPlayer, VideoPlayerHandle } from '@/components/editor/VideoPlayer';
import { EditOptions } from '@/components/editor/EditOptions';
import { TranscriptionPanel } from '@/components/editor/TranscriptionPanel';
import { OperationHistory } from '@/components/editor/OperationHistory';
import { ExportPanel } from '@/components/editor/ExportPanel';
import { ProcessingStatus } from '@/components/editor/ProcessingStatus';
import { ViralClipsPanel } from '@/components/editor/ViralClipsPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Info, RefreshCw } from 'lucide-react';
import { formatDuration } from '@/lib/utils/video';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

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
  const deletedOpIds = useRef<Set<string>>(new Set());
  const deletedExportIds = useRef<Set<string>>(new Set());

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

      if (opsRes.ok) {
        const ops: EditOperation[] = await opsRes.json();
        setOperations(ops.filter((op) => !deletedOpIds.current.has(op.id)));
      }
      if (exportsRes.ok) {
        const exps: VideoExport[] = await exportsRes.json();
        setExports(exps.filter((e) => !deletedExportIds.current.has(e.id)));
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshOperations = useCallback(() => {
    fetch(`/api/projects/${id}/operations`)
      .then((r) => r.json())
      .then((ops: EditOperation[]) =>
        setOperations(ops.filter((op) => !deletedOpIds.current.has(op.id)))
      )
      .catch(() => {});
  }, [id]);

  const handleOperationStarted = useCallback((operationId: string) => {
    setActiveOperationIds((prev) => [...prev, operationId]);
    // Realtime subscription will pick up the INSERT — also do a quick fetch as fallback
    setTimeout(refreshOperations, 800);
  }, [refreshOperations]);

  const handleOperationCompleted = useCallback(() => {
    fetch(`/api/projects/${id}/exports`)
      .then((r) => r.json())
      .then((exps: VideoExport[]) =>
        setExports(exps.filter((e) => !deletedExportIds.current.has(e.id)))
      )
      .catch(() => {});
    refreshOperations();
  }, [id, refreshOperations]);

  const handleOperationDeleted = useCallback((opId: string) => {
    deletedOpIds.current.add(opId);
    setOperations((prev) => prev.filter((op) => op.id !== opId));
    setActiveOperationIds((prev) => prev.filter((id) => id !== opId));
  }, []);

  const handleExportDeleted = useCallback((exportId: string) => {
    deletedExportIds.current.add(exportId);
    setExports((prev) => prev.filter((e) => e.id !== exportId));
  }, []);

  // Realtime subscription: reflect INSERT/UPDATE on edit_operations instantly
  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`ops:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'edit_operations', filter: `project_id=eq.${id}` },
        (payload) => {
          const op = payload.new as EditOperation;
          if (deletedOpIds.current.has(op.id)) return;
          setOperations((prev) => prev.some((o) => o.id === op.id) ? prev : [...prev, op]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'edit_operations', filter: `project_id=eq.${id}` },
        (payload) => {
          const op = payload.new as EditOperation;
          if (deletedOpIds.current.has(op.id)) return;
          setOperations((prev) => prev.map((o) => o.id === op.id ? op : o));
          // When completed, refresh exports list
          if (op.status === 'completed') {
            fetch(`/api/projects/${id}/exports`)
              .then((r) => r.json())
              .then((exps: VideoExport[]) =>
                setExports(exps.filter((e) => !deletedExportIds.current.has(e.id)))
              )
              .catch(() => {});
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
        <div className="h-8 bg-zinc-800 rounded w-1/3" />
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1 h-64 bg-zinc-800 rounded-xl" />
          <div className="col-span-1 h-64 bg-zinc-800 rounded-xl" />
          <div className="col-span-1 h-64 bg-zinc-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 text-center text-zinc-400">
        <p>Proyecto no encontrado.</p>
        <Link href="/projects" className="text-amber-400 hover:underline text-sm mt-2 block">
          ← Volver a proyectos
        </Link>
      </div>
    );
  }

  const segments: TranscriptionSegment[] = project.transcription?.segments ?? [];
  const isReady = project.status === 'ready';

  return (
    <div className="flex flex-col min-h-full">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm px-6 py-3 flex items-center gap-4">
        <Link
          href="/projects"
          className="text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-white truncate">{project.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {project.duration_seconds != null && (
              <span className="text-xs text-zinc-500">{formatDuration(project.duration_seconds)}</span>
            )}
            {project.resolution && (
              <span className="text-xs text-zinc-600">{project.resolution}</span>
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
                className="h-6 px-2 text-xs border-zinc-700 text-zinc-400 hover:text-white"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? 'Transcribiendo...' : 'Reintentar'}
              </Button>
            )}
          </div>
        </div>
        <Link
          href={`/projects/${id}/exports`}
          className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"
        >
          <Info className="w-4 h-4" />
          Ver exportaciones
        </Link>
      </div>

      {/* Main editor grid */}
      <div className="flex-1 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

          {/* Left column: Player + Transcription */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              {videoUrl ? (
                <VideoPlayer ref={playerRef} url={videoUrl} title={project.original_filename} />
              ) : (
                <div className="aspect-video bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 text-sm">
                  {isReady ? 'Cargando reproductor...' : 'Video procesándose...'}
                </div>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Transcripción</h3>
              <TranscriptionPanel
                segments={segments}
                onSeek={(s) => playerRef.current?.seekTo(s)}
              />
            </div>
          </div>

          {/* Center column: Instruction + Status + History */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <ViralClipsPanel
                projectId={id}
                projectReady={isReady}
                onClipsStarted={(ids) => ids.forEach(handleOperationStarted)}
              />
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Editar con IA</h3>
              <EditOptions
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

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col max-h-[480px]">
              <h3 className="text-sm font-semibold text-white mb-3 shrink-0">Historial de ediciones</h3>
              <div className="flex-1 overflow-y-auto min-h-0">
                <OperationHistory
                  operations={operations}
                  onDeleted={handleOperationDeleted}
                  onOperationStarted={handleOperationStarted}
                />
              </div>
            </div>
          </div>

          {/* Right column: Exports — sticky so it stays in view while scrolling */}
          <div className="lg:col-span-3 lg:sticky lg:top-[73px]">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">
                Exportaciones ({exports.length})
              </h3>
              <ExportPanel exports={exports} onDeleted={handleExportDeleted} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
