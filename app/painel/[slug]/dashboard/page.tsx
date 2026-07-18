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
import { requireSecao } from "@/lib/auth";
import { getAcessos, getAlunos, getReceitas } from "@/lib/data";
import { OrigemAcesso } from "@/lib/types";
import { formatBRL } from "@/lib/utils";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function RelatoriosPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSecao(params.slug, "relatorios");

  const seteDiasAtras = new Date(Date.now() - 6 * 86400_000)
    .toISOString()
    .slice(0, 10);

  const [acessos, alunos, receitas] = await Promise.all([
    getAcessos(sessao.academia.id, 500),
    getAlunos(sessao.academia.id),
    getReceitas(sessao.academia.id, seteDiasAtras),
  ]);

  // ---- Acessos por origem (Gympass vs. Direto vs. TotalPass) ----
  const contagemOrigem: Record<OrigemAcesso, number> = {
    Direto: 0,
    Gympass: 0,
    TotalPass: 0,
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

  // ---- Faturamento cruzado (últimos 7 dias, dados reais dia a dia) ----
  const repassePorDia = new Map<string, number>();
  for (const a of acessos) {
    const dia = a.data_hora_entrada.slice(0, 10);
    if (dia < seteDiasAtras) continue;
    repassePorDia.set(dia, (repassePorDia.get(dia) ?? 0) + (a.valor_repasse ?? 0));
  }
  const receitaPorDia = new Map<string, number>();
  for (const r of receitas) {
    if (r.status !== "pago") continue;
    receitaPorDia.set(r.data, (receitaPorDia.get(r.data) ?? 0) + Number(r.valor));
  }

  const dadosFaturamento: PontoFaturamento[] = Array.from({ length: 7 }).map(
    (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400_000);
      const iso = d.toISOString().slice(0, 10);
      return {
        dia: DIAS_SEMANA[d.getDay()],
        mensalidades: Math.round((receitaPorDia.get(iso) ?? 0) * 100) / 100,
        parcerias: Math.round((repassePorDia.get(iso) ?? 0) * 100) / 100,
      };
    }
  );

  const faturamentoTotal7d = dadosFaturamento.reduce(
    (acc, p) => acc + p.mensalidades + p.parcerias,
    0
  );
  const ativos = alunos.filter((a) => a.status_matricula === "ativa").length;
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
        <StatTile
          icon={DollarSign}
          label="Faturamento (7 dias)"
          value={formatBRL(faturamentoTotal7d)}
          hint="mensalidades + repasses"
          accent="magenta"
        />
        <StatTile
          icon={Users}
          label="Alunos ativos"
          value={String(ativos)}
          hint={`${alunos.length} cadastrados`}
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

      {/* Faturamento cruzado */}
      <div className="surface rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-magenta-400" />
          <h2 className="font-semibold text-white">
            Faturamento cruzado (7 dias)
          </h2>
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Receitas pagas (mensalidades, matrículas, produtos) x repasses de
          parcerias (Gympass/TotalPass), dia a dia
        </p>
        <GraficoFaturamento dados={dadosFaturamento} />
      </div>
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
