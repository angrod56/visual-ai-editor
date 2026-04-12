'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { VideoProject, EditOperation, VideoExport, TranscriptionSegment } from '@/types';
import { VideoPlayer, VideoPlayerHandle, SubtitleExportSettings } from '@/components/editor/VideoPlayer';
import { EditOptions } from '@/components/editor/EditOptions';
import { TranscriptionPanel } from '@/components/editor/TranscriptionPanel';
import { OperationHistory } from '@/components/editor/OperationHistory';
import { ExportPanel } from '@/components/editor/ExportPanel';
import { ProcessingStatus } from '@/components/editor/ProcessingStatus';
import { ViralClipsPanel } from '@/components/editor/ViralClipsPanel';
import { DescriptionGenerator } from '@/components/editor/DescriptionGenerator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Info, RefreshCw, Pencil, Check, X } from 'lucide-react';
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
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [savingTranscription, setSavingTranscription] = useState(false);
  const [exportingSubtitles, setExportingSubtitles] = useState(false);
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const [trimStart, setTrimStart] = useState<number | null>(null);
  const [trimEnd, setTrimEnd] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
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
        setSegments(proj.transcription?.segments ?? []);

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

  const startEditTitle = () => {
    setTitleDraft(project?.title ?? '');
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.select(), 30);
  };

  const cancelEditTitle = () => { setEditingTitle(false); setTitleDraft(''); };

  const saveTitle = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === project?.title) { cancelEditTitle(); return; }
    setSavingTitle(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      if (res.ok) {
        setProject((p) => p ? { ...p, title: trimmed } : p);
        toast.success('Nombre guardado');
      } else {
        toast.error('Error al guardar nombre');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSavingTitle(false);
      setEditingTitle(false);
      setTitleDraft('');
    }
  };

  const handleExportSubtitles = useCallback(async ({ style, position, fontSize }: SubtitleExportSettings) => {
    if (exportingSubtitles) return;
    setExportingSubtitles(true);
    try {
      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: id,
          direct_options: { subtitles: true, subtitleStyle: style },
          subtitle_position: position,
          subtitle_fontsize: fontSize,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Error al iniciar exportación'); return; }
      handleOperationStarted(data.operation_id);
      toast.success('Quemando subtítulos...');
      fetch(`/api/edit/${data.operation_id}/process`, { method: 'POST', keepalive: true }).catch(() => {});
    } catch {
      toast.error('Error de conexión');
    } finally {
      setExportingSubtitles(false);
    }
  }, [id, exportingSubtitles, handleOperationStarted]);

  const handleSegmentsChange = useCallback(async (updated: TranscriptionSegment[]) => {
    setSavingTranscription(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcription: { segments: updated } }),
      });
      if (res.ok) {
        setSegments(updated);
        toast.success('Transcripción guardada');
      } else {
        toast.error('Error al guardar transcripción');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSavingTranscription(false);
    }
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
          {editingTitle ? (
            <div className="flex items-center gap-1.5">
              <input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTitle();
                  if (e.key === 'Escape') cancelEditTitle();
                }}
                disabled={savingTitle}
                className="flex-1 min-w-0 bg-zinc-800 border border-amber-500/60 rounded-lg px-2 py-0.5 text-white font-semibold text-base focus:outline-none focus:border-amber-500"
              />
              <button onClick={saveTitle} disabled={savingTitle} className="p-1 rounded text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={cancelEditTitle} className="p-1 rounded text-zinc-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={startEditTitle}
              className="group flex items-center gap-1.5 max-w-full"
              title="Renombrar proyecto"
            >
              <h1 className="font-semibold text-white truncate group-hover:text-zinc-200 transition-colors">
                {project.title}
              </h1>
              <Pencil className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
            </button>
          )}
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
                <VideoPlayer
                  ref={playerRef}
                  url={videoUrl}
                  title={project.original_filename}
                  segments={segments}
                  onExportSubtitles={segments.length > 0 ? handleExportSubtitles : undefined}
                  exportingSubtitles={exportingSubtitles}
                  forceHideSubtitles={exportPreviewOpen}
                  onSetTrimStart={setTrimStart}
                  onSetTrimEnd={setTrimEnd}
                />
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
                onSegmentsChange={handleSegmentsChange}
                saving={savingTranscription}
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
                externalTrimStart={trimStart}
                externalTrimEnd={trimEnd}
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

          {/* Right column: Exports + Description */}
          <div className="lg:col-span-3 space-y-4">
            <div className="lg:sticky lg:top-[73px] space-y-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3">
                  Exportaciones ({exports.length})
                </h3>
                <ExportPanel
                exports={exports}
                onDeleted={handleExportDeleted}
                onPreviewOpen={() => setExportPreviewOpen(true)}
                onPreviewClose={() => setExportPreviewOpen(false)}
              />
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <DescriptionGenerator projectId={id} projectReady={isReady} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
