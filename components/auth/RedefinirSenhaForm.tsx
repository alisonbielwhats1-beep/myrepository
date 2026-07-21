"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2, Lock, Save } from "lucide-react";
import { redefinirSenhaAction, EstadoReset } from "@/lib/actions/auth";

const INICIAL: EstadoReset = {};

export default function RedefinirSenhaForm() {
  const [estado, formAction] = useFormState(redefinirSenhaAction, INICIAL);
  const router = useRouter();

  useEffect(() => {
    if (estado.ok) {
      const t = setTimeout(() => router.push("/login"), 2000);
      return () => clearTimeout(t);
    }
  }, [estado.ok, router]);

  if (estado.ok) {
    return (
      <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none" />
          <div>
            <p className="font-medium">Senha redefinida!</p>
            <p className="mt-1 text-emerald-200/80">
              Redirecionando para o login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {estado.erro && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 flex-none" />
          {estado.erro}
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-400">Nova senha</span>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            name="senha"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="mínimo 8 caracteres"
            className="inp pl-9"
          />
        </div>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-400">Confirmar nova senha</span>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            name="confirmar"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="repita a senha"
            className="inp pl-9"
          />
        </div>
      </label>

      <BotaoSalvar />
    </form>
  );
}

function BotaoSalvar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-volt w-full">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {pending ? "Salvando..." : "Redefinir senha"}
    </button>
  );
}
