"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2, Mail, Send } from "lucide-react";
import { solicitarResetSenha, EstadoReset } from "@/lib/actions/auth";

const INICIAL: EstadoReset = {};

export default function RecuperarSenhaForm() {
  const [estado, formAction] = useFormState(solicitarResetSenha, INICIAL);

  if (estado.ok) {
    return (
      <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none" />
          <div>
            <p className="font-medium">E-mail enviado!</p>
            <p className="mt-1 text-emerald-200/80">
              Se houver uma conta com esse e-mail, você receberá um link para
              criar uma nova senha. Verifique também a caixa de spam.
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
        <span className="mb-1 block text-xs font-medium text-slate-400">E-mail da conta</span>
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

      <BotaoEnviar />
    </form>
  );
}

function BotaoEnviar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-volt w-full">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      {pending ? "Enviando..." : "Enviar link de recuperação"}
    </button>
  );
}
