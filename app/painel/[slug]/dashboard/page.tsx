import {
  Activity,
  BarChart3,
  Clock,
  DollarSign,
  PieChart,
  Users,
} from "lucide-react";
import Breadcrumbs from "@/components/painel/Breadcrumbs";
import StatTile from "@/components/painel/StatTile";
import {
  GraficoFaturamento,
  GraficoHorarios,
  GraficoOrigem,
  PontoFaturamento,
  PontoHora,
  PontoOrigem,
} from "@/components/painel/DashboardCharts";
import UpgradeGuard from "@/components/ui/UpgradeGuard";
import { requireSecao } from "@/lib/auth";
import { getAcessosPeriodo, getContagemAlunos, getReceitas } from "@/lib/data";
import { OrigemAcesso } from "@/lib/types";
import { formatBRL, hojeSaoPaulo, somarDiasISO } from "@/lib/utils";
import { planoPodeAcessar, planoMinimo } from "@/lib/planos";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function RelatoriosPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSecao(params.slug, "relatorios");

  // Financeiro (faturamento) é exclusivo do dono — a mesma regra de
  // lib/permissoes.ts que restringe a seção "financeiro". A seção de
  // Relatórios/BI é acessível ao gerente (acessos, horários, alunos), mas o
  // gerente NÃO enxerga dinheiro. Gating no fetch (defesa em profundidade) e no
  // render, para não trazer receita nenhuma à requisição de quem não é dono.
  const podeVerDinheiro = sessao.papel === "dono";

  if (!planoPodeAcessar(sessao.academia.plano_saas, "relatorios")) {
    return (
      <UpgradeGuard
        recurso="relatorios"
        planoAtual={sessao.academia.plano_saas}
        planoNecessario={planoMinimo("relatorios")}
        slug={params.slug}
        titulo="Relatórios / BI disponível no Profissional"
        descricao="Análise de faturamento, horários de pico, origem dos alunos e mais."
      />
    );
  }

  const seteDiasAtras = new Date(Date.now() - 6 * 86400_000)
    .toISOString()
    .slice(0, 10);

  // Fase 13: antes lia getAcessos(id, 500) — um teto fixo de linhas, não de
  // tempo. Numa academia grande, os 500 mais recentes podem não cobrir nem
  // os últimos 7 dias (cards abaixo, que se dizem "do período", ficariam
  // errados); numa academia pequena, podem cobrir meses (o gráfico "7 dias"
  // misturaria períodos). Delimitar por data resolve os dois casos.
  const [acessos, contagemAlunos, receitas] = await Promise.all([
    getAcessosPeriodo(
      sessao.academia.id,
      `${seteDiasAtras}T00:00:00.000Z`,
      new Date().toISOString()
    ),
    getContagemAlunos(sessao.academia.id),
    podeVerDinheiro
      ? getReceitas(sessao.academia.id, seteDiasAtras)
      : Promise.resolve([] as Awaited<ReturnType<typeof getReceitas>>),
  ]);

  // ---- Acessos por origem (Gympass vs. Direto vs. TotalPass) ----
  const contagemOrigem: Record<OrigemAcesso, number> = {
    Direto: 0,
    Gympass: 0,
    TotalPass: 0,
    qr: 0,
  };
  for (const a of acessos) contagemOrigem[a.origem] += 1;
  const dadosOrigem: PontoOrigem[] = (
    Object.keys(contagemOrigem) as OrigemAcesso[]
  ).map((origem) => ({ origem, acessos: contagemOrigem[origem] }));

  // ---- Horários de pico (agrupado por faixa de hora, 100% dados reais) ----
  const faixas = ["06h", "09h", "12h", "15h", "18h", "21h"];
  const contagemHoras: Record<string, number> = Object.fromEntries(
    faixas.map((f) => [f, 0])
  );
  for (const a of acessos) {
    const h = new Date(a.data_hora_entrada).getHours();
    const faixa =
      h < 8 ? "06h" : h < 11 ? "09h" : h < 14 ? "12h" : h < 17 ? "15h" : h < 20 ? "18h" : "21h";
    contagemHoras[faixa] += 1;
  }
  const dadosHoras: PontoHora[] = faixas.map((hora) => ({
    hora,
    acessos: contagemHoras[hora],
  }));
  const horaPico = dadosHoras.reduce((max, p) =>
    p.acessos > max.acessos ? p : max
  );

  // ---- Receitas pagas (últimos 7 dias, dados reais dia a dia) ----
  //
  // O repasse diário de parcerias (Gympass/TotalPass) foi retirado daqui: o
  // valor vinha de constantes fixas no código, não de um contrato ou fonte
  // real, e somá-lo à receita paga contaminava um número de dinheiro real com
  // uma estimativa inventada. Os acessos por origem (contagem de check-ins)
  // continuam no gráfico ao lado, intactos.
  const receitaPorDia = new Map<string, number>();
  for (const r of receitas) {
    if (r.status !== "pago") continue;
    receitaPorDia.set(r.data, (receitaPorDia.get(r.data) ?? 0) + Number(r.valor));
  }

  const dadosFaturamento: PontoFaturamento[] = Array.from({ length: 7 }).map(
    (_, i) => {
      // Ancorado em SP: as chaves de `receitaPorDia` vêm de colunas `date`
      // (dias de negócio em São Paulo). Montar a régua com Date.now()/UTC
      // desalinhava o gráfico entre 21h e meia-noite — o dia de hoje caía
      // fora da série e uma barra aparecia vazia.
      const iso = somarDiasISO(hojeSaoPaulo(), i - 6);
      return {
        dia: DIAS_SEMANA[new Date(`${iso}T00:00:00Z`).getUTCDay()],
        receitas: Math.round((receitaPorDia.get(iso) ?? 0) * 100) / 100,
      };
    }
  );

  const faturamentoTotal7d = dadosFaturamento.reduce(
    (acc, p) => acc + p.receitas,
    0
  );
  const ativos = contagemAlunos.ativos;
  const pctGympass = acessos.length
    ? Math.round((contagemOrigem.Gympass / acessos.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <Breadcrumbs slug={params.slug} items={[{ label: "Relatórios / BI" }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">Relatórios / BI</h1>
        <p className="text-sm text-slate-400">
          Inteligência de negócio: acessos, horários de pico e faturamento
          cruzado.
        </p>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={Activity}
          label="Acessos (período)"
          value={String(acessos.length)}
          hint={`${pctGympass}% via Gympass`}
          accent="volt"
        />
        <StatTile
          icon={Clock}
          label="Horário de pico"
          value={acessos.length ? horaPico.hora : "—"}
          hint={acessos.length ? `${horaPico.acessos} acessos` : "sem dados ainda"}
          accent="cyan"
        />
        {podeVerDinheiro && (
          <StatTile
            icon={DollarSign}
            label="Faturamento (7 dias)"
            value={formatBRL(faturamentoTotal7d)}
            hint="receitas pagas"
            accent="magenta"
          />
        )}
        <StatTile
          icon={Users}
          label="Alunos ativos"
          value={String(ativos)}
          hint={`${contagemAlunos.total} cadastrados`}
          accent="slate"
        />
      </div>

      {/* Gráficos: origem + horários */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-volt-300" />
            <h2 className="font-semibold text-white">
              Acessos por origem
            </h2>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            Gympass vs. Direto vs. TotalPass
          </p>
          {acessos.length ? (
            <GraficoOrigem dados={dadosOrigem} />
          ) : (
            <EstadoVazio texto="Nenhum acesso registrado ainda." />
          )}
        </div>

        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-cyanx-400" />
            <h2 className="font-semibold text-white">Horários de pico</h2>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            Volume de acessos por faixa horária
          </p>
          {acessos.length ? (
            <GraficoHorarios dados={dadosHoras} />
          ) : (
            <EstadoVazio texto="Nenhum acesso registrado ainda." />
          )}
        </div>
      </div>

      {/* Receitas pagas dia a dia — só o dono vê dinheiro no BI. */}
      {podeVerDinheiro && (
        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-magenta-400" />
            <h2 className="font-semibold text-white">
              Receitas pagas (7 dias)
            </h2>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            Mensalidades, matrículas e produtos já pagos, dia a dia
          </p>
          <GraficoFaturamento dados={dadosFaturamento} />
        </div>
      )}
    </div>
  );
}

function EstadoVazio({ texto }: { texto: string }) {
  return (
    <div className="grid h-[260px] place-items-center text-sm text-slate-500">
      {texto}
    </div>
  );
}
