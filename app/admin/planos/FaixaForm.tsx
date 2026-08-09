"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Loader2, Plus, Save } from "lucide-react";
import { FaixaComercial } from "@/lib/types";
import { intervaloLabel } from "@/lib/faixas-comerciais";
import { formatBRL } from "@/lib/utils";
import { atualizarFaixa, criarFaixa } from "./actions";

/**
 * Formulário de uma faixa comercial. Sem botão de excluir: faixa usada em
 * proposta vira histórico, o caminho é desmarcar "Ativa".
 *
 * A validação real mora em `validarFaixa` (lib/faixas-comerciais.ts), chamada
 * pela Server Action. O que existe aqui é conveniência de digitação.
 */
export default function FaixaForm({ faixa }: { faixa?: FaixaComercial }) {
  const acao = faixa ? atualizarFaixa.bind(null, faixa.id) : criarFaixa;
  const [estado, formAction] = useFormState(acao, {});
  const [aberto, setAberto] = useState(!faixa);

  if (!faixa && !aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="btn-ghost w-full justify-center !py-3"
      >
        <Plus className="h-4 w-4" /> Nova faixa
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="surface space-y-4 rounded-2xl p-5"
      key={estado.savedAt}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">
            {faixa ? faixa.nome : "Nova faixa"}
          </h3>
          {faixa && (
            <p className="mt-0.5 text-xs text-slate-500">
              {intervaloLabel(faixa)} ·{" "}
              {formatBRL(Number(faixa.preco_mensal))}/mês
            </p>
          )}
        </div>
        {faixa && (
          <span
            className={
              faixa.ativo
                ? "chip border-volt-500/30 bg-volt-500/10 text-volt-300"
                : "chip border-ink-600 bg-ink-700/60 text-slate-400"
            }
          >
            {faixa.ativo ? "Ativa" : "Inativa"}
          </span>
        )}
      </div>

      {estado.erro && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}
      {estado.ok && (
        <p className="rounded-lg border border-volt-500/30 bg-volt-500/10 px-3 py-2 text-xs text-volt-300">
          Salvo. A alteração ficou registrada no histórico abaixo.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo label="Nome do plano">
          <input
            name="nome"
            defaultValue={faixa?.nome ?? ""}
            maxLength={60}
            required
            className="inp"
          />
        </Campo>
        <Campo label="Valor mensal (R$)">
          <input
            name="preco_mensal"
            type="number"
            step="0.01"
            min="0"
            defaultValue={faixa ? Number(faixa.preco_mensal) : ""}
            required
            className="inp"
          />
        </Campo>
        <Campo label="Mínimo de alunos ativos">
          <input
            name="alunos_min"
            type="number"
            step="1"
            min="0"
            defaultValue={faixa?.alunos_min ?? 0}
            required
            className="inp"
          />
        </Campo>
        <Campo label="Máximo de alunos ativos" dica="Vazio = sem teto">
          <input
            name="alunos_max"
            type="number"
            step="1"
            min="0"
            defaultValue={faixa?.alunos_max ?? ""}
            className="inp"
          />
        </Campo>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Ordem de exibição">
          <input
            name="ordem"
            type="number"
            step="1"
            min="0"
            defaultValue={faixa?.ordem ?? 0}
            required
            className="inp"
          />
        </Campo>
        <Campo label="Descrição interna">
          <input
            name="descricao_interna"
            defaultValue={faixa?.descricao_interna ?? ""}
            className="inp"
          />
        </Campo>
      </div>

      <Campo label="Observações comerciais">
        <textarea
          name="observacoes_comerciais"
          defaultValue={faixa?.observacoes_comerciais ?? ""}
          rows={2}
          className="inp resize-y"
        />
      </Campo>

      <div className="grid gap-2 sm:grid-cols-3">
        <Marcador
          nome="ativo"
          label="Ativa"
          dica="Desativar preserva o histórico"
          defaultChecked={faixa?.ativo ?? true}
        />
        <Marcador
          nome="disponivel_novos_clientes"
          label="Disponível para novos clientes"
          defaultChecked={faixa?.disponivel_novos_clientes ?? true}
        />
        <Marcador
          nome="publico"
          label="Pode aparecer publicamente"
          dica="Hoje a landing mostra só o valor inicial"
          defaultChecked={faixa?.publico ?? false}
        />
      </div>

      <Campo label="Motivo da alteração" dica="Opcional, vai para o histórico">
        <input
          name="motivo"
          placeholder="Ex.: reajuste anual acordado em reunião comercial"
          className="inp"
        />
      </Campo>

      <div className="flex items-center gap-2.5 pt-1">
        {!faixa && (
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="btn-ghost"
          >
            Cancelar
          </button>
        )}
        <BotaoSalvar novo={!faixa} />
      </div>
    </form>
  );
}

function BotaoSalvar({ novo }: { novo: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-volt ml-auto">
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {pending ? "Salvando..." : novo ? "Criar faixa" : "Salvar alterações"}
    </button>
  );
}

function Campo({
  label,
  dica,
  children,
}: {
  label: string;
  dica?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label-muted">{label}</span>
      {dica && <span className="ml-1.5 text-[11px] text-slate-600">{dica}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Marcador({
  nome,
  label,
  dica,
  defaultChecked,
}: {
  nome: string;
  label: string;
  dica?: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-ink-600 bg-ink-800/60 px-3 py-2.5">
      <input
        type="checkbox"
        name={nome}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 shrink-0 accent-volt-400"
      />
      <span className="text-sm text-slate-300">
        {label}
        {dica && (
          <span className="mt-0.5 block text-[11px] text-slate-600">{dica}</span>
        )}
      </span>
    </label>
  );
}
