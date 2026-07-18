"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CORES_ORIGEM } from "@/lib/utils";

export type PontoOrigem = { origem: string; acessos: number };
export type PontoHora = { hora: string; acessos: number };
export type PontoFaturamento = {
  dia: string;
  mensalidades: number;
  parcerias: number;
};
export type PontoFinanceiroMensal = {
  mes: string;
  receita: number;
  despesa: number;
};
export type PontoEvolucaoAlunos = { mes: string; alunos: number };
export type PontoPeso = { data: string; peso: number };

const tooltipStyle = {
  backgroundColor: "#12141d",
  border: "1px solid #242838",
  borderRadius: "12px",
  color: "#e8ecf1",
  fontSize: "12px",
};

/** Rosca: distribuição de acessos por origem (Gympass vs. Direto vs. TotalPass). */
export function GraficoOrigem({ dados }: { dados: PontoOrigem[] }) {
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
                CORES_ORIGEM[d.origem as keyof typeof CORES_ORIGEM] ?? "#adff42"
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

/** Barras: volume de acessos por faixa horária (horários de pico). */
export function GraficoHorarios({ dados }: { dados: PontoHora[] }) {
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
          cursor={{ fill: "rgba(173,255,66,0.06)" }}
        />
        <Bar dataKey="acessos" radius={[6, 6, 0, 0]} fill="#adff42" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Área empilhada: cruzamento do faturamento (mensalidades x parcerias). */
export function GraficoFaturamento({ dados }: { dados: PontoFaturamento[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={dados} margin={{ left: -8, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="gradMens" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#adff42" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#adff42" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradParc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3ee6ff" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#3ee6ff" stopOpacity={0} />
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
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }}
        />
        <Area
          type="monotone"
          dataKey="mensalidades"
          name="Mensalidades"
          stroke="#adff42"
          strokeWidth={2}
          fill="url(#gradMens)"
        />
        <Area
          type="monotone"
          dataKey="parcerias"
          name="Parcerias"
          stroke="#3ee6ff"
          strokeWidth={2}
          fill="url(#gradParc)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Barras lado a lado: receita paga vs. despesa paga por mês. */
export function GraficoFinanceiroMensal({
  dados,
}: {
  dados: PontoFinanceiroMensal[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={dados} margin={{ left: -8, right: 8, top: 8 }}>
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
        <Bar dataKey="receita" name="Receita" radius={[6, 6, 0, 0]} fill="#adff42" />
        <Bar dataKey="despesa" name="Despesa" radius={[6, 6, 0, 0]} fill="#f81cc0" />
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
          stroke="#adff42"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#adff42" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
