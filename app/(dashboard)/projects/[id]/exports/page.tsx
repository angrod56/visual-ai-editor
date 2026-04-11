'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { VideoExport, VideoProject } from '@/types';
import { ExportPanel } from '@/components/editor/ExportPanel';
import { ArrowLeft, Download } from 'lucide-react';

export default function ExportsPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<VideoProject | null>(null);
  const [exports, setExports] = useState<VideoExport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/projects/${id}`).then((r) => r.json()),
      fetch(`/api/projects/${id}/exports`).then((r) => r.json()),
    ])
      .then(([proj, exps]) => {
        setProject(proj);
        setExports(Array.isArray(exps) ? exps : []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/projects/${id}`} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Historial de Exportaciones</h1>
          {project && (
            <p className="text-sm text-slate-400">{project.title}</p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : exports.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Download className="w-10 h-10 mx-auto text-slate-700 mb-3" />
          <p>No hay exportaciones para este proyecto.</p>
          <Link href={`/projects/${id}`} className="text-purple-400 text-sm hover:underline mt-2 block">
            Ir al editor
          </Link>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <ExportPanel exports={exports} />
        </div>
      )}
    </div>
  );
}
