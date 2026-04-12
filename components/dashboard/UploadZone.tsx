'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { UploadCloud, FileVideo, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/lib/utils/video';
import { cn } from '@/lib/utils';

type UploadStage = 'idle' | 'uploading' | 'metadata' | 'transcribing' | 'done' | 'error';

const STAGE_LABELS: Record<UploadStage, string> = {
  idle: '',
  uploading: 'Subiendo video...',
  metadata: 'Extrayendo metadatos...',
  transcribing: 'Transcribiendo audio (puede tardar 1-2 min)...',
  done: '¡Video listo para editar!',
  error: 'Error al procesar el video',
};

const STAGE_PROGRESS: Record<UploadStage, number> = {
  idle: 0,
  uploading: 30,
  metadata: 55,
  transcribing: 80,
  done: 100,
  error: 0,
};

export function UploadZone() {
  const router = useRouter();
  const [stage, setStage] = useState<UploadStage>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const processFile = useCallback(
    async (file: File) => {
      setSelectedFile(file);
      setStage('uploading');
      setErrorMsg('');

      try {
        // 1. Upload
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error ?? 'Error al subir');
        }
        const { project_id } = await uploadRes.json();

        // 2. Extract metadata
        setStage('metadata');
        const metaRes = await fetch('/api/process/metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id }),
        });
        if (!metaRes.ok) {
          const err = await metaRes.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? 'Error al extraer metadatos');
        }

        // 3. Transcribe
        setStage('transcribing');
        const transcribeRes = await fetch('/api/process/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id }),
        });
        if (!transcribeRes.ok) {
          const err = await transcribeRes.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? 'Error al transcribir');
        }

        // 4. Generate thumbnail (fire-and-forget — don't block redirect)
        fetch(`/api/projects/${project_id}/thumbnail`, { method: 'POST' }).catch(() => {});

        setStage('done');

        // Redirect to editor after short delay
        setTimeout(() => router.push(`/projects/${project_id}`), 1500);
      } catch (err) {
        setStage('error');
        setErrorMsg(err instanceof Error ? err.message : 'Error desconocido');
      }
    },
    [router]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => { if (accepted[0]) processFile(accepted[0]); },
    accept: { 'video/mp4': ['.mp4'], 'video/quicktime': ['.mov'], 'video/x-msvideo': ['.avi'] },
    maxSize: 500 * 1024 * 1024,
    maxFiles: 1,
    disabled: stage !== 'idle',
  });

  const reset = () => {
    setStage('idle');
    setSelectedFile(null);
    setErrorMsg('');
  };

  if (stage !== 'idle') {
    return (
      <div className="border-2 border-dashed border-zinc-700 rounded-2xl p-8 bg-zinc-900/50 space-y-4">
        <div className="flex items-center gap-3">
          <FileVideo className="w-8 h-8 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-white truncate">{selectedFile?.name}</p>
            <p className="text-sm text-zinc-400">{selectedFile ? formatFileSize(selectedFile.size) : ''}</p>
          </div>
          {(stage === 'done' || stage === 'error') && (
            <button onClick={reset} className="ml-auto text-zinc-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {stage !== 'done' && stage !== 'error' && (
          <Progress value={STAGE_PROGRESS[stage]} className="h-2 bg-zinc-800" />
        )}

        <div className="flex items-center gap-2">
          {stage === 'done' && <CheckCircle2 className="w-5 h-5 text-green-400" />}
          {stage === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
          <p
            className={cn(
              'text-sm',
              stage === 'done' && 'text-green-400',
              stage === 'error' && 'text-red-400',
              stage !== 'done' && stage !== 'error' && 'text-zinc-400'
            )}
          >
            {stage === 'error' ? errorMsg : STAGE_LABELS[stage]}
          </p>
        </div>

        {stage === 'error' && (
          <Button size="sm" variant="outline" onClick={reset} className="border-zinc-600 text-zinc-300">
            Intentar de nuevo
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all duration-200',
        'flex flex-col items-center justify-center gap-4 text-center',
        isDragActive
          ? 'border-amber-500 bg-amber-500/10'
          : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-500 hover:bg-zinc-800/50'
      )}
    >
      <input {...getInputProps()} />
      <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
        <UploadCloud className="w-8 h-8 text-amber-400" />
      </div>
      <div>
        <p className="text-lg font-semibold text-white mb-1">
          {isDragActive ? 'Suelta el video aquí' : 'Arrastra tu video aquí'}
        </p>
        <p className="text-sm text-zinc-400">
          o{' '}
          <span className="text-amber-400 font-medium">haz clic para seleccionar</span>
        </p>
        <p className="text-xs text-zinc-600 mt-2">MP4, MOV, AVI · máx 500 MB</p>
      </div>
    </div>
  );
}
