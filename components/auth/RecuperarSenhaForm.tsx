"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2, Mail, Send } from "lucide-react";
import { solicitarResetSenha, EstadoReset } from "@/lib/actions/auth";

const INICIAL: EstadoReset = {};

/** Intervalo mínimo entre dois pedidos para o mesmo e-mail, no provedor. */
const ESPERA_SEGUNDOS = 60;

export default function RecuperarSenhaForm() {
  const [estado, formAction] = useFormState(solicitarResetSenha, INICIAL);

  if (estado.ok) return <Enviado />;

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

/**
 * Confirmação do envio.
 *
 * Diz explicitamente que existe um intervalo mínimo entre pedidos. Antes a tela
 * só mostrava "E-mail enviado!", então pedir várias vezes seguidas parecia dar
 * certo todas as vezes — quatro pedidos, dois e-mails, nenhuma pista do porquê.
 * O contador só libera "Pedir de novo" quando o novo envio tem chance real de
 * sair, em vez de gastar a cota do provedor em cliques que seriam recusados.
 */
function Enviado() {
  const [restam, setRestam] = useState(ESPERA_SEGUNDOS);

  useEffect(() => {
    if (restam <= 0) return;
    const t = setTimeout(() => setRestam((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [restam]);

  return (
    <div className="mt-6 space-y-3">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
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

      <p className="text-xs text-slate-500">
        Só é possível pedir um link por minuto para o mesmo e-mail — pedidos
        seguidos são recusados pelo provedor e não geram um novo e-mail.
      </p>

      <button
        type="button"
        onClick={() => window.location.reload()}
        disabled={restam > 0}
        className="btn-ghost w-full disabled:opacity-50"
      >
        {restam > 0 ? `Pedir de novo em ${restam}s` : "Pedir de novo"}
      </button>
    </div>
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
