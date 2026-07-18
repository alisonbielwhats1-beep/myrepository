import { AlertTriangle } from "lucide-react";

/**
 * Banner amigável exibido quando uma página depende de uma migração SQL que
 * ainda não foi rodada no Supabase — em vez de deixar a página quebrar com
 * um erro cru.
 */
export default function MigracaoPendente({
  arquivo,
  recurso,
}: {
  arquivo: string;
  recurso: string;
}) {
  return (
    <div className="surface flex items-start gap-3 rounded-2xl border-amber-500/30 p-5">
      <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-amber-400" />
      <div>
        <p className="font-semibold text-white">Migração pendente</p>
        <p className="mt-1 text-sm text-slate-400">
          {recurso} precisa da migração{" "}
          <code className="rounded bg-ink-900 px-1.5 py-0.5 text-xs text-volt-300">
            {arquivo}
          </code>
          . Rode-a no SQL Editor do Supabase e recarregue esta página.
        </p>
      </div>
    </div>
  );
}
