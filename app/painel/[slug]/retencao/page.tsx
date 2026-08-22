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
import BotaoReativacaoWhats from "@/components/painel/BotaoReativacaoWhats";
import UpgradeGuard from "@/components/ui/UpgradeGuard";
import { requireSecao } from "@/lib/auth";
import {
  getAlunosAniversariantes,
  getRetencaoAlunos,
  getTelefonesDosAlunos,
} from "@/lib/data";
import { planoPodeAcessar, planoMinimo } from "@/lib/planos";
import {
  ROTULOS_RETENCAO as ROTULOS,
  badgeRetencao,
  classificarRetencao,
  cn,
  configRetencaoDe,
  mesSaoPaulo,
} from "@/lib/utils";

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

  // Mesma consulta agregada do painel: uma chamada, agregação no banco, sem
  // limite arbitrário de acessos e sem trazer histórico para o frontend.
  // Aniversariantes (Fase 13): antes carregava getAlunos() — a ficha inteira
  // de cada aluno da academia — só para ler data_nascimento. Agora usa a RPC
  // aniversariantes_do_mes (migration 038), que já filtra o mês no banco.
  const mesAtual = mesSaoPaulo();
  const [aniversariantesRows, retencao] = await Promise.all([
    getAlunosAniversariantes(mesAtual),
    getRetencaoAlunos(30),
  ]);

  const configRetencao = configRetencaoDe(sessao.academia);

  // A RPC já devolve somente matrícula ativa; classificarRetencao reforça a
  // regra e devolve null para qualquer status que não seja "ativa".
  const classificados = retencao
    .map((r) => {
      const c = classificarRetencao(
        { criado_em: r.criado_em, status_matricula: "ativa" },
        r.ultimo_acesso,
        configRetencao
      );
      return c ? { ...r, ...c } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const totalCheckins30 = retencao.reduce((s, r) => s + r.acessos_periodo, 0);
  const frequentaram = retencao.filter((r) => r.acessos_periodo > 0).length;
  const taxaFrequencia = retencao.length
    ? Math.round((frequentaram / retencao.length) * 100)
    : 0;

  // Ranking de mais assíduos (30 dias).
  const ranking = retencao
    .filter((r) => r.acessos_periodo > 0)
    .sort((a, b) => b.acessos_periodo - a.acessos_periodo)
    .slice(0, 8)
    .map((r) => ({ id: r.aluno_id, nome: r.nome, visitas: r.acessos_periodo }));

  // Atenção, em risco e sumido — os três aparecem, do mais grave ao mais leve.
  const PESO: Record<string, number> = { sumido: 0, em_risco: 1, atencao: 2 };
  const emRisco = classificados
    .filter((r) => r.classificacao !== "normal")
    .sort(
      (a, b) =>
        PESO[a.classificacao] - PESO[b.classificacao] ||
        (b.diasSemAcesso ?? b.diasDesdeMatricula) -
          (a.diasSemAcesso ?? a.diasDesdeMatricula)
    );

  const totalSumidos = classificados.filter((r) => r.classificacao === "sumido").length;

  // Telefones só dos alunos em risco (a RPC de retenção não devolve telefone),
  // para o botão de reativação por WhatsApp direto nesta lista — a próxima ação
  // acontece aqui, sem o gestor ter de procurar o aluno em outra tela.
  const telefones = await getTelefonesDosAlunos(
    sessao.academia.id,
    emRisco.map((a) => a.aluno_id)
  );

  // Aniversariantes do mês — já filtrados pela RPC (mês é o mesmo `mesAtual`
  // usado acima para a busca).
  const aniversariantes = aniversariantesRows
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
          hint={`${frequentaram}/${retencao.length} ativos treinaram`}
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
          label="Precisam de contato"
          value={String(emRisco.length)}
          hint={`${totalSumidos} já sumido(s)`}
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
          <TrendingDown className="h-4 w-4 text-magenta-400" /> Precisam de contato
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Atenção a partir de {configRetencao.diasAtencao} dias, em risco a partir
          de {configRetencao.diasRisco} e sumido a partir de{" "}
          {configRetencao.diasSumido}. Recém-matriculado tem{" "}
          {configRetencao.toleranciaNovoAluno} dias de tolerância.
        </p>
        {emRisco.length === 0 ? (
          <p className="text-sm text-slate-500">
            Ninguém em risco no momento. 🎉
          </p>
        ) : (
          <ul className="divide-y divide-ink-700/70">
            {emRisco.map((a) => (
              <li
                key={a.aluno_id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  {/* Deep-link para ESTE aluno (busca por nome), não para a
                      lista genérica — o gestor cai direto no aluno certo. */}
                  <Link
                    href={`/painel/${params.slug}/alunos?q=${encodeURIComponent(a.nome)}`}
                    className="block truncate text-sm font-medium text-white hover:text-volt-300"
                  >
                    {a.nome}
                  </Link>
                  <span className="text-xs text-slate-500">{a.explicacao}</span>
                </div>
                <span className="flex flex-none items-center gap-2">
                  <span className={cn("chip text-[10px]", badgeRetencao(a.classificacao))}>
                    {ROTULOS[a.classificacao]}
                  </span>
                  <BotaoReativacaoWhats
                    nome={a.nome}
                    telefone={telefones.get(a.aluno_id)}
                    academia={sessao.academia.nome_fantasia}
                    diasSemAcesso={a.diasSemAcesso ?? null}
                    compacto
                    isDemo={sessao.academia.is_demo}
                  />
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
