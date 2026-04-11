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

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    label: 'En cola...',
    color: 'text-yellow-400',
    bg: 'bg-yellow-900/20 border-yellow-800',
  },
  processing: {
    icon: Loader2,
    label: 'Claude está interpretando tu instrucción...',
    color: 'text-blue-400',
    bg: 'bg-blue-900/20 border-blue-800',
    spin: true,
  },
  completed: {
    icon: CheckCircle2,
    label: '¡Video editado exitosamente!',
    color: 'text-green-400',
    bg: 'bg-green-900/20 border-green-800',
  },
  failed: {
    icon: XCircle,
    label: 'Error al procesar',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-800',
  },
  needs_clarification: {
    icon: HelpCircle,
    label: 'Necesito más información',
    color: 'text-orange-400',
    bg: 'bg-orange-900/20 border-orange-800',
  },
};

export function ProcessingStatus({ operationId, onCompleted }: Props) {
  const [operation, setOperation] = useState<EditOperation | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Initial fetch
    supabase
      .from('edit_operations')
      .select('*')
      .eq('id', operationId)
      .single()
      .then(({ data }) => {
        if (data) setOperation(data as EditOperation);
      });

    // Realtime subscription
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
      supabase.removeChannel(channel);
    };
  }, [operationId, onCompleted]);

  if (!operation) return null;

  const config = STATUS_CONFIG[operation.status];
  const Icon = config.icon;
  const plan = operation.ai_interpretation as EditPlan;

  return (
    <div className={cn('p-4 rounded-xl border', config.bg)}>
      <div className="flex items-start gap-3">
        <Icon
          className={cn('w-5 h-5 mt-0.5 shrink-0', config.color, 'spin' in config && config.spin && 'animate-spin')}
        />
        <div className="flex-1 min-w-0">
          <p className={cn('font-medium text-sm', config.color)}>{config.label}</p>

          {plan?.description && (
            <p className="text-xs text-slate-400 mt-1">Plan: {plan.description}</p>
          )}

          {plan?.confidence != null && plan.confidence < 0.8 && (
            <p className="text-xs text-yellow-500 mt-1">
              Confianza: {Math.round(plan.confidence * 100)}% — revisa el resultado
            </p>
          )}

          {plan?.clarification_question && operation.status === 'needs_clarification' && (
            <p className="text-xs text-orange-300 mt-2 italic">
              &ldquo;{plan.clarification_question}&rdquo;
            </p>
          )}

          {operation.error_message && (
            <p className="text-xs text-red-400 mt-1">{operation.error_message}</p>
          )}

          {operation.processing_time_ms != null && operation.status === 'completed' && (
            <p className="text-xs text-slate-500 mt-1">
              Procesado en {(operation.processing_time_ms / 1000).toFixed(1)}s
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
