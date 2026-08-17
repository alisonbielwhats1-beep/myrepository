"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, Save } from "lucide-react";
import { redefinirSenhaAction, EstadoReset } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { PAGINA_PEDIR_LINK } from "@/lib/recuperacao-senha";
import CampoSenha from "@/components/ui/CampoSenha";

const INICIAL: EstadoReset = {};

/** Enquanto o link é validado, "verificando"; sem sessão de recuperação, "sem_sessao". */
type EstadoSessao = "verificando" | "pronto" | "sem_sessao";

export default function RedefinirSenhaForm() {
  const [estado, formAction] = useFormState(redefinirSenhaAction, INICIAL);
  const router = useRouter();
  const [sessao, setSessao] = useState<EstadoSessao>("verificando");

  /**
   * Confirma que existe sessão de recuperação ANTES de mostrar o formulário.
   * Sem isso, um link expirado abria a tela normalmente e só falhava depois de
   * a pessoa digitar a senha duas vezes — parecia bug do app, não link velho.
   *
   * No fluxo com token no fragmento a sessão nasce no cliente, e o
   * GateRecuperacaoSenha pode ainda estar trocando o token quando este
   * componente monta. Por isso ouvimos o `onAuthStateChange` e só concluímos
   * "sem sessão" depois de uma folga curta.
   */
  useEffect(() => {
    const supabase = createClient();
    let encerrado = false;

    const { data } = supabase.auth.onAuthStateChange((_evento, s) => {
      if (!encerrado && s) setSessao("pronto");
    });

    let prazo: ReturnType<typeof setTimeout>;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (encerrado) return;
      if (session) {
        setSessao("pronto");
        return;
      }
      // Dá tempo de o gate concluir a troca do token antes de acusar falha.
      prazo = setTimeout(() => {
        if (!encerrado) setSessao((s) => (s === "verificando" ? "sem_sessao" : s));
      }, 3000);
    });

    return () => {
      encerrado = true;
      clearTimeout(prazo);
      data.subscription.unsubscribe();
    };
  }, []);

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

  if (sessao === "verificando") {
    return (
      <p className="mt-6 flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Validando seu link...
      </p>
    );
  }

  if (sessao === "sem_sessao") {
    return (
      <div className="mt-6 space-y-4">
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <span>
            Este link de recuperação expirou, já foi usado, ou foi aberto em
            outro navegador. Peça um novo — leva menos de um minuto.
          </span>
        </div>
        <Link href={PAGINA_PEDIR_LINK} className="btn-volt w-full">
          Pedir novo link
        </Link>
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
        <CampoSenha
          name="senha"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="mínimo 8 caracteres"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-400">Confirmar nova senha</span>
        <CampoSenha
          name="confirmar"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="repita a senha"
        />
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
