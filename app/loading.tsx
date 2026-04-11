import { Loader2 } from 'lucide-react';

export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex items-center gap-3 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
        <span className="text-sm">Cargando...</span>
      </div>
    </div>
  );
}
