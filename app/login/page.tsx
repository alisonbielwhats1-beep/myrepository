import Link from "next/link";
import LoginForm from "@/components/auth/LoginForm";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";

export default function LoginPage() {
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
