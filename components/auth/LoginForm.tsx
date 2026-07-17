"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, Loader2, LogIn, Lock, Mail } from "lucide-react";
import { entrarAction, EstadoLogin } from "@/lib/actions/auth";

const ESTADO_INICIAL: EstadoLogin = {};

export default function LoginForm() {
  const [estado, formAction] = useFormState(entrarAction, ESTADO_INICIAL);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {estado.erro && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 flex-none" />
          {estado.erro}
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-400">
          E-mail
        </span>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            placeholder="admin@suaacademia.com"
            className="inp pl-9"
          />
        </div>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-400">
          Senha
        </span>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            name="senha"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="inp pl-9"
          />
        </div>
      </label>

      <BotaoEntrar />
    </form>
  );
}

function BotaoEntrar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-volt w-full">
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogIn className="h-4 w-4" />
      )}
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}
