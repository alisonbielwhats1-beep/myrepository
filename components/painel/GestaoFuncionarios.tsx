"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import Image from "next/image";
import {
  Briefcase,
  CalendarClock,
  Mail,
  Pencil,
  Phone,
  Search,
  UserPlus,
  UserRound,
} from "lucide-react";
import { Funcionario, StatusFuncionario } from "@/lib/types";
import { cn, formatBRL } from "@/lib/utils";
import FormActions from "@/components/ui/FormActions";
import ConfirmButton from "@/components/ui/ConfirmButton";
import ImageUpload from "@/components/ui/ImageUpload";
import {
  atualizarFuncionario,
  criarFuncionario,
  excluirFuncionario,
} from "@/app/painel/[slug]/funcionarios/actions";

export default function GestaoFuncionarios({
  slug,
  funcionariosIniciais,
}: {
  slug: string;
  funcionariosIniciais: Funcionario[];
}) {
  const funcionarios = funcionariosIniciais;
  const [busca, setBusca] = useState("");
  const [mostrarNovo, setMostrarNovo] = useState(funcionarios.length === 0);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return funcionarios;
    return funcionarios.filter(
      (f) =>
        f.nome.toLowerCase().includes(q) ||
        f.cargo.toLowerCase().includes(q) ||
        (f.email ?? "").toLowerCase().includes(q)
    );
  }, [funcionarios, busca]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar por nome, cargo ou e-mail..."
            className="inp pl-9"
          />
        </div>
        <button
          onClick={() => setMostrarNovo((v) => !v)}
          className={mostrarNovo ? "btn-ghost" : "btn-volt"}
        >
          <UserPlus className="h-4 w-4" />
          {mostrarNovo ? "Fechar formulário" : "Cadastrar funcionário"}
        </button>
      </div>

      {mostrarNovo && (
        <FormularioFuncionario
          slug={slug}
          onCancelar={funcionarios.length > 0 ? () => setMostrarNovo(false) : undefined}
          onSalvo={() => setMostrarNovo(false)}
        />
      )}

      <div className="surface overflow-hidden rounded-2xl">
        <div className="border-b border-ink-700 px-5 py-3">
          <h2 className="font-semibold text-white">
            Funcionários{" "}
            <span className="text-sm font-normal text-slate-500">
              ({filtrados.length})
            </span>
          </h2>
        </div>

        {filtrados.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            {funcionarios.length === 0
              ? "Nenhum funcionário cadastrado ainda."
              : "Nenhum funcionário encontrado para essa busca."}
          </p>
        ) : (
          <ul className="divide-y divide-ink-700/70">
            {filtrados.map((f) =>
              editandoId === f.id ? (
                <li key={f.id} className="p-4">
                  <FormularioFuncionario
                    slug={slug}
                    funcionarioExistente={f}
                    onCancelar={() => setEditandoId(null)}
                    onSalvo={() => setEditandoId(null)}
                  />
                </li>
              ) : (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-ink-700/30"
                >
                  <div className="relative h-10 w-10 flex-none overflow-hidden rounded-full bg-ink-700 ring-1 ring-ink-600">
                    {f.foto_url ? (
                      <Image
                        src={f.foto_url}
                        alt={f.nome}
                        fill
                        sizes="40px"
                        className="media-native object-cover"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-slate-400">
                        <UserRound className="h-5 w-5" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">{f.nome}</p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 truncate text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3" /> {f.cargo}
                      </span>
                      {f.telefone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {f.telefone}
                        </span>
                      )}
                      {f.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {f.email}
                        </span>
                      )}
                    </p>
                  </div>
                  {f.salario ? (
                    <span className="hidden text-sm text-slate-300 sm:block">
                      {formatBRL(f.salario)}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "chip",
                      f.status === "ativo"
                        ? "border-volt-500/30 bg-volt-500/10 text-volt-300"
                        : "border-ink-600 bg-ink-700 text-slate-400"
                    )}
                  >
                    {f.status === "ativo" ? "Ativo" : "Inativo"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditandoId(f.id)}
                    title="Editar funcionário"
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-ink-700 hover:text-white"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <ConfirmButton
                    action={() => excluirFuncionario(slug, f.id)}
                    confirmText={`Excluir o funcionário "${f.nome}"?`}
                    label="Excluir funcionário"
                  />
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function FormularioFuncionario({
  slug,
  funcionarioExistente,
  onCancelar,
  onSalvo,
}: {
  slug: string;
  funcionarioExistente?: Funcionario;
  onCancelar?: () => void;
  onSalvo: () => void;
}) {
  const acao = funcionarioExistente
    ? atualizarFuncionario.bind(null, slug, funcionarioExistente.id)
    : criarFuncionario.bind(null, slug);
  const [estado, formAction] = useFormState(acao, {});
  const [foto, setFoto] = useState(funcionarioExistente?.foto_url ?? "");

  useEffect(() => {
    if (estado.ok) onSalvo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  return (
    <form action={formAction} className="surface rounded-2xl p-5">
      <h2 className="flex items-center gap-2 font-semibold text-white">
        <UserPlus className="h-4 w-4 text-volt-300" />
        {funcionarioExistente ? "Editar funcionário" : "Cadastrar funcionário"}
      </h2>

      {estado.erro && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-[130px_1fr]">
        {/* Foto */}
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Foto
          </span>
          <input type="hidden" name="foto_url" value={foto} />
          <ImageUpload
            value={foto}
            onChange={setFoto}
            aspect="aspect-square"
            hint="Foto do funcionário"
          />
        </div>

        {/* Demais campos */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome completo">
            <input
              name="nome"
              defaultValue={funcionarioExistente?.nome}
              placeholder="Ex: Ana Souza"
              className="inp"
              required
            />
          </Field>
          <Field label="Cargo">
            <input
              name="cargo"
              defaultValue={funcionarioExistente?.cargo}
              placeholder="Ex: Personal Trainer"
              className="inp"
              required
            />
          </Field>
          <Field label="Telefone">
            <input
              name="telefone"
              defaultValue={funcionarioExistente?.telefone ?? ""}
              placeholder="(11) 90000-0000"
              className="inp"
            />
          </Field>
          <Field label="E-mail">
            <input
              name="email"
              type="email"
              defaultValue={funcionarioExistente?.email ?? ""}
              placeholder="funcionario@email.com"
              className="inp"
            />
          </Field>
          <Field label="CPF">
            <input
              name="cpf"
              defaultValue={funcionarioExistente?.cpf ?? ""}
              placeholder="000.000.000-00"
              className="inp"
            />
          </Field>
          <Field label="Data de admissão">
            <input
              name="data_admissao"
              type="date"
              defaultValue={funcionarioExistente?.data_admissao ?? ""}
              className="inp"
            />
          </Field>
          <Field label="Salário (R$)">
            <input
              name="salario"
              type="number"
              min={0}
              step="0.01"
              defaultValue={funcionarioExistente?.salario ?? 0}
              className="inp"
            />
          </Field>
          <Field label="Dia de pagamento (1-31)">
            <input
              name="dia_pagamento"
              type="number"
              min={1}
              max={31}
              defaultValue={funcionarioExistente?.dia_pagamento ?? ""}
              placeholder="Ex: 5"
              className="inp"
            />
          </Field>
          <Field label="Status">
            <select
              name="status"
              defaultValue={funcionarioExistente?.status ?? ("ativo" as StatusFuncionario)}
              className="inp"
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </Field>
        </div>
      </div>

      <p className="mt-3 flex items-start gap-2 rounded-lg border border-ink-600 bg-ink-900/40 px-3 py-2 text-xs text-slate-400">
        <CalendarClock className="mt-0.5 h-3.5 w-3.5 flex-none text-volt-300" />
        Com salário e dia de pagamento preenchidos, o sistema lança
        automaticamente a <b className="text-slate-300">despesa de salário</b>{" "}
        (categoria Salários) na data do pagamento, todo mês.
      </p>

      <FormActions
        onCancelar={onCancelar}
        salvarLabel={funcionarioExistente ? "Salvar alterações" : "Adicionar funcionário"}
        className="mt-4"
      />
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}
