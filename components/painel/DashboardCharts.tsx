"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CORES_ORIGEM } from "@/lib/utils";

/** Converte "#rrggbb" em "rgba(r, g, b, alpha)" — usado só para o fallback. */
function rgbParaRgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Lê uma cor do tema (variável CSS "R G B") e a devolve como `rgb(...)` (ou
 * `rgba(...)` quando `alpha` é informado), reagindo à troca de tema
 * (data-theme) e ao tema do sistema. Assim os gráficos usam o verde certo em
 * cada tema (neon no escuro, profundo no claro).
 */
function useCorTema(nomeVar: string, fallback: string, alpha?: number): string {
  const corFallback = alpha != null ? rgbParaRgba(fallback, alpha) : fallback;
  const [cor, setCor] = useState(corFallback);
  useEffect(() => {
    const ler = () => {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue(nomeVar)
        .trim();
      if (!v) return;
      setCor(
        alpha != null ? `rgba(${v.split(/\s+/).join(", ")}, ${alpha})` : `rgb(${v})`
      );
    };
    ler();
    const obs = new MutationObserver(ler);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", ler);
    return () => {
      obs.disconnect();
      mq.removeEventListener("change", ler);
    };
  }, [nomeVar, alpha]);
  return cor;
}

export type PontoOrigem = { origem: string; acessos: number };
export type PontoHora = { hora: string; acessos: number };
export type PontoFaturamento = {
  dia: string;
  /** Receitas já pagas do dia (mensalidades, matrículas, produtos). */
  receitas: number;
};
// Definido em lib/types.ts: é um tipo de domínio consumido por lib/financeiro.ts,
// que não pode depender de um componente. Reexportado aqui por compatibilidade.
import type { PontoFinanceiroMensal } from "@/lib/types";
export type { PontoFinanceiroMensal };
export type PontoEvolucaoAlunos = { mes: string; alunos: number };
export type PontoPeso = { data: string; peso: number };
export type PontoFormaPagamento = {
  forma: string;
  valor: number;
  quantidade: number;
};

const tooltipStyle = {
  backgroundColor: "#12141d",
  border: "1px solid #242838",
  borderRadius: "12px",
  color: "#e8ecf1",
  fontSize: "12px",
};

/** Rosca: distribuição de acessos por origem (Gympass vs. Direto vs. TotalPass). */
export function GraficoOrigem({ dados }: { dados: PontoOrigem[] }) {
  const volt = useCorTema("--volt-300", "#adff42");
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={dados}
          dataKey="acessos"
          nameKey="origem"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={3}
          stroke="none"
        >
          {dados.map((d) => (
            <Cell
              key={d.origem}
              fill={
                CORES_ORIGEM[d.origem as keyof typeof CORES_ORIGEM] ?? volt
              }
            />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/**
 * Barras: volume de acessos por faixa horária (horários de pico).
 *
 * `destacarPico`: opcional, desligado por padrão (mantém o Relatórios/BI
 * exatamente como está). Quando ligado — Dashboard, auditoria de UX item 3
 * — a barra de maior volume fica em volt-300 e as demais em volt-300/32,
 * pra "onde é o pico" saltar aos olhos sem precisar ler o eixo.
 */
export function GraficoHorarios({
  dados,
  destacarPico = false,
}: {
  dados: PontoHora[];
  destacarPico?: boolean;
}) {
  const volt = useCorTema("--volt-300", "#adff42");
  const voltFraco = useCorTema("--volt-300", "#adff42", 0.32);
  const maxAcessos = destacarPico
    ? Math.max(0, ...dados.map((d) => d.acessos))
    : 0;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={dados} margin={{ left: -20, right: 8, top: 8 }}>
        <XAxis
          dataKey="hora"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={{ stroke: "#242838" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(120,120,120,0.08)" }}
        />
        <Bar dataKey="acessos" radius={[6, 6, 0, 0]} fill={volt}>
          {destacarPico &&
            dados.map((d, i) => (
              <Cell
                key={i}
                fill={
                  d.acessos === maxAcessos && maxAcessos > 0 ? volt : voltFraco
                }
              />
            ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Área: receitas já pagas dia a dia.
 *
 * A série "Parcerias" (repasse diário de Gympass/TotalPass) foi removida — o
 * valor vinha de constantes fixas no código, não de uma fonte real de repasse.
 * A contagem de check-ins por origem continua em `GraficoOrigem`.
 */
export function GraficoFaturamento({ dados }: { dados: PontoFaturamento[] }) {
  const volt = useCorTema("--volt-300", "#adff42");
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={dados} margin={{ left: -8, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="gradMens" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={volt} stopOpacity={0.5} />
            <stop offset="100%" stopColor={volt} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="dia"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={{ stroke: "#242838" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) =>
            v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          }
        />
        <Area
          type="monotone"
          dataKey="receitas"
          name="Receitas pagas"
          stroke={volt}
          strokeWidth={2}
          fill="url(#gradMens)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Barras lado a lado: receita paga vs. despesa paga por mês. */
export function GraficoFinanceiroMensal({
  dados,
  mostrarProjetado = false,
}: {
  dados: PontoFinanceiroMensal[];
  /** Linha de saldo projetado — desligada por padrão para não poluir a leitura. */
  mostrarProjetado?: boolean;
}) {
  const volt = useCorTema("--volt-300", "#adff42");
  const temResultado = dados.some((d) => d.resultado !== undefined);
  const temProjetado = mostrarProjetado && dados.some((d) => d.projetado !== undefined);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={dados} margin={{ left: -8, right: 8, top: 8 }}>
        <XAxis
          dataKey="mes"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={{ stroke: "#242838" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) =>
            v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          }
        />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }}
        />
        <ReferenceLine y={0} stroke="#334155" />
        <Bar dataKey="receita" name="Receita" radius={[6, 6, 0, 0]} fill={volt} />
        <Bar dataKey="despesa" name="Despesa" radius={[6, 6, 0, 0]} fill="#f81cc0" />
        {temResultado && (
          <Line
            type="monotone"
            dataKey="resultado"
            name="Resultado"
            stroke="#e2e8f0"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#e2e8f0" }}
          />
        )}
        {temProjetado && (
          <Line
            type="monotone"
            dataKey="projetado"
            name="Saldo projetado"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={{ r: 2.5, fill: "#22d3ee" }}
            strokeDasharray="5 4"
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/**
 * Barras HORIZONTAIS: receita recebida por forma de pagamento.
 *
 * Horizontal (e não vertical) de propósito: os rótulos reais são longos
 * ("Cartão de débito", "Transferência bancária") e no eixo X de um celular de
 * 320 px eles se sobrepõem ou giram. Na horizontal cada rótulo tem sua própria
 * linha e a barra cresce no espaço disponível.
 *
 * A barra representa o VALOR; a quantidade de pagamentos aparece no tooltip
 * junto com o valor — assim as duas informações convivem sem um segundo eixo.
 * Altura proporcional à quantidade de formas, nunca fixa.
 */
export function GraficoFormasPagamento({
  dados,
}: {
  dados: PontoFormaPagamento[];
}) {
  const volt = useCorTema("--volt-300", "#adff42");
  const altura = Math.max(160, dados.length * 46 + 24);

  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart
        data={dados}
        layout="vertical"
        margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="forma"
          width={104}
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(120,120,120,0.08)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as PontoFormaPagamento;
            return (
              <div style={tooltipStyle} className="px-3 py-2">
                <p className="font-semibold">{p.forma}</p>
                <p>
                  {p.valor.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
                <p style={{ color: "#94a3b8" }}>
                  {p.quantidade}{" "}
                  {p.quantidade === 1 ? "pagamento" : "pagamentos"}
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="valor" radius={[0, 6, 6, 0]} fill={volt} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Linha: evolução do número de alunos cadastrados mês a mês. */
export function GraficoEvolucaoAlunos({
  dados,
}: {
  dados: PontoEvolucaoAlunos[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={dados} margin={{ left: -20, right: 8, top: 8 }}>
        <XAxis
          dataKey="mes"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={{ stroke: "#242838" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Line
          type="monotone"
          dataKey="alunos"
          name="Alunos"
          stroke="#3ee6ff"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#3ee6ff" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Linha: evolução do peso do aluno ao longo do tempo. */
export function GraficoProgressoPeso({ dados }: { dados: PontoPeso[] }) {
  const volt = useCorTema("--volt-300", "#adff42");
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={dados} margin={{ left: -20, right: 8, top: 8 }}>
        <XAxis
          dataKey="data"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={{ stroke: "#242838" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          domain={["dataMin - 2", "dataMax + 2"]}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) => `${v} kg`}
        />
        <Line
          type="monotone"
          dataKey="peso"
          name="Peso (kg)"
          stroke={volt}
          strokeWidth={2.5}
          dot={{ r: 3, fill: volt }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
