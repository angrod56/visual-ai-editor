export default function ProjectsLoading() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 bg-slate-800 rounded w-40" />
        <div className="h-9 bg-slate-800 rounded w-32" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-slate-800 rounded-xl overflow-hidden">
            <div className="aspect-video bg-slate-700" />
            <div className="p-4 space-y-2">
              <div className="h-4 bg-slate-700 rounded w-3/4" />
              <div className="h-3 bg-slate-700 rounded w-1/2" />
              <div className="h-8 bg-slate-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
