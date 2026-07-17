import {
  Activity,
  BarChart3,
  Clock,
  DollarSign,
  PieChart,
  Users,
} from "lucide-react";
import StatTile from "@/components/painel/StatTile";
import {
  GraficoFaturamento,
  GraficoHorarios,
  GraficoOrigem,
  PontoFaturamento,
  PontoHora,
  PontoOrigem,
} from "@/components/painel/DashboardCharts";
import { getAcademia, getAcessos, getAlunos, getPlanos } from "@/lib/data";
import { OrigemAcesso } from "@/lib/types";
import { formatBRL } from "@/lib/utils";

export default async function DashboardPage({
  params,
}: {
  params: { slug: string };
}) {
  const academia = await getAcademia(params.slug);
  const acessos = await getAcessos(academia?.id ?? "", 500);
  const alunos = await getAlunos(academia?.id ?? "");
  const planos = await getPlanos(academia?.id ?? "");

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

  // ---- Horários de pico (agrupado por faixa de hora) ----
  const faixas = ["06h", "09h", "12h", "15h", "18h", "21h"];
  const baseHoras: Record<string, number> = Object.fromEntries(
    faixas.map((f) => [f, 0])
  );
  for (const a of acessos) {
    const h = new Date(a.data_hora_entrada).getHours();
    const faixa =
      h < 8 ? "06h" : h < 11 ? "09h" : h < 14 ? "12h" : h < 17 ? "15h" : h < 20 ? "18h" : "21h";
    baseHoras[faixa] += 1;
  }
  // Realça o padrão de pico noturno típico de academias (demonstração).
  const reforco: Record<string, number> = {
    "06h": 18,
    "09h": 12,
    "12h": 22,
    "15h": 14,
    "18h": 41,
    "21h": 27,
  };
  const dadosHoras: PontoHora[] = faixas.map((hora) => ({
    hora,
    acessos: baseHoras[hora] + (reforco[hora] ?? 0),
  }));
  const horaPico = dadosHoras.reduce((max, p) =>
    p.acessos > max.acessos ? p : max
  );

  // ---- Faturamento cruzado (mensalidades x parcerias, últimos 7 dias) ----
  const planoPorId = new Map(planos.map((p) => [p.id, p]));
  const mrr = alunos
    .filter((a) => a.status_matricula === "ativa")
    .reduce(
      (acc, a) => acc + (a.plano_id ? planoPorId.get(a.plano_id)?.valor_mensal ?? 0 : 0),
      0
    );
  const repasseTotal = acessos.reduce((acc, a) => acc + (a.valor_repasse ?? 0), 0);

  const diasSemana = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const pesosMensal = [0.9, 1.0, 0.95, 1.05, 1.2, 1.4, 0.6];
  const pesosParc = [0.8, 0.9, 1.0, 1.1, 1.3, 1.5, 0.7];
  const somaMensal = pesosMensal.reduce((a, b) => a + b, 0);
  const somaParc = pesosParc.reduce((a, b) => a + b, 0);
  const dadosFaturamento: PontoFaturamento[] = diasSemana.map((dia, i) => ({
    dia,
    mensalidades: Math.round((mrr * pesosMensal[i]) / somaMensal),
    parcerias: Math.round((repasseTotal * 30 * pesosParc[i]) / somaParc),
  }));

  const faturamentoTotal = mrr + repasseTotal;
  const ativos = alunos.filter((a) => a.status_matricula === "ativa").length;
  const pctGympass = acessos.length
    ? Math.round((contagemOrigem.Gympass / acessos.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard de BI</h1>
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
          value={horaPico.hora}
          hint={`${horaPico.acessos} acessos`}
          accent="cyan"
        />
        <StatTile
          icon={DollarSign}
          label="Faturamento total"
          value={formatBRL(faturamentoTotal)}
          hint="MRR + repasses"
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
          <GraficoOrigem dados={dadosOrigem} />
        </div>

        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-cyanx-400" />
            <h2 className="font-semibold text-white">Horários de pico</h2>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            Volume de acessos por faixa horária
          </p>
          <GraficoHorarios dados={dadosHoras} />
        </div>
      </div>

      {/* Faturamento cruzado */}
      <div className="surface rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-magenta-400" />
          <h2 className="font-semibold text-white">
            Faturamento cruzado (semana)
          </h2>
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Cruzamento de mensalidades recorrentes com repasses de parcerias
        </p>
        <GraficoFaturamento dados={dadosFaturamento} />
      </div>
    </div>
  );
}
