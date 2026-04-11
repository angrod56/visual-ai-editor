'use client';

interface Props {
  onSelect: (instruction: string) => void;
}

const QUICK_ACTIONS = [
  { label: '📱 Reel Instagram', instruction: 'Genera un Reel de 60 segundos con los mejores momentos para Instagram' },
  { label: '🎵 TikTok 30s', instruction: 'Crea una versión corta de 30 segundos en formato vertical para TikTok' },
  { label: '🔇 Sin silencios', instruction: 'Elimina todos los silencios del video' },
  { label: '📝 Subtítulos', instruction: 'Agrega subtítulos automáticos en español' },
  { label: '🎵 Extraer audio', instruction: 'Extrae el audio del video en formato MP3' },
  { label: '⚡ 1.5x velocidad', instruction: 'Aumenta la velocidad del video a 1.5x' },
];

export function QuickActions({ onSelect }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones rápidas</p>
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => onSelect(action.instruction)}
            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 rounded-full transition-all duration-150 text-slate-300 hover:text-white"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
