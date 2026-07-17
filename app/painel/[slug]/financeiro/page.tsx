import Image from "next/image";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";
import StatTile from "@/components/painel/StatTile";
import { getAcademia, getAcessos, getAlunos, getPlanos } from "@/lib/data";
import { cn, formatBRL } from "@/lib/utils";

export default async function FinanceiroPage({
  params,
}: {
  params: { slug: string };
}) {
  const academia = await getAcademia(params.slug);
  const alunos = await getAlunos(academia?.id ?? "");
  const planos = await getPlanos(academia?.id ?? "");
  const acessos = await getAcessos(academia?.id ?? "");

  const planoPorId = new Map(planos.map((p) => [p.id, p]));

  // Assinaturas = alunos com plano. Status de pagamento derivado da matrícula.
  const assinaturas = alunos.map((a) => {
    const plano = a.plano_id ? planoPorId.get(a.plano_id) : undefined;
    const pago = a.status_matricula === "ativa";
    return {
      aluno: a,
      plano,
      valor: plano?.valor_mensal ?? 0,
      status: pago ? "pago" : a.status_matricula === "pendente" ? "pendente" : "atrasado",
    };
  });

  const mrr = assinaturas
    .filter((s) => s.status === "pago")
    .reduce((acc, s) => acc + s.valor, 0);
  const aReceber = assinaturas
    .filter((s) => s.status !== "pago")
    .reduce((acc, s) => acc + s.valor, 0);
  const repasseParcerias = acessos.reduce(
    (acc, a) => acc + (a.valor_repasse ?? 0),
    0
  );
  const faturamentoTotal = mrr + repasseParcerias;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Financeiro</h1>
        <p className="text-sm text-slate-400">
          Assinaturas, recebimentos e repasses de parcerias.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={DollarSign}
          label="MRR (recorrente)"
          value={formatBRL(mrr)}
          hint="Assinaturas ativas"
          accent="volt"
        />
        <StatTile
          icon={Wallet}
          label="Repasse parcerias"
          value={formatBRL(repasseParcerias)}
          hint="Gympass + TotalPass"
          accent="cyan"
        />
        <StatTile
          icon={TrendingUp}
          label="Faturamento total"
          value={formatBRL(faturamentoTotal)}
          hint="MRR + repasses"
          accent="magenta"
        />
        <StatTile
          icon={Clock}
          label="A receber"
          value={formatBRL(aReceber)}
          hint="Pendentes / atrasados"
          accent="slate"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,320px)]">
        {/* Tabela de assinaturas */}
        <div className="surface overflow-hidden rounded-2xl">
          <div className="border-b border-ink-700 px-5 py-4">
            <h2 className="font-semibold text-white">Assinaturas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Aluno</th>
                  <th className="px-5 py-3 font-medium">Plano</th>
                  <th className="px-5 py-3 font-medium">Valor</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/70">
                {assinaturas.map((s) => (
                  <tr key={s.aluno.id} className="hover:bg-ink-700/30">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-ink-600">
                          {s.aluno.foto_perfil_url ? (
                            <Image
                              src={s.aluno.foto_perfil_url}
                              alt={s.aluno.nome}
                              fill
                              sizes="36px"
                              className="media-native object-cover"
                            />
                          ) : (
                            <div className="grid h-full place-items-center bg-ink-700 text-slate-500">
                              <UserRound className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <span className="font-medium text-white">
                          {s.aluno.nome}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-300">
                      {s.plano?.nome ?? "—"}
                    </td>
                    <td className="px-5 py-3 font-medium text-white">
                      {formatBRL(s.valor)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusPagamento status={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Planos oferecidos */}
        <div className="space-y-4">
          <div className="surface rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-semibold text-white">
              <CreditCard className="h-4 w-4 text-volt-300" /> Planos
            </h2>
            <div className="mt-4 space-y-3">
              {planos.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-ink-600 bg-ink-900/40 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white">{p.nome}</p>
                    <p className="font-bold text-volt-300">
                      {formatBRL(p.valor_mensal)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{p.descricao}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    Recorrência: {p.recorrencia_meses}{" "}
                    {p.recorrencia_meses === 1 ? "mês" : "meses"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="surface rounded-2xl p-5">
            <h3 className="label-muted">Balanço do mês</h3>
            <div className="mt-3 space-y-2 text-sm">
              <Linha
                icon={ArrowUpRight}
                cor="text-volt-300"
                label="Entradas"
                valor={formatBRL(faturamentoTotal)}
              />
              <Linha
                icon={ArrowDownRight}
                cor="text-red-400"
                label="Repasse a parceiros"
                valor={`- ${formatBRL(repasseParcerias)}`}
              />
              <div className="mt-2 border-t border-ink-700 pt-2">
                <Linha
                  icon={DollarSign}
                  cor="text-white"
                  label="Líquido estimado"
                  valor={formatBRL(faturamentoTotal - repasseParcerias)}
                  destaque
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPagamento({ status }: { status: string }) {
  if (status === "pago")
    return (
      <span className="chip border-volt-500/30 bg-volt-500/10 text-volt-300">
        <CheckCircle2 className="h-3.5 w-3.5" /> Pago
      </span>
    );
  if (status === "pendente")
    return (
      <span className="chip border-amber-500/30 bg-amber-500/10 text-amber-300">
        <Clock className="h-3.5 w-3.5" /> Pendente
      </span>
    );
  return (
    <span className="chip border-red-500/30 bg-red-500/10 text-red-400">
      <Clock className="h-3.5 w-3.5" /> Atrasado
    </span>
  );
}

function Linha({
  icon: Icon,
  cor,
  label,
  valor,
  destaque,
}: {
  icon: typeof DollarSign;
  cor: string;
  label: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-slate-400">
        <Icon className={cn("h-4 w-4", cor)} />
        {label}
      </span>
      <span className={cn(destaque ? "font-bold text-white" : "text-slate-200")}>
        {valor}
      </span>
    </div>
  );
}
