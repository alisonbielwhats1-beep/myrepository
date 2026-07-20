import Link from "next/link";
import {
  ArrowUpRight,
  Cake,
  Flame,
  HeartPulse,
  TrendingDown,
} from "lucide-react";
import Breadcrumbs from "@/components/painel/Breadcrumbs";
import StatTile from "@/components/painel/StatTile";
import UpgradeGuard from "@/components/ui/UpgradeGuard";
import { requireSecao } from "@/lib/auth";
import { getAcessos, getAlunos } from "@/lib/data";
import { planoPodeAcessar, planoMinimo } from "@/lib/planos";

export const dynamic = "force-dynamic";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export default async function RetencaoPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSecao(params.slug, "retencao");

  if (!planoPodeAcessar(sessao.academia.plano_saas, "retencao")) {
    return (
      <UpgradeGuard
        recurso="retencao"
        planoAtual={sessao.academia.plano_saas}
        planoNecessario={planoMinimo("retencao")}
        slug={params.slug}
        titulo="Retenção disponível no Profissional"
        descricao="Veja quem está sumindo, aniversariantes do mês e ranking de frequência."
      />
    );
  }

  const [alunos, acessos] = await Promise.all([
    getAlunos(sessao.academia.id),
    getAcessos(sessao.academia.id, 3000),
  ]);

  const ativos = alunos.filter((a) => a.status_matricula === "ativa");
  const agora = Date.now();
  const ha30 = agora - 30 * 86400_000;

  // Frequência (últimos 30 dias) + último acesso por aluno.
  const freq = new Map<string, number>();
  const ultimo = new Map<string, number>();
  for (const ac of acessos) {
    if (!ac.aluno_id) continue;
    const t = new Date(ac.data_hora_entrada).getTime();
    if (!ultimo.has(ac.aluno_id) || t > ultimo.get(ac.aluno_id)!) {
      ultimo.set(ac.aluno_id, t);
    }
    if (t >= ha30) freq.set(ac.aluno_id, (freq.get(ac.aluno_id) ?? 0) + 1);
  }

  const totalCheckins30 = Array.from(freq.values()).reduce((a, b) => a + b, 0);
  const frequentaram = ativos.filter((a) => (freq.get(a.id) ?? 0) > 0).length;
  const taxaFrequencia = ativos.length
    ? Math.round((frequentaram / ativos.length) * 100)
    : 0;

  // Ranking de mais assíduos (30 dias).
  const ranking = ativos
    .map((a) => ({ nome: a.nome, id: a.id, visitas: freq.get(a.id) ?? 0 }))
    .filter((x) => x.visitas > 0)
    .sort((a, b) => b.visitas - a.visitas)
    .slice(0, 8);

  // Em risco: ativos sem acesso há 10+ dias (ou nunca).
  const emRisco = ativos
    .map((a) => ({
      id: a.id,
      nome: a.nome,
      ultimo: ultimo.get(a.id) ?? null,
    }))
    .filter((a) => !a.ultimo || a.ultimo < agora - 10 * 86400_000)
    .sort((a, b) => (a.ultimo ?? 0) - (b.ultimo ?? 0))
    .slice(0, 12);

  // Aniversariantes do mês.
  const mesAtual = new Date().getMonth();
  const aniversariantes = alunos
    .filter((a) => {
      if (!a.data_nascimento) return false;
      return new Date(a.data_nascimento + "T00:00:00").getMonth() === mesAtual;
    })
    .map((a) => ({
      nome: a.nome,
      dia: new Date(a.data_nascimento + "T00:00:00").getDate(),
    }))
    .sort((a, b) => a.dia - b.dia);

  return (
    <div className="space-y-6">
      <Breadcrumbs slug={params.slug} items={[{ label: "Retenção" }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">Retenção de alunos</h1>
        <p className="text-sm text-slate-400">
          Frequência, aniversariantes e alunos em risco de sair.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={HeartPulse}
          label="Frequência (30d)"
          value={`${taxaFrequencia}%`}
          hint={`${frequentaram}/${ativos.length} ativos treinaram`}
          accent="volt"
        />
        <StatTile
          icon={Flame}
          label="Check-ins (30d)"
          value={String(totalCheckins30)}
          hint="entradas na catraca"
          accent="cyan"
        />
        <StatTile
          icon={TrendingDown}
          label="Em risco"
          value={String(emRisco.length)}
          hint="sem vir há 10+ dias"
          accent={emRisco.length > 0 ? "magenta" : "slate"}
        />
        <StatTile
          icon={Cake}
          label="Aniversariantes"
          value={String(aniversariantes.length)}
          hint={`em ${MESES[mesAtual]}`}
          accent="slate"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mais assíduos */}
        <div className="surface rounded-2xl p-5">
          <h2 className="flex items-center gap-2 font-semibold text-white">
            <Flame className="h-4 w-4 text-volt-300" /> Mais assíduos (30 dias)
          </h2>
          {ranking.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Nenhum check-in nos últimos 30 dias.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {ranking.map((r, i) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-ink-700 text-[11px] font-bold text-slate-300">
                      {i + 1}
                    </span>
                    <span className="truncate text-slate-200">{r.nome}</span>
                  </span>
                  <span className="flex-none tabular-nums text-slate-400">
                    {r.visitas} visitas
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Aniversariantes */}
        <div className="surface rounded-2xl p-5">
          <h2 className="flex items-center gap-2 font-semibold text-white">
            <Cake className="h-4 w-4 text-magenta-400" /> Aniversariantes de{" "}
            {MESES[mesAtual]}
          </h2>
          {aniversariantes.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Nenhum aniversariante neste mês.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {aniversariantes.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-slate-200">{a.nome}</span>
                  <span className="flex-none tabular-nums text-slate-400">
                    dia {a.dia}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Em risco */}
      <div className="surface rounded-2xl p-5">
        <h2 className="flex items-center gap-2 font-semibold text-white">
          <TrendingDown className="h-4 w-4 text-magenta-400" /> Em risco de sair
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Alunos ativos sem check-in há 10 dias ou mais — vale um contato.
        </p>
        {emRisco.length === 0 ? (
          <p className="text-sm text-slate-500">
            Ninguém em risco no momento. 🎉
          </p>
        ) : (
          <ul className="divide-y divide-ink-700/70">
            {emRisco.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 py-2.5">
                <Link
                  href={`/painel/${params.slug}/alunos`}
                  className="truncate text-sm font-medium text-white hover:text-volt-300"
                >
                  {a.nome}
                </Link>
                <span className="flex-none text-xs text-slate-500">
                  {a.ultimo
                    ? `há ${Math.floor((agora - a.ultimo) / 86400_000)} dias`
                    : "nunca veio"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href={`/painel/${params.slug}/alunos`} className="btn-ghost mt-4 w-full">
          Ver alunos <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
