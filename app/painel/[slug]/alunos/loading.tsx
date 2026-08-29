/**
 * Esqueleto da Gestão de Alunos. Reproduz a barra de título + ações e o layout
 * de duas colunas (lista à esquerda, ficha à direita), evitando o salto de
 * layout quando a base carrega do Supabase.
 */
export default function CarregandoAlunos() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      {/* Breadcrumbs + título */}
      <div className="skeleton h-4 w-32 rounded" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="skeleton h-7 w-40 rounded-lg" />
          <div className="skeleton h-4 w-64 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton h-10 w-32 rounded-xl" />
          <div className="skeleton h-10 w-28 rounded-xl" />
        </div>
      </div>

      {/* Lista (1fr) + ficha (1.5fr) */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <div className="surface space-y-2 rounded-2xl p-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl p-3">
              <div className="skeleton h-2 w-2 flex-none rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-2/3 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
        <div className="skeleton h-96 w-full rounded-2xl" />
      </div>
    </div>
  );
}
