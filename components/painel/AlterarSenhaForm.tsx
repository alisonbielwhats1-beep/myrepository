"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import {
  alterarSenhaAction,
  type EstadoAlterarSenha,
} from "@/lib/actions/auth";
import CampoSenha from "@/components/ui/CampoSenha";

const INICIAL: EstadoAlterarSenha = {};

/**
 * Troca de senha do próprio usuário logado. Exige a senha atual — a
 * reautenticação acontece no servidor (alterarSenhaAction). Serve a qualquer
 * papel: cada pessoa só altera a própria senha.
 */
export default function AlterarSenhaForm() {
  const [estado, formAction] = useFormState(alterarSenhaAction, INICIAL);
  const formRef = useRef<HTMLFormElement>(null);

  // Limpa os campos após sucesso: nada de senha (velha ou nova) permanecer
  // preenchido na tela depois de trocada.
  useEffect(() => {
    if (estado.ok) formRef.current?.reset();
  }, [estado.ok]);

  return (
    <form ref={formRef} action={formAction} className="surface space-y-4 rounded-2xl p-5">
      <div>
        <h2 className="flex items-center gap-2 font-semibold text-white">
          <KeyRound className="h-4 w-4 text-volt-300" /> Alterar minha senha
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Vale só para o seu acesso. O e-mail de login continua o mesmo.
        </p>
      </div>

      {estado.erro && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 flex-none" />
          {estado.erro}
        </div>
      )}
      {estado.ok && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          <CheckCircle2 className="h-4 w-4 flex-none" />
          Senha alterada com sucesso.
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-400">Senha atual</span>
        <CampoSenha name="senha_atual" autoComplete="current-password" required />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Nova senha</span>
          <CampoSenha
            name="senha_nova"
            autoComplete="new-password"
            minLength={8}
            placeholder="mínimo 8 caracteres"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Confirmar nova senha</span>
          <CampoSenha
            name="senha_confirmar"
            autoComplete="new-password"
            minLength={8}
            placeholder="repita a nova senha"
            required
          />
        </label>
      </div>

      <BotaoSalvar />
    </form>
  );
}

function BotaoSalvar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-volt">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
      {pending ? "Salvando..." : "Salvar nova senha"}
    </button>
  );
}
