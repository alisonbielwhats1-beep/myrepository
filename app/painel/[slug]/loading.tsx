/**
 * Skeleton de carregamento do painel. O Next.js mostra isto INSTANTANEAMENTE
 * ao navegar entre seções (Alunos, Financeiro, Loja, etc.), enquanto o servidor
 * prepara a página real. Sem isto, a tela anterior ficava congelada até a
 * resposta do servidor — dando a sensação de lentidão/travamento.
 *
 * Shimmer via `.skeleton` (globals.css): a espera parece menor que com um
 * pulse chapado, e os blocos antecipam a forma do conteúdo real.
 */
export default function CarregandoPainel() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      {/* Título */}
      <div className="space-y-2">
        <div className="skeleton h-7 w-48 rounded-lg" />
        <div className="skeleton h-4 w-72 rounded" />
      </div>

      {/* Linha de cartões de métricas */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface rounded-2xl p-4">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton mt-3 h-6 w-16 rounded" />
          </div>
        ))}
      </div>

      {/* Bloco de conteúdo principal */}
      <div className="surface space-y-3 rounded-2xl p-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton h-10 w-10 flex-none rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-1/3 rounded" />
              <div className="skeleton h-3 w-1/4 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
