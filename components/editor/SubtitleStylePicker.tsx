'use client';

import { SUBTITLE_STYLES } from '@/lib/ffmpeg/subtitle-style-defs';
import { cn } from '@/lib/utils';

interface Props {
  selected: string;
  onChange: (id: string) => void;
}

export function SubtitleStylePicker({ selected, onChange }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
        Estilo de subtítulos
      </p>
      <div className="flex flex-wrap gap-2">
        {SUBTITLE_STYLES.map((style) => (
          <button
            key={style.id}
            onClick={() => onChange(style.id)}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-all duration-150',
              'min-w-[72px] text-center',
              selected === style.id
                ? 'border-purple-500 bg-purple-600/20 ring-1 ring-purple-500'
                : `${style.preview.bg} ${style.preview.border} border hover:border-slate-500`
            )}
            title={style.label}
          >
            <span
              className={cn(
                'text-lg font-bold leading-none',
                style.preview.textColor
              )}
            >
              Aa
            </span>
            <span className="text-[10px] text-slate-400 leading-none">{style.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
