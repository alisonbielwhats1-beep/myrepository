"use client";

import { useEffect, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { Loader2, Plus, ShieldCheck, UserPlus, UserRound } from "lucide-react";
import { LIMITE_MEMBROS_EQUIPE } from "@/lib/permissoes";
import { PAPEIS, Papel, PerfilEquipe } from "@/lib/types";
import { cn } from "@/lib/utils";
import ConfirmButton from "@/components/ui/ConfirmButton";
import FormActions from "@/components/ui/FormActions";
import {
  alterarPapel,
  criarMembroEquipe,
  removerMembroEquipe,
} from "@/app/painel/[slug]/equipe/actions";

export default function GestaoEquipe({
  slug,
  perfis,
  meuId,
  souDono,
}: {
  slug: string;
  perfis: PerfilEquipe[];
  meuId: string;
  souDono: boolean;
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const noLimite = perfis.length >= LIMITE_MEMBROS_EQUIPE;

  return (
    <div className="space-y-4">
      {souDono && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-400">
            {perfis.length}/{LIMITE_MEMBROS_EQUIPE} pessoas na equipe
          </p>
          <button
            onClick={() => setMostrarForm((v) => !v)}
            disabled={!mostrarForm && noLimite}
            className={cn(mostrarForm ? "btn-ghost" : "btn-volt", "disabled:opacity-50")}
            title={noLimite && !mostrarForm ? "Limite de 5 pessoas atingido" : undefined}
          >
            <Plus className="h-4 w-4" />
            {mostrarForm ? "Fechar" : "Adicionar pessoa"}
          </button>
        </div>
      )}

      {mostrarForm && (
        <FormularioMembro slug={slug} onSalvo={() => setMostrarForm(false)} />
      )}

      <ul className="space-y-3">
        {perfis.map((p) => (
          <LinhaMembro
            key={p.id}
            slug={slug}
            perfil={p}
            euMesmo={p.id === meuId}
            souDono={souDono}
          />
        ))}
      </ul>
    </div>
  );
}

function FormularioMembro({
  slug,
  onSalvo,
}: {
  slug: string;
  onSalvo: () => void;
}) {
  const acao = criarMembroEquipe.bind(null, slug);
  const [estado, formAction] = useFormState(acao, {});

  useEffect(() => {
    if (estado.ok) onSalvo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  return (
    <form action={formAction} className="surface rounded-2xl p-5">
      <h3 className="flex items-center gap-2 font-semibold text-white">
        <UserPlus className="h-4 w-4 text-volt-300" /> Nova pessoa na equipe
      </h3>

      {estado.erro && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Nome</span>
          <input name="nome" placeholder="Ex: Maria Silva" className="inp" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">E-mail</span>
          <input
            name="email"
            type="email"
            placeholder="maria@academia.com"
            className="inp"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Senha</span>
          <input
            name="senha"
            type="password"
            placeholder="mínimo 6 caracteres"
            className="inp"
            minLength={6}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Papel</span>
          <select name="papel" defaultValue="recepcao" className="inp">
            {PAPEIS.filter((p) => p.value !== "dono").map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <FormActions salvarLabel="Criar acesso" className="mt-4" />
    </form>
  );
}

function LinhaMembro({
  slug,
  perfil,
  euMesmo,
  souDono,
}: {
  slug: string;
  perfil: PerfilEquipe;
  euMesmo: boolean;
  souDono: boolean;
}) {
  const [papel, setPapel] = useState<Papel>(perfil.papel);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const mudar = (novo: Papel) => {
    setErro(null);
    setPapel(novo);
    iniciar(async () => {
      const r = await alterarPapel(slug, perfil.id, novo);
      if (r.erro) {
        setErro(r.erro);
        setPapel(perfil.papel);
      }
    });
  };

  const podeEditar = souDono && !euMesmo;

  return (
    <li className="surface flex flex-wrap items-center gap-3 rounded-2xl p-4">
      <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-ink-700 text-slate-300">
        <UserRound className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">
          {perfil.nome}
          {euMesmo && <span className="ml-2 text-xs text-slate-500">(você)</span>}
        </p>
        <p className="truncate text-xs text-slate-500">{perfil.email}</p>
      </div>

      {podeEditar ? (
        <div className="flex items-center gap-2">
          <select
            value={papel}
            onChange={(e) => mudar(e.target.value as Papel)}
            disabled={pendente}
            className="inp !w-auto !py-2 text-sm"
          >
            {PAPEIS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          {pendente && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          <ConfirmButton
            action={async () => {
              const r = await removerMembroEquipe(slug, perfil.id);
              if (r.erro) setErro(r.erro);
            }}
            confirmText={`Remover "${perfil.nome}" da equipe? O login dessa pessoa deixa de funcionar.`}
            label="Remover da equipe"
          />
        </div>
      ) : (
        <span
          className={cn(
            "chip",
            perfil.papel === "dono"
              ? "border-volt-500/30 bg-volt-500/10 text-volt-300"
              : "border-ink-600 bg-ink-700/60 text-slate-300"
          )}
        >
          <ShieldCheck className="h-3 w-3" />
          {PAPEIS.find((x) => x.value === perfil.papel)?.label}
        </span>
      )}

      {erro && <p className="w-full text-xs text-red-400">{erro}</p>}
    </li>
  );
}
