'use client';

import { useState } from 'react';
import { AdScript } from '@/types';
import { Sparkles, Copy, ImagePlus, ChevronDown, ChevronRight, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PLATFORMS = ['Instagram', 'Facebook', 'TikTok', 'Meta Ads', 'LinkedIn'];
const TONES = ['Profesional', 'Urgencia', 'Aspiracional', 'Emocional', 'Educativo', 'Casual'];

interface Props {
  onUseVisual: (script: AdScript) => void;
}

function TagInput({
  label,
  placeholder,
  color,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  color: 'red' | 'green';
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setInput('');
  };
  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i));
  const colorClass = color === 'red'
    ? 'bg-red-900/30 text-red-300 border-red-700/50'
    : 'bg-green-900/30 text-green-300 border-green-700/50';

  return (
    <div className="space-y-2">
      <label className="text-xs text-zinc-400 block">{label}</label>
      <div className="flex gap-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
        />
        <button
          onClick={add}
          className="p-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v, i) => (
            <span key={i} className={cn('flex items-center gap-1 text-xs px-2 py-1 rounded-lg border', colorClass)}>
              {v}
              <button onClick={() => remove(i)} className="opacity-60 hover:opacity-100">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ScriptGenerator({ onUseVisual }: Props) {
  const [topic, setTopic] = useState('');
  const [niche, setNiche] = useState('');
  const [audience, setAudience] = useState('');
  const [pains, setPains] = useState<string[]>([]);
  const [dreams, setDreams] = useState<string[]>([]);
  const [platform, setPlatform] = useState('Meta Ads');
  const [tone, setTone] = useState('Emocional');
  const [count, setCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [scripts, setScripts] = useState<AdScript[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  const generate = async () => {
    if (!topic.trim()) { toast.error('Escribe el producto o servicio'); return; }
    setLoading(true);
    setScripts([]);
    try {
      const res = await fetch('/api/images/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, niche, audience, pains, dreams, platform, tone, count }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Error al generar scripts'); return; }
      setScripts(data.scripts ?? []);
      setExpanded(data.scripts?.[0]?.id ?? null);
      toast.success(`${data.scripts?.length ?? 0} scripts generados`);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  return (
    <div className="space-y-4">
      {/* Form */}
      <div className="space-y-3">

        {/* Producto */}
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Producto o servicio *</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="ej: crema antiedad, curso de fotografía, app de finanzas..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* Nicho */}
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Nicho de mercado</label>
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="ej: mujeres 35-50 con piel madura, emprendedores digitales latinos..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* Audiencia */}
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Perfil del cliente ideal</label>
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="ej: madre de 40 años, trabaja, quiere verse joven sin cirugías..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* Dolores */}
        <TagInput
          label="Dolores detectados (Enter para agregar)"
          placeholder="ej: no tengo tiempo, lo intenté todo y no funciona..."
          color="red"
          values={pains}
          onChange={setPains}
        />

        {/* Sueños */}
        <TagInput
          label="Sueños y deseos (Enter para agregar)"
          placeholder="ej: verme 10 años más joven, tener libertad financiera..."
          color="green"
          values={dreams}
          onChange={setDreams}
        />

        {/* Platform + Tone */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Plataforma</label>
            <div className="flex flex-wrap gap-1">
              {PLATFORMS.map((p) => (
                <button key={p} onClick={() => setPlatform(p)}
                  className={cn('px-2 py-1 text-xs rounded-md border transition-colors',
                    platform === p ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300')}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Tono</label>
            <div className="flex flex-wrap gap-1">
              {TONES.map((t) => (
                <button key={t} onClick={() => setTone(t)}
                  className={cn('px-2 py-1 text-xs rounded-md border transition-colors',
                    tone === t ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300')}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Count + CTA */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-400">Scripts:</label>
            {[2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setCount(n)}
                className={cn('w-7 h-7 text-xs rounded-md border transition-colors',
                  count === n ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300')}>
                {n}
              </button>
            ))}
          </div>
          <Button onClick={generate} disabled={loading}
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-2" size="sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Generando...' : 'Generar scripts'}
          </Button>
        </div>
      </div>

      {/* Scripts */}
      {scripts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Scripts generados</p>
          {scripts.map((script) => {
            const isOpen = expanded === script.id;
            return (
              <div key={script.id} className="bg-zinc-800/60 border border-zinc-700 rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-start gap-3 p-3 hover:bg-zinc-700/40 transition-colors text-left"
                  onClick={() => setExpanded(isOpen ? null : script.id)}
                >
                  <span className="w-5 h-5 shrink-0 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center mt-0.5">
                    {script.id}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium leading-snug">{script.hook}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{script.cta}</p>
                  </div>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" /> : <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />}
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 space-y-3 border-t border-zinc-700 pt-3">
                    <div className="flex items-start justify-between gap-2">
                      <div><p className="text-xs text-amber-400 font-medium mb-0.5">HOOK</p><p className="text-sm text-white">{script.hook}</p></div>
                      <button onClick={() => copyText(script.hook, 'Hook')} className="text-zinc-500 hover:text-zinc-300 shrink-0"><Copy className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div><p className="text-xs text-zinc-400 font-medium mb-0.5">CUERPO</p><p className="text-sm text-zinc-300">{script.body}</p></div>
                      <button onClick={() => copyText(script.body, 'Cuerpo')} className="text-zinc-500 hover:text-zinc-300 shrink-0"><Copy className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div><p className="text-xs text-green-400 font-medium mb-0.5">CTA</p><p className="text-sm text-white font-semibold">{script.cta}</p></div>
                      <button onClick={() => copyText(script.cta, 'CTA')} className="text-zinc-500 hover:text-zinc-300 shrink-0"><Copy className="w-3.5 h-3.5" /></button>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 font-medium mb-1">HASHTAGS</p>
                      <div className="flex flex-wrap gap-1">
                        {script.hashtags.map((tag) => (
                          <Badge key={tag} className="text-xs bg-zinc-700/60 text-zinc-400 border-zinc-600 cursor-pointer hover:text-white" onClick={() => copyText(tag, 'Hashtag')}>{tag}</Badge>
                        ))}
                        <button onClick={() => copyText(script.hashtags.join(' '), 'Hashtags')} className="text-xs text-zinc-600 hover:text-zinc-400 ml-1">copiar todos</button>
                      </div>
                    </div>
                    <div className="p-2.5 bg-zinc-900/60 border border-zinc-700 rounded-lg">
                      <p className="text-xs text-sky-400 font-medium mb-1">DESCRIPCIÓN VISUAL (para imagen)</p>
                      <p className="text-xs text-zinc-400 leading-relaxed">{script.visual_description}</p>
                    </div>
                    <Button size="sm" className="w-full bg-sky-600 hover:bg-sky-700 text-white gap-2"
                      onClick={() => { onUseVisual(script); toast.success('Descripción enviada al generador'); }}>
                      <ImagePlus className="w-4 h-4" />
                      Usar descripción para generar imágenes
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
