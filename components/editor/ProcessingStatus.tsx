'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { EditOperation, EditPlan } from '@/types';
import { CheckCircle2, XCircle, HelpCircle, Loader2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  operationId: string;
  onCompleted?: () => void;
}

// Steps in order — used to derive progress %
const STEPS = [
  'Interpretando instrucción con IA...',
  'Preparando edición...',
  'Descargando video...',
  'Ejecutando edición con FFmpeg...',
  'Subiendo resultado...',
];

function stepIndex(step: string): number {
  const idx = STEPS.indexOf(step);
  return idx === -1 ? 0 : idx;
}

function stepProgress(step: string | null): number {
  if (!step) return 5;
  const idx = stepIndex(step);
  // Map 0..4 → 10%..85%
  return 10 + Math.round((idx / (STEPS.length - 1)) * 75);
}

export function ProcessingStatus({ operationId, onCompleted }: Props) {
  const [operation, setOperation] = useState<EditOperation | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from('edit_operations')
      .select('*')
      .eq('id', operationId)
      .single()
      .then(({ data }) => {
        if (data) setOperation(data as EditOperation);
      });

    const fallbackTimer = setTimeout(async () => {
      const { data } = await supabase
        .from('edit_operations')
        .select('status')
        .eq('id', operationId)
        .single();

      if (data?.status === 'pending') {
        fetch(`/api/edit/${operationId}/process`, {
          method: 'POST',
          keepalive: true,
        }).catch(() => {});
      }
    }, 3000);

    const channel = supabase
      .channel(`operation-${operationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'edit_operations',
          filter: `id=eq.${operationId}`,
        },
        (payload) => {
          const updated = payload.new as EditOperation;
          setOperation(updated);
          if (updated.status === 'completed' && onCompleted) {
            onCompleted();
          }
        }
      )
      .subscribe();

    return () => {
      clearTimeout(fallbackTimer);
      supabase.removeChannel(channel);
    };
  }, [operationId, onCompleted]);

  if (!operation) return null;

  const plan = operation.ai_interpretation as (EditPlan & { _progress?: string }) | null;
  const progressStep: string | null = plan?._progress ?? null;
  const isProcessing = operation.status === 'processing';
  const isCompleted = operation.status === 'completed';
  const isFailed = operation.status === 'failed';
  const needsClarification = operation.status === 'needs_clarification';
  const isPending = operation.status === 'pending';

  // ── Completed ───────────────────────────────────────────────────────────────
  if (isCompleted) {
    return (
      <div className="p-4 rounded-xl border bg-green-900/20 border-green-800">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-green-400">¡Video editado exitosamente!</p>
            {plan?.description && !plan._progress && (
              <p className="text-xs text-zinc-400 mt-0.5 truncate">Plan: {plan.description}</p>
            )}
            {operation.processing_time_ms != null && (
              <p className="text-xs text-zinc-500 mt-0.5">
                Procesado en {(operation.processing_time_ms / 1000).toFixed(1)}s
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Failed ───────────────────────────────────────────────────────────────────
  if (isFailed) {
    return (
      <div className="p-4 rounded-xl border bg-red-900/20 border-red-800">
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-red-400">Error al procesar</p>
            {operation.error_message && (
              <p className="text-xs text-red-400/70 mt-0.5">{operation.error_message}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Needs clarification ───────────────────────────────────────────────────────
  if (needsClarification) {
    return (
      <div className="p-4 rounded-xl border bg-orange-900/20 border-orange-800">
        <div className="flex items-center gap-3">
          <HelpCircle className="w-5 h-5 text-orange-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-orange-400">Necesito más información</p>
            {plan?.clarification_question && (
              <p className="text-xs text-orange-300 mt-1 italic">&ldquo;{plan.clarification_question}&rdquo;</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Pending ───────────────────────────────────────────────────────────────────
  if (isPending) {
    return (
      <div className="p-4 rounded-xl border bg-yellow-900/20 border-yellow-800">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-yellow-400 shrink-0" />
          <p className="font-medium text-sm text-yellow-400">En cola...</p>
        </div>
      </div>
    );
  }

  // ── Processing — step-by-step progress ───────────────────────────────────────
  const pct = isProcessing ? stepProgress(progressStep) : 0;
  const displayLabel = progressStep ?? 'Iniciando...';

  return (
    <div className="p-4 rounded-xl border bg-blue-900/20 border-blue-800 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-blue-400 shrink-0 animate-spin" />
        <p className="font-medium text-sm text-blue-400 flex-1 truncate">{displayLabel}</p>
        <span className="text-xs text-blue-400/60 tabular-nums shrink-0">{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-blue-900/40 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-400 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Step dots */}
      <div className="flex items-center gap-1.5">
        {STEPS.map((step, i) => {
          const currentIdx = stepIndex(progressStep ?? '');
          const done = i < currentIdx;
          const active = i === currentIdx && !!progressStep;
          return (
            <div
              key={step}
              title={step}
              className={cn(
                'flex-1 h-1 rounded-full transition-all duration-500',
                done ? 'bg-blue-400' : active ? 'bg-blue-400/70' : 'bg-blue-900/50'
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
