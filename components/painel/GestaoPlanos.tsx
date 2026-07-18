"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { CreditCard, Pencil, Plus, RefreshCw, Tag } from "lucide-react";
import { Plano } from "@/lib/types";
import { cn, formatBRL } from "@/lib/utils";
import FormActions from "@/components/ui/FormActions";
import ConfirmButton from "@/components/ui/ConfirmButton";
import {
  atualizarPlano,
  criarPlano,
  excluirPlano,
} from "@/app/painel/[slug]/planos/actions";

function periodoLabel(meses: number): string {
  if (meses === 1) return "mensal";
  if (meses === 12) return "anual";
  return `a cada ${meses} meses`;
}

export default function GestaoPlanos({
  slug,
  planos,
}: {
  slug: string;
  planos: Plano[];
}) {
  const [novo, setNovo] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-white">
            <Tag className="h-4 w-4 text-volt-300" /> Planos
          </h2>
          <p className="text-sm text-slate-400">
            Defina os planos e se cada um gera cobrança automática todo ciclo.
          </p>
        </div>
        <button
          onClick={() => setNovo((v) => !v)}
          className={novo ? "btn-ghost" : "btn-volt"}
        >
          <Plus className="h-4 w-4" />
          {novo ? "Fechar" : "Novo plano"}
        </button>
      </div>

      {novo && (
        <FormularioPlano
          slug={slug}
          onCancelar={() => setNovo(false)}
          onSalvo={() => setNovo(false)}
        />
      )}

      {planos.length === 0 ? (
        <div className="surface rounded-2xl p-6 text-center text-sm text-slate-400">
          Nenhum plano cadastrado ainda.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {planos.map((p) =>
            editandoId === p.id ? (
              <div key={p.id} className="sm:col-span-2">
                <FormularioPlano
                  slug={slug}
                  planoExistente={p}
                  onCancelar={() => setEditandoId(null)}
                  onSalvo={() => setEditandoId(null)}
                />
              </div>
            ) : (
              <div
                key={p.id}
                className={cn("surface rounded-2xl p-4", !p.ativo && "opacity-60")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{p.nome}</p>
                    <p className="text-xs text-slate-500">
                      {periodoLabel(p.recorrencia_meses)}
                      {!p.ativo && " · inativo"}
                    </p>
                  </div>
                  <span className="flex-none font-bold text-volt-300">
                    {formatBRL(p.valor_mensal)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {p.cobranca_recorrente ? (
                    <span className="chip border-volt-500/30 bg-volt-500/10 text-volt-300">
                      <RefreshCw className="h-3 w-3" /> cobrança automática
                    </span>
                  ) : (
                    <span className="chip border-ink-600 bg-ink-700/60 text-slate-400">
                      <CreditCard className="h-3 w-3" /> pago na hora
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-1 border-t border-ink-700 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditandoId(p.id)}
                    title="Editar plano"
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-ink-700 hover:text-white"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <div className="ml-auto">
                    <ConfirmButton
                      action={() => excluirPlano(slug, p.id)}
                      confirmText={`Excluir o plano "${p.nome}"?`}
                      label="Excluir plano"
                    />
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}

function FormularioPlano({
  slug,
  planoExistente,
  onCancelar,
  onSalvo,
}: {
  slug: string;
  planoExistente?: Plano;
  onCancelar?: () => void;
  onSalvo: () => void;
}) {
  const acao = planoExistente
    ? atualizarPlano.bind(null, slug, planoExistente.id)
    : criarPlano.bind(null, slug);
  const [estado, formAction] = useFormState(acao, {});

  useEffect(() => {
    if (estado.ok) onSalvo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  return (
    <form action={formAction} className="surface rounded-2xl p-5">
      <h3 className="font-semibold text-white">
        {planoExistente ? "Editar plano" : "Novo plano"}
      </h3>
      {estado.erro && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Nome</span>
          <input
            name="nome"
            defaultValue={planoExistente?.nome}
            placeholder="Ex: Mensal"
            className="inp"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Valor (R$)
          </span>
          <input
            name="valor_mensal"
            type="number"
            min={0}
            step="0.01"
            defaultValue={planoExistente?.valor_mensal ?? ""}
            className="inp"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Recorrência (meses)
          </span>
          <input
            name="recorrencia_meses"
            type="number"
            min={1}
            defaultValue={planoExistente?.recorrencia_meses ?? 1}
            className="inp"
          />
          <span className="mt-1 block text-[11px] text-slate-500">
            1 = mensal, 3 = trimestral, 12 = anual
          </span>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Descrição
          </span>
          <input
            name="descricao"
            defaultValue={planoExistente?.descricao ?? ""}
            placeholder="Ex: Acesso completo à academia"
            className="inp"
          />
        </label>
      </div>

      <label className="mt-3 flex items-start gap-2 rounded-lg border border-ink-600 bg-ink-900/40 p-3 text-sm text-slate-300">
        <input
          type="checkbox"
          name="cobranca_recorrente"
          defaultChecked={planoExistente?.cobranca_recorrente ?? true}
          className="mt-0.5 h-4 w-4 rounded border-ink-600 bg-ink-900 accent-volt-400"
        />
        <span>
          <b className="text-white">Cobrança automática</b> — gera a mensalidade
          pendente a cada ciclo (mensal todo mês; trimestral/anual a cada N
          meses). Desmarque para planos <b>pagos na hora / à vista</b>.
        </span>
      </label>

      <label className="mt-2 flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          name="ativo"
          defaultChecked={planoExistente?.ativo ?? true}
          className="h-4 w-4 rounded border-ink-600 bg-ink-900 accent-volt-400"
        />
        Plano ativo (aparece no mini-site e na matrícula)
      </label>

      <FormActions
        onCancelar={onCancelar}
        salvarLabel={planoExistente ? "Salvar alterações" : "Criar plano"}
        className="mt-4"
      />
    </form>
  );
}
