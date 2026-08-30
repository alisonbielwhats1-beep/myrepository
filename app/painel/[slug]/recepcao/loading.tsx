/**
 * Esqueleto da Recepção & Catraca. Reproduz a barra de título, os 4 stat tiles
 * e o painel de liberação + log, para a troca pelo conteúdo real não deslocar
 * nada na tela.
 */
export default function CarregandoRecepcao() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      {/* Breadcrumbs + título */}
      <div className="skeleton h-4 w-40 rounded" />
      <div className="space-y-2">
        <div className="skeleton h-7 w-56 rounded-lg" />
        <div className="skeleton h-4 w-72 rounded" />
      </div>

      {/* 4 stat tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface rounded-2xl p-4">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton mt-3 h-6 w-16 rounded" />
          </div>
        ))}
      </div>

      {/* Liberar entrada (1fr) + Log da catraca (1.35fr) */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
        <div className="skeleton h-64 w-full rounded-2xl" />
        <div className="surface space-y-3 rounded-2xl p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton h-4 w-12 rounded" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-1/3 rounded" />
                <div className="skeleton h-3 w-1/4 rounded" />
              </div>
              <div className="skeleton h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
