import { CreditCard } from "lucide-react";
import Ajuda from "@/components/ui/Ajuda";
import {
  GraficoFormasPagamento,
  type PontoFormaPagamento,
} from "@/components/painel/DashboardCharts";
import { FORMAS_PAGAMENTO } from "@/lib/types";
import { formatBRL } from "@/lib/utils";
import type { LinhaFormaPagamento } from "@/lib/data";

/**
 * Rótulos curtos só para o eixo do gráfico. O valor gravado no banco continua
 * sendo o rótulo completo de FORMAS_PAGAMENTO — encurtar aqui é apenas para o
 * texto caber no eixo de um celular estreito, sem perder o significado.
 */
const ROTULO_CURTO: Record<string, string> = {
  "Cartão de débito": "Cartão débito",
  "Cartão de crédito": "Cartão crédito",
  "Transferência bancária": "Transferência",
};

/** Formas que a interface realmente oferece hoje (lib/types.ts). */
const LABELS_CONHECIDOS = FORMAS_PAGAMENTO.map((f) => f.label);

/**
 * Monta as barras na ordem das formas oferecidas pela interface e consolida o
 * resto. `forma_pagamento` é texto livre desde a migration 027, então o banco
 * pode conter valores digitados por versões antigas — esses caem em "Outros"
 * em vez de virar uma barra solta cada. "Não informado" fica separado: é um
 * sinal acionável (pagamento registrado sem forma), não uma forma de pagamento.
 *
 * Nada é inventado: só aparecem formas que realmente têm pagamento no período.
 */
export function montarFormasPagamento(
  linhas: LinhaFormaPagamento[]
): PontoFormaPagamento[] {
  const conhecidas: PontoFormaPagamento[] = [];
  let outrosValor = 0;
  let outrosQtd = 0;
  let semFormaValor = 0;
  let semFormaQtd = 0;

  for (const label of LABELS_CONHECIDOS) {
    const achado = linhas.find((l) => l.forma === label);
    if (!achado || Number(achado.quantidade) === 0) continue;
    conhecidas.push({
      forma: ROTULO_CURTO[label] ?? label,
      valor: Number(achado.total),
      quantidade: Number(achado.quantidade),
    });
  }

  for (const l of linhas) {
    if (LABELS_CONHECIDOS.includes(l.forma)) continue;
    if (l.forma === "Não informado") {
      semFormaValor += Number(l.total);
      semFormaQtd += Number(l.quantidade);
    } else {
      outrosValor += Number(l.total);
      outrosQtd += Number(l.quantidade);
    }
  }

  const saida = [...conhecidas];
  if (outrosQtd > 0) {
    saida.push({ forma: "Outros", valor: outrosValor, quantidade: outrosQtd });
  }
  if (semFormaQtd > 0) {
    saida.push({
      forma: "Não informado",
      valor: semFormaValor,
      quantidade: semFormaQtd,
    });
  }
  return saida;
}

export default function FormasPagamentoCard({
  linhas,
  periodo,
}: {
  linhas: LinhaFormaPagamento[];
  periodo: string;
}) {
  const dados = montarFormasPagamento(linhas);
  const totalRecebido = dados.reduce((acc, d) => acc + d.valor, 0);
  const totalPagamentos = dados.reduce((acc, d) => acc + d.quantidade, 0);

  return (
    <div className="surface rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {/* "Recebido" e não "Faturado": a consulta considera apenas
              status='pago' com data_pagamento no período (regime de caixa),
              ou seja, dinheiro que de fato entrou. */}
          <h3 className="flex items-center gap-2 font-semibold text-white">
            <CreditCard className="h-4 w-4 text-volt-300" />
            Recebido por forma de pagamento
            <Ajuda texto="Só pagamentos confirmados, contados pela data em que o dinheiro entrou. Pendentes, cancelados e previsões não entram." />
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {periodo} · dinheiro que entrou em cada forma
          </p>
        </div>
        {totalPagamentos > 0 && (
          <p className="shrink-0 text-right">
            <span className="block text-sm font-bold tabular-nums text-white">
              {formatBRL(totalRecebido, { compacto: true })}
            </span>
            <span className="block text-xs text-slate-500">
              {totalPagamentos} pagamento(s)
            </span>
          </p>
        )}
      </div>

      {dados.length === 0 ? (
        <p className="mt-6 pb-2 text-center text-sm text-slate-500">
          Nenhum pagamento confirmado neste período.
        </p>
      ) : (
        <>
          <div className="mt-3">
            <GraficoFormasPagamento dados={dados} />
          </div>

          {/* Os mesmos números em texto: o tooltip do gráfico não existe no
              toque e não é lido por leitor de tela. Aqui valor e quantidade
              ficam sempre visíveis, em uma coluna no celular. */}
          <ul className="mt-2 grid gap-1.5 border-t border-ink-700/60 pt-3 sm:grid-cols-2">
            {dados.map((d) => (
              <li
                key={d.forma}
                className="flex items-baseline justify-between gap-3 text-xs"
              >
                <span className="min-w-0 truncate text-slate-400">{d.forma}</span>
                <span className="shrink-0 tabular-nums text-slate-200">
                  {formatBRL(d.valor, { compacto: true })}
                  <span className="text-slate-500"> · {d.quantidade}x</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
