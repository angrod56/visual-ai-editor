'use client';

import { useState } from 'react';
import { Link, Loader2, CheckCircle2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

type Stage = 'idle' | 'downloading' | 'processing' | 'done';

const STAGE_LABELS: Record<Stage, string> = {
  idle: '',
  downloading: 'Descargando video...',
  processing: 'Transcribiendo con IA...',
  done: '¡Listo! Abriendo proyecto...',
};

interface Props {
  onSuccess?: () => void;
}

export function UrlUpload({ onSuccess }: Props) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [stage, setStage] = useState<Stage>('idle');

  const isYouTube = /youtube\.com|youtu\.be/.test(url);
  const isInstagram = /instagram\.com/.test(url);
  const isTikTok = /tiktok\.com/.test(url);
  const isSupported = isYouTube;
  const isBusy = stage !== 'idle' && stage !== 'done';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !isSupported || isBusy) return;

    setStage('downloading');

    try {
      // 1. Download video from URL
      const uploadRes = await fetch('/api/upload/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        toast.error(uploadData.error ?? 'Error al descargar el video');
        setStage('idle');
        return;
      }

      const projectId: string = uploadData.project_id;

      setStage('processing');

      // 2. Extract metadata
      await fetch('/api/process/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      });

      // 3. Transcribe
      await fetch('/api/process/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      });

      setStage('done');
      toast.success('Video importado y transcrito');
      onSuccess?.();

      setTimeout(() => router.push(`/projects/${projectId}`), 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('abort') || msg.includes('fetch') || msg === '') {
        toast.error('El proceso tardó demasiado. Descarga el video de YouTube y súbelo directamente.', { duration: 6000 });
      } else {
        toast.error(msg || 'Error de conexión');
      }
      setStage('idle');
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            disabled={isBusy}
            className="pl-9 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-amber-500"
          />
        </div>

        {/* Platform indicator */}
        {url.trim() && (
          <div className={cn(
            'flex items-center gap-2 text-xs px-3 py-2 rounded-lg border',
            isYouTube
              ? 'bg-red-900/20 border-red-800 text-red-400'
              : (isInstagram || isTikTok)
              ? 'bg-orange-900/20 border-orange-800 text-orange-400'
              : 'bg-zinc-800 border-zinc-700 text-zinc-500'
          )}>
            {isYouTube && <><Play className="w-3.5 h-3.5" /> YouTube detectado — compatible</>}
            {isInstagram && <>⚠️ Instagram: descarga el video manualmente y súbelo</>}
            {isTikTok && <>⚠️ TikTok: descarga el video manualmente y súbelo</>}
            {!isYouTube && !isInstagram && !isTikTok && <>URL no reconocida</>}
          </div>
        )}

        <Button
          type="submit"
          disabled={!isSupported || isBusy}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-semibold gap-2"
        >
          {stage === 'idle' && <><Link className="w-4 h-4" />Importar video</>}
          {stage === 'downloading' && <><Loader2 className="w-4 h-4 animate-spin" />Descargando...</>}
          {stage === 'processing' && <><Loader2 className="w-4 h-4 animate-spin" />Transcribiendo...</>}
          {stage === 'done' && <><CheckCircle2 className="w-4 h-4" />Completado</>}
        </Button>
      </form>

      {/* Progress label */}
      {isBusy && (
        <p className="text-xs text-zinc-500 text-center animate-pulse">
          {STAGE_LABELS[stage]} Esto puede tardar 1–3 minutos según la duración.
        </p>
      )}

      <p className="text-xs text-zinc-600 text-center">
        Soportado: YouTube · Límite: 30 min por video
      </p>
    </div>
  );
}
