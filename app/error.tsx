'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Algo salió mal</h2>
        <p className="text-slate-400 text-sm">{error.message || 'Error inesperado en la aplicación'}</p>
        <Button onClick={reset} className="bg-purple-600 hover:bg-purple-700 text-white">
          Intentar de nuevo
        </Button>
      </div>
    </div>
  );
}
