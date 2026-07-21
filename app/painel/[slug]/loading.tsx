/**
 * Skeleton de carregamento do painel. O Next.js mostra isto INSTANTANEAMENTE
 * ao navegar entre seções (Alunos, Financeiro, Loja, etc.), enquanto o servidor
 * prepara a página real. Sem isto, a tela anterior ficava congelada até a
 * resposta do servidor — dando a sensação de lentidão/travamento.
 */
export default function CarregandoPainel() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Carregando">
      {/* Título */}
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-ink-700/70" />
        <div className="h-4 w-72 rounded bg-ink-800" />
      </div>

      {/* Linha de cartões de métricas */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface rounded-2xl p-4">
            <div className="h-3 w-20 rounded bg-ink-700/70" />
            <div className="mt-3 h-6 w-16 rounded bg-ink-700/70" />
          </div>
        ))}
      </div>

      {/* Bloco de conteúdo principal */}
      <div className="surface space-y-3 rounded-2xl p-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-10 w-10 flex-none rounded-lg bg-ink-700/70" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-ink-700/70" />
              <div className="h-3 w-1/4 rounded bg-ink-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
