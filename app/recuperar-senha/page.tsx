import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import RecuperarSenhaForm from "@/components/auth/RecuperarSenhaForm";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";

export default function RecuperarSenhaPage() {
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
          <p className="label-muted">Recuperação de acesso</p>
          <h1 className="mt-1 text-xl font-bold text-white">Esqueceu a senha?</h1>
          <p className="mt-1 text-sm text-slate-400">
            Informe o e-mail da conta e enviaremos um link para você criar uma nova senha.
          </p>

          <RecuperarSenhaForm />
        </div>

        <Link
          href="/login"
          className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o login
        </Link>
      </div>
    </main>
  );
}
