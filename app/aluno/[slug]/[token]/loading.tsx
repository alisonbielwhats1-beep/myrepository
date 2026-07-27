function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-ink-700/60 ${className ?? ""}`} />;
}

export default function CarregandoAluno() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>

      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-16 w-full" />

      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
