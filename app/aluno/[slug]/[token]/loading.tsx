/**
 * Esqueleto da home do aluno. O Next.js mostra isto INSTANTANEAMENTE enquanto
 * o servidor busca o treino de hoje no Supabase — antes a tela ficava em branco
 * e dava sensação de app travado (auditoria de UX, item 1).
 *
 * Cada bloco tem a MESMA forma e altura do conteúdo real (herói do treino,
 * progresso, comunidade, situação, atalhos), então não há salto de layout na
 * troca do esqueleto pelo conteúdo. Shimmer via `.skeleton` (globals.css).
 */
function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton rounded-2xl ${className ?? ""}`} />;
}

export default function CarregandoAluno() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      {/* Saudação (nome da academia + "Olá, ...") e avatar */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32 rounded" />
          <Skeleton className="h-6 w-44 rounded-lg" />
        </div>
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>

      {/* Herói — treino de hoje */}
      <Skeleton className="h-32 w-full" />

      {/* Legenda de espera, exatamente onde ela aparece no conteúdo */}
      <p className="-mt-3 text-[11.5px] text-slate-500">carregando seu treino de hoje…</p>

      {/* Seu progresso */}
      <Skeleton className="h-[132px] w-full" />

      {/* Comunidade */}
      <Skeleton className="h-[88px] w-full" />

      {/* Situação (financeiro + acesso) */}
      <Skeleton className="h-[124px] w-full" />

      {/* Atalhos */}
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-[78px] w-full" />
        <Skeleton className="h-[78px] w-full" />
        <Skeleton className="h-[78px] w-full" />
      </div>

      <span className="sr-only">Carregando</span>
    </div>
  );
}
