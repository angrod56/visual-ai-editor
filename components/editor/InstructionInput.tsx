'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { toast } from 'sonner';

const SUGGESTION_CHIPS = [
  'Recorta del minuto 2:30 al 4:15',
  'Agrega subtítulos automáticos en español',
  'Genera un Reel de 60 segundos',
  'Elimina los silencios del video',
  'Crea una versión para TikTok (30 segundos)',
  'Extrae el audio en MP3',
  'Aumenta la velocidad al 1.5x',
  'Recorta solo la parte donde hablo de introducción',
];

interface Props {
  projectId: string;
  projectReady: boolean;
  onOperationStarted: (operationId: string) => void;
}

export function InstructionInput({ projectId, projectReady, onOperationStarted }: Props) {
  const [instruction, setInstruction] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!instruction.trim() || isProcessing || !projectReady) return;
    setIsProcessing(true);

    try {
      // Step 1: create operation record — returns immediately
      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, instruction }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'Error al iniciar la edición');
        return;
      }

      const { operation_id } = data;
      onOperationStarted(operation_id);
      setInstruction('');
      toast.success('Edición iniciada. Claude está procesando...');

      // Step 2: fire-and-forget the heavy processing
      // Server updates operation status via Supabase → Realtime pushes to ProcessingStatus
      fetch(`/api/edit/${operation_id}/process`, { method: 'POST', keepalive: true }).catch(() => {});
    } catch {
      toast.error('Error de conexión. Intenta de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder={
            projectReady
              ? "Describe qué quieres hacer con el video...\nEj: 'Recorta del minuto 1:30 al 3:45 y agrega subtítulos en español'"
              : 'Esperando que el video termine de procesarse...'
          }
          disabled={!projectReady || isProcessing}
          rows={3}
          className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-purple-500 resize-none pr-36 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
        />
        <Button
          onClick={handleSubmit}
          disabled={isProcessing || !instruction.trim() || !projectReady}
          className="absolute bottom-3 right-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs px-3 py-1.5 h-auto"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Editar con IA
            </>
          )}
        </Button>
      </div>

      <div className="text-xs text-slate-600">
        Tip: <kbd className="bg-slate-800 border border-slate-700 rounded px-1 py-0.5">⌘ Enter</kbd> para enviar
      </div>

      {/* Suggestion chips */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => setInstruction(chip)}
            disabled={!projectReady}
            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full transition-colors text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {chip}
          </button>
        ))}
      </div>

      <QuickActions onSelect={setInstruction} />
    </div>
  );
}
