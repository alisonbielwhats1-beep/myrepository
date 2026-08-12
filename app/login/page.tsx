import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import LoginForm from "@/components/auth/LoginForm";
import BotoesSociais from "@/components/auth/BotoesSociais";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { TEM_LOGIN_SOCIAL } from "@/lib/auth-config";
import { caminhoInternoSeguro } from "@/lib/redirecionamento";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { erro?: string; next?: string };
}) {
  // /auth/callback manda para cá com ?erro=link_invalido quando um link de
  // confirmação/convite falha a troca por sessão (expirado, já usado).
  const linkInvalido = searchParams.erro === "link_invalido";
  // Destino pós-login (deep link), sempre validado como caminho interno.
  const next = caminhoInternoSeguro(searchParams.next, "/painel");

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-ink-950 bg-grid-fade px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-volt-500/10 blur-[120px]" />

      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>

        <div className="surface rounded-3xl p-7 shadow-card">
          <p className="label-muted">Painel da academia</p>
          <h1 className="mt-1 text-xl font-bold text-white">
            Entrar na sua conta
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Acesse com o e-mail e senha do administrador da academia.
          </p>

          {linkInvalido && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              <span>
                O link que você abriu expirou ou já foi usado. Entre com e-mail e
                senha.
              </span>
            </div>
          )}

          {TEM_LOGIN_SOCIAL && (
            <div className="mt-6 space-y-4">
              <BotoesSociais next={next} />
              <div className="flex items-center gap-3" role="separator" aria-label="ou">
                <span className="h-px flex-1 bg-white/10" />
                <span className="text-xs uppercase tracking-wide text-slate-500">ou</span>
                <span className="h-px flex-1 bg-white/10" />
              </div>
            </div>
          )}

          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Ainda não tem uma conta?{" "}
          <span className="text-slate-400">
            Peça ao suporte para provisionar sua academia.
          </span>
        </p>
      </div>
    </main>
  );
}
