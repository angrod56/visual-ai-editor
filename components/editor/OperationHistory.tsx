'use client';

import { useState } from 'react';
import { EditOperation, EditPlan } from '@/types';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, HelpCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_ICONS = {
  pending: Clock,
  processing: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
  needs_clarification: HelpCircle,
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-900/40 text-yellow-300 border-yellow-700',
  processing: 'bg-blue-900/40 text-blue-300 border-blue-700',
  completed: 'bg-green-900/40 text-green-300 border-green-700',
  failed: 'bg-red-900/40 text-red-300 border-red-700',
  needs_clarification: 'bg-orange-900/40 text-orange-300 border-orange-700',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En cola',
  processing: 'Procesando',
  completed: 'Completado',
  failed: 'Error',
  needs_clarification: 'Necesita aclaración',
};

interface Props {
  operations: EditOperation[];
}

export function OperationHistory({ operations }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (operations.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        <p>No hay ediciones aún.</p>
        <p className="text-xs mt-1">Escribe una instrucción para comenzar.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-72">
      <div className="space-y-2 pr-2">
        {[...operations].reverse().map((op) => {
          const Icon = STATUS_ICONS[op.status] ?? Clock;
          const plan = op.ai_interpretation as EditPlan;
          const isExpanded = expanded === op.id;

          return (
            <div
              key={op.id}
              className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden"
            >
              <button
                onClick={() => setExpanded(isExpanded ? null : op.id)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-700/50 transition-colors"
              >
                <Icon
                  className={cn(
                    'w-4 h-4 shrink-0',
                    op.status === 'completed' ? 'text-green-400' :
                    op.status === 'failed' ? 'text-red-400' :
                    op.status === 'processing' ? 'text-blue-400 animate-spin' :
                    'text-slate-400'
                  )}
                />
                <p className="flex-1 text-sm text-slate-300 truncate">{op.instruction}</p>
                <Badge
                  className={cn('shrink-0 text-xs border', STATUS_COLORS[op.status])}
                >
                  {STATUS_LABELS[op.status]}
                </Badge>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-slate-700 pt-2">
                  {plan?.description && (
                    <p className="text-xs text-slate-400">
                      <span className="text-slate-500">Plan:</span> {plan.description}
                    </p>
                  )}
                  {op.error_message && (
                    <p className="text-xs text-red-400">{op.error_message}</p>
                  )}
                  {op.processing_time_ms != null && (
                    <p className="text-xs text-slate-500">
                      Tiempo: {(op.processing_time_ms / 1000).toFixed(1)}s
                    </p>
                  )}
                  {plan?.ffmpeg_operations?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500">Operaciones FFmpeg:</p>
                      {plan.ffmpeg_operations.map((ffop) => (
                        <p key={ffop.step} className="text-xs text-slate-500 font-mono pl-2">
                          {ffop.step}. {ffop.command_type}: {ffop.description}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
