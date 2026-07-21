/**
 * Skeleton das sub-abas do Financeiro (Visão geral / Receitas / Despesas).
 * Mostrado instantaneamente ao trocar de sub-aba, enquanto os dados carregam.
 */
export default function CarregandoFinanceiro() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Carregando">
      {/* Barra de filtro de período */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-10 w-64 rounded-xl bg-ink-800" />
        <div className="h-9 w-40 rounded-lg bg-ink-800" />
      </div>

      {/* Cartões-resumo */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface rounded-2xl p-4">
            <div className="h-3 w-24 rounded bg-ink-700/70" />
            <div className="mt-3 h-6 w-20 rounded bg-ink-700/70" />
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="surface space-y-3 rounded-2xl p-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="h-4 w-1/3 rounded bg-ink-700/70" />
            <div className="h-4 w-16 rounded bg-ink-700/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
