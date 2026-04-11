'use client';

import { useState } from 'react';
import { Loader2, Sparkles, ArrowRight, Target, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface StrategyItem {
  stage_number: number;
  stage: string;
  stage_color: string;
  topic: string;
  hook: string;
  objective: string;
  angle: string;
  cta_idea: string;
}

interface Props {
  defaultNiche?: string;
  defaultAudience?: string;
  defaultCta?: string;
  onSelectTopic: (item: StrategyItem) => void;
}

const COLOR_MAP: Record<string, { badge: string; border: string; dot: string }> = {
  red:    { badge: 'bg-red-500/20 text-red-400 border-red-500/30',    border: 'border-red-500/20',    dot: 'bg-red-400' },
  orange: { badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30', border: 'border-orange-500/20', dot: 'bg-orange-400' },
  yellow: { badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', border: 'border-yellow-500/20', dot: 'bg-yellow-400' },
  green:  { badge: 'bg-green-500/20 text-green-400 border-green-500/30',  border: 'border-green-500/20',  dot: 'bg-green-400' },
  teal:   { badge: 'bg-teal-500/20 text-teal-400 border-teal-500/30',   border: 'border-teal-500/20',   dot: 'bg-teal-400' },
  blue:   { badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',   border: 'border-blue-500/20',   dot: 'bg-blue-400' },
  indigo: { badge: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', border: 'border-indigo-500/20', dot: 'bg-indigo-400' },
  violet: { badge: 'bg-violet-500/20 text-violet-400 border-violet-500/30', border: 'border-violet-500/20', dot: 'bg-violet-400' },
  purple: { badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30', border: 'border-purple-500/20', dot: 'bg-purple-400' },
  pink:   { badge: 'bg-pink-500/20 text-pink-400 border-pink-500/30',   border: 'border-pink-500/20',   dot: 'bg-pink-400' },
};

const FIELD = 'w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors';

export function ContentStrategy({ defaultNiche = '', defaultAudience = '', defaultCta = '', onSelectTopic }: Props) {
  const [product, setProduct]   = useState('');
  const [niche, setNiche]       = useState(defaultNiche);
  const [audience, setAudience] = useState(defaultAudience);
  const [cta, setCta]           = useState(defaultCta);
  const [loading, setLoading]   = useState(false);
  const [plan, setPlan]         = useState<StrategyItem[]>([]);

  const generate = async () => {
    if (!product.trim()) { toast.error('Describe tu producto o servicio'); return; }
    setLoading(true);
    setPlan([]);
    try {
      const res = await fetch('/api/carousels/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, niche, audience, cta }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Error al generar'); return; }
      setPlan(data.plan ?? []);
      toast.success('Plan de contenido generado');
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Form ── */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-white">Tu negocio</span>
        </div>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Producto o servicio *</label>
          <input
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generate()}
            placeholder="ej: consultoría de marketing digital para coaches"
            className={FIELD}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Nicho</label>
            <input value={niche} onChange={(e) => setNiche(e.target.value)}
              placeholder="ej: salud y bienestar" className={FIELD} />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Audiencia objetivo</label>
            <input value={audience} onChange={(e) => setAudience(e.target.value)}
              placeholder="ej: emprendedores 30-45 años" className={FIELD} />
          </div>
        </div>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">CTA principal de tu negocio</label>
          <input value={cta} onChange={(e) => setCta(e.target.value)}
            placeholder="ej: Agenda tu llamada gratuita" className={FIELD} />
        </div>

        <Button
          onClick={generate}
          disabled={loading || !product.trim()}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-black font-semibold gap-2"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" />Generando plan de 10 carruseles...</>
            : <><Sparkles className="w-4 h-4" />Generar plan de contenido (10 carruseles)</>
          }
        </Button>
      </div>

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-zinc-800/60 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Plan cards ── */}
      {plan.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-white">Tu embudo de contenido</span>
            <span className="text-xs text-zinc-500 ml-auto">{plan.length} carruseles · del frío al cliente</span>
          </div>

          {plan.map((item) => {
            const colors = COLOR_MAP[item.stage_color] ?? COLOR_MAP.blue;
            return (
              <div
                key={item.stage_number}
                className={cn(
                  'group bg-zinc-900/70 border rounded-xl p-4 transition-all duration-150 hover:bg-zinc-800/80',
                  colors.border
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Stage number */}
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5', colors.dot)}>
                    <span className="text-xs font-bold text-black">{item.stage_number}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Stage badge + topic */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide', colors.badge)}>
                        {item.stage}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-white leading-snug mb-1">
                      {item.topic}
                    </p>

                    {/* Hook preview */}
                    <p className="text-xs text-amber-400/80 italic mb-1.5">
                      &ldquo;{item.hook}&rdquo;
                    </p>

                    {/* Angle */}
                    <p className="text-xs text-zinc-500 leading-relaxed mb-2">
                      {item.angle}
                    </p>

                    {/* CTA idea */}
                    <p className="text-xs text-zinc-600">
                      CTA: <span className="text-zinc-400">{item.cta_idea}</span>
                    </p>
                  </div>

                  {/* Action button */}
                  <Button
                    size="sm"
                    onClick={() => onSelectTopic(item)}
                    className="shrink-0 h-8 bg-zinc-700 hover:bg-amber-500 hover:text-black text-zinc-300 text-xs gap-1.5 transition-all opacity-0 group-hover:opacity-100"
                  >
                    Crear
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}

          <p className="text-xs text-zinc-600 text-center pt-2">
            Haz hover en cualquier carrusel y haz clic en &ldquo;Crear&rdquo; para generarlo
          </p>
        </div>
      )}
    </div>
  );
}
