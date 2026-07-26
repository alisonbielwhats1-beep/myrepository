export default function DemoBanner() {
  return (
    <div className="no-print flex items-center justify-center gap-2 border-b border-amber-400/30 bg-amber-400/10 px-4 py-2 text-center text-xs font-medium text-amber-300">
      <span aria-hidden="true">⚠</span>
      Ambiente de demonstração — todos os dados são fictícios e destinados
      exclusivamente a apresentações comerciais.
    </div>
  );
}
