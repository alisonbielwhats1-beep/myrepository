import Link from "next/link";
import { Lock, Zap } from "lucide-react";
import { PlanoSaas, PLANOS_SAAS, labelPlano } from "@/lib/planos";

interface Props {
  recurso: string;
  planoAtual: PlanoSaas;
  planoNecessario: PlanoSaas;
  slug: string;
  titulo?: string;
  descricao?: string;
}

export default function UpgradeGuard({
  planoAtual,
  planoNecessario,
  slug,
  titulo = "Recurso não disponível no seu plano",
  descricao,
}: Props) {
  const planoLabel = labelPlano(planoNecessario);
  const planoAtualLabel = labelPlano(planoAtual);
  const precoPlano = PLANOS_SAAS.find((p) => p.value === planoNecessario)?.preco ?? 0;

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="surface max-w-md rounded-2xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-ink-600 bg-ink-800">
          <Lock className="h-6 w-6 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-white">{titulo}</h2>
        <p className="mt-2 text-sm text-slate-400">
          {descricao ??
            `Você está no plano ${planoAtualLabel}. Este recurso está disponível a partir do plano ${planoLabel}.`}
        </p>

        <div className="my-6 rounded-xl border border-volt-500/30 bg-volt-500/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-volt-400">
            Plano {planoLabel}
          </p>
          <p className="mt-1 text-2xl font-bold text-white">
            R${" "}
            <span className="tabular-nums">
              {precoPlano.toFixed(2).replace(".", ",")}
            </span>
            <span className="text-base font-normal text-slate-400">/mês</span>
          </p>
        </div>

        <Link
          href={`/painel/${slug}/configuracoes#plano`}
          className="btn-volt w-full justify-center"
        >
          <Zap className="h-4 w-4" />
          Fazer upgrade agora
        </Link>
        <p className="mt-3 text-xs text-slate-500">
          Cancele quando quiser. Sem multa.
        </p>
      </div>
    </div>
  );
}
