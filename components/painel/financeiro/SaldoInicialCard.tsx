"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Landmark, Pencil, X } from "lucide-react";
import FormActions from "@/components/ui/FormActions";
import { definirSaldoInicial } from "@/app/painel/[slug]/financeiro/actions";
import { formatBRL } from "@/lib/utils";

/**
 * Ponto de partida do saldo registrado. A ação do servidor valida faixa e data
 * e resolve a academia pela sessão — nada aqui é confiável por si só.
 */
export default function SaldoInicialCard({
  slug,
  saldoInicial,
  dataSaldoInicial,
  desdeEfetivo,
}: {
  slug: string;
  saldoInicial: number;
  dataSaldoInicial: string | null;
  /** Data realmente usada no cálculo (pode vir do 1º lançamento). */
  desdeEfetivo: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const acao = definirSaldoInicial.bind(null, slug);
  const [estado, formAction] = useFormState(acao, {});

  const fmtData = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

  if (!aberto) {
    return (
      <div className="surface flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
        <div className="flex items-start gap-2">
          <Landmark className="mt-0.5 h-4 w-4 flex-none text-cyanx-400" />
          <div className="text-xs text-slate-400">
            <p className="text-sm font-medium text-white">
              Saldo inicial: {formatBRL(saldoInicial)}
            </p>
            <p className="mt-0.5">
              {dataSaldoInicial
                ? `Contando a partir de ${fmtData(dataSaldoInicial)}.`
                : desdeEfetivo
                ? `Sem data definida — contando desde o primeiro lançamento pago (${fmtData(desdeEfetivo)}).`
                : "Sem data definida e sem lançamentos pagos com data ainda."}{" "}
              O saldo registrado é o que o GestAcad conhece, não o extrato do banco.
            </p>
          </div>
        </div>
        <button onClick={() => setAberto(true)} className="btn-ghost">
          <Pencil className="h-4 w-4" /> Ajustar
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="surface rounded-2xl p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <Landmark className="h-4 w-4 text-cyanx-400" /> Saldo inicial
        </h3>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-ink-700 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {estado.erro && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}

      <p className="mt-2 text-xs text-slate-500">
        Quanto havia em caixa no dia em que você começou a lançar no GestAcad.
        Tudo que foi pago a partir dessa data entra no saldo registrado.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Saldo inicial (R$)
          </span>
          <input
            name="saldo_inicial"
            inputMode="decimal"
            defaultValue={saldoInicial ? String(saldoInicial) : ""}
            placeholder="Ex: 2500,00"
            className="inp"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            A partir de (opcional)
          </span>
          <input
            name="data_saldo_inicial"
            type="date"
            defaultValue={dataSaldoInicial ?? ""}
            className="inp"
          />
        </label>
      </div>

      <FormActions
        onCancelar={() => setAberto(false)}
        salvarLabel="Salvar saldo inicial"
        className="mt-4"
      />
    </form>
  );
}
