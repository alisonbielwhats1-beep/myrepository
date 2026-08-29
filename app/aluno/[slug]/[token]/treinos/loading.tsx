/**
 * Esqueleto da aba de Treinos do aluno. Mostra a régua de dias da semana e o
 * card do treino do dia com a forma real, para não haver salto quando os dados
 * chegam do Supabase.
 */
export default function CarregandoTreinos() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      {/* Header: "Seu treino / Treinos" + chip do dia */}
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-6 w-32 rounded-lg" />
        </div>
        <div className="skeleton h-7 w-20 rounded-full" />
      </div>

      {/* Régua de 7 chips de dia */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="skeleton h-11 w-full rounded-xl" />
        ))}
      </div>

      {/* Card do treino do dia */}
      <div className="skeleton h-56 w-full rounded-2xl" />

      {/* Resto do plano */}
      <div className="space-y-2">
        <div className="skeleton h-3 w-28 rounded" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-14 w-full rounded-2xl" />
        ))}
      </div>

      <span className="sr-only">Carregando</span>
    </div>
  );
}
