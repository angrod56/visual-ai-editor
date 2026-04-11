'use client';

import { useState } from 'react';
import { EditOperation, EditPlan } from '@/types';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, HelpCircle, Loader2, Trash2, StopCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  onDeleted?: (id: string) => void;
  onOperationStarted?: (id: string) => void;
}

export function OperationHistory({ operations, onDeleted, onOperationStarted }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [clarifications, setClarifications] = useState<Record<string, string>>({});
  const [replying, setReplying] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, opId: string) => {
    e.stopPropagation();
    setDeleting(opId);
    try {
      const res = await fetch(`/api/operations/${opId}`, { method: 'DELETE' });
      if (res.ok) {
        onDeleted?.(opId);
        toast.success('Operación eliminada');
      } else {
        toast.error('Error al eliminar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setDeleting(null);
    }
  };

  const handleCancel = async (e: React.MouseEvent, opId: string) => {
    e.stopPropagation();
    setCancelling(opId);
    try {
      const res = await fetch(`/api/operations/${opId}/cancel`, { method: 'POST' });
      if (res.ok) {
        onDeleted?.(opId);
        toast.success('Operación cancelada');
      } else {
        toast.error('Error al cancelar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setCancelling(null);
    }
  };

  const handleReply = async (op: EditOperation) => {
    const answer = clarifications[op.id]?.trim();
    if (!answer) return;
    setReplying(op.id);
    try {
      const combinedInstruction = `${op.instruction}. Aclaración: ${answer}`;
      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: op.project_id, instruction: combinedInstruction }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Error al enviar respuesta'); return; }
      // Remove old clarification op and start new one
      onDeleted?.(op.id);
      onOperationStarted?.(data.operation_id);
      setClarifications((p) => { const n = { ...p }; delete n[op.id]; return n; });
      fetch(`/api/edit/${data.operation_id}/process`, { method: 'POST', keepalive: true }).catch(() => {});
      toast.success('Procesando con tu aclaración...');
    } catch {
      toast.error('Error de conexión');
    } finally {
      setReplying(null);
    }
  };

  if (operations.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        <p>No hay ediciones aún.</p>
        <p className="text-xs mt-1">Escribe una instrucción para comenzar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 pr-1">
      {[...operations].reverse().map((op) => {
          const Icon = STATUS_ICONS[op.status] ?? Clock;
          const plan = op.ai_interpretation as EditPlan;
          const isExpanded = expanded === op.id || op.status === 'needs_clarification';
          const canDelete = op.status === 'failed' || op.status === 'needs_clarification';
          const canCancel = op.status === 'pending' || op.status === 'processing';

          return (
            <div
              key={op.id}
              className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden"
            >
              <div
                className="w-full p-3 hover:bg-slate-700/50 transition-colors cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : op.id)}
              >
                {/* Row 1: icon + instruction + chevron */}
                <div className="flex items-center gap-2">
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
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </div>

                {/* Row 2: badge + action buttons */}
                <div className="flex items-center gap-2 mt-2 pl-6">
                  <Badge className={cn('text-xs border', STATUS_COLORS[op.status])}>
                    {STATUS_LABELS[op.status]}
                  </Badge>
                  <div className="flex-1" />
                  {canCancel && (
                    <button
                      onClick={(e) => handleCancel(e, op.id)}
                      disabled={cancelling === op.id}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-orange-400 hover:bg-orange-900/20 rounded transition-colors"
                      title="Detener"
                    >
                      <StopCircle className={cn('w-3.5 h-3.5', cancelling === op.id && 'animate-spin')} />
                      Detener
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={(e) => handleDelete(e, op.id)}
                      disabled={deleting === op.id}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-slate-700 pt-2">
                  {/* Clarification reply UI */}
                  {op.status === 'needs_clarification' && (
                    <div className="space-y-2 p-2.5 bg-orange-900/10 border border-orange-800/40 rounded-lg">
                      {plan?.clarification_question && (
                        <p className="text-xs text-orange-300 font-medium">
                          {plan.clarification_question as string}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={clarifications[op.id] ?? ''}
                          onChange={(e) => setClarifications((p) => ({ ...p, [op.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleReply(op); }}
                          placeholder="Tu respuesta..."
                          className="flex-1 text-xs bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
                        />
                        <button
                          onClick={() => handleReply(op)}
                          disabled={!clarifications[op.id]?.trim() || replying === op.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white text-xs rounded-lg transition-colors"
                        >
                          {replying === op.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Send className="w-3.5 h-3.5" />
                          }
                        </button>
                      </div>
                    </div>
                  )}

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
  );
}
