"use client";

import { useEffect, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, Check, Loader2, Mail, MailCheck, ShieldCheck } from "lucide-react";
import {
  cadastrarEmailSenhaAtivacao,
  reenviarConfirmacaoAtivacao,
  type EstadoCadastroEmail,
} from "@/lib/actions/ativacao";
import { TEM_LOGIN_SOCIAL } from "@/lib/auth-config";
import BotoesSociais from "@/components/auth/BotoesSociais";
import CampoSenha from "@/components/ui/CampoSenha";

const ESTADO_INICIAL: EstadoCadastroEmail = {};

/**
 * Escolha do método de acesso na ativação do convite. Os três caminhos
 * (Google, Apple, e-mail/senha) convergem para o MESMO processo seguro: depois
 * de autenticado, /ativar/continuar vincula a conta ao aluno do convite. O
 * convite (cookie seguro) define QUAL aluno — o e-mail/provedor define só COMO
 * a pessoa entra.
 */
export default function AtivacaoMetodos({
  academiaNome,
  alunoNomeMascarado,
}: {
  academiaNome: string;
  alunoNomeMascarado: string;
}) {
  const [estado, formAction] = useFormState(
    cadastrarEmailSenhaAtivacao,
    ESTADO_INICIAL
  );

  if (estado.confirmar) {
    return <TelaConfirmarEmail email={estado.email} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-xl border border-volt-500/20 bg-volt-500/[0.06] px-3 py-2.5 text-sm text-slate-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-volt-300" />
        <span>
          Convite de <strong className="text-white">{academiaNome}</strong> para{" "}
          <strong className="text-white">{alunoNomeMascarado}</strong>. Escolha
          como quer acessar — pode ser um e-mail diferente do que a academia tem.
        </span>
      </div>

      <BotoesSociais next="/ativar/continuar" />

      {TEM_LOGIN_SOCIAL && (
        <div className="flex items-center gap-3" role="separator" aria-label="ou">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-xs uppercase tracking-wide text-slate-500">ou</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
      )}

      <form action={formAction} className="space-y-4">
        {estado.erro && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 flex-none" />
            {estado.erro}
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            E-mail para login
          </span>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              placeholder="voce@email.com"
              className="inp pl-9"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Criar senha
          </span>
          <CampoSenha
            name="senha"
            autoComplete="new-password"
            required
            placeholder="mínimo 8 caracteres"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Confirmar senha
          </span>
          <CampoSenha
            name="confirmar"
            autoComplete="new-password"
            required
            placeholder="repita a senha"
          />
        </label>

        <p className="text-xs text-slate-500">
          A senha deve ter pelo menos 8 caracteres. Confirmaremos seu e-mail
          antes de ativar o acesso.
        </p>

        <BotaoCriar />
      </form>
    </div>
  );
}

/** Tela de confirmação pendente com reenvio (cooldown de 30s anti-spam). */
function TelaConfirmarEmail({ email }: { email?: string }) {
  const [pending, start] = useTransition();
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const reenviar = () => {
    if (!email || cooldown > 0) return;
    setErro(null);
    start(async () => {
      const r = await reenviarConfirmacaoAtivacao(email);
      if (r.ok) {
        setEnviado(true);
        setCooldown(30);
      } else {
        setErro(r.erro ?? "Não foi possível reenviar agora.");
      }
    });
  };

  return (
    <div className="space-y-3 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-volt-500/15 text-volt-300">
        <MailCheck className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-bold text-white">Confirme seu e-mail</h2>
      <p className="text-sm text-slate-400">
        Enviamos um link de confirmação{email ? <> para <strong className="text-slate-200">{email}</strong></> : ""}.
        Abra a mensagem e clique no link para concluir a ativação do seu acesso.
      </p>
      <p className="text-xs text-slate-500">
        Não recebeu? Verifique a caixa de spam. O link vale por tempo limitado.
      </p>

      {email && (
        <div className="pt-1">
          {enviado && cooldown > 0 ? (
            <p className="flex items-center justify-center gap-1.5 text-xs text-volt-300">
              <Check className="h-3.5 w-3.5" /> E-mail reenviado. Aguarde {cooldown}s para reenviar.
            </p>
          ) : (
            <button
              type="button"
              onClick={reenviar}
              disabled={pending || cooldown > 0}
              className="btn-ghost mx-auto text-xs disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar e-mail de confirmação"}
            </button>
          )}
          {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}
        </div>
      )}
    </div>
  );
}

function BotaoCriar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-volt w-full">
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? "Criando conta..." : "Criar conta com e-mail e senha"}
    </button>
  );
}
