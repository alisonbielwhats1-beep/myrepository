import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, LogOut, PauseCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { sairAction } from "@/lib/actions/auth";
import { destinoAlunoLogado, hrefAreaAluno } from "@/lib/acesso-aluno-sessao";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";

export const dynamic = "force-dynamic";

/**
 * Entrada do aluno pela SESSÃO (Fase 3). Sem token na URL: resolve o vínculo da
 * conta autenticada e leva à área existente. É para cá que a ativação e os
 * próximos acessos apontam — "entrar uma vez e continuar conectado".
 *
 *   sem sessão      -> login (guardando o destino /aluno);
 *   1 vínculo ativo -> redireciona à área do aluno;
 *   vários ativos   -> seleção de academia;
 *   só suspensos    -> aviso de acesso suspenso;
 *   nenhum vínculo  -> conta sem acesso de aluno (ex.: logou antes de ativar).
 */
export default async function AlunoEntradaPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/aluno");

  const destino = await destinoAlunoLogado();
  if (destino.tipo === "area") redirect(destino.href);

  return (
    <Moldura>
      {destino.tipo === "selecao" ? (
        <>
          <p className="label-muted">Suas academias</p>
          <h1 className="mt-1 text-xl font-bold text-white">Escolha uma academia</h1>
          <p className="mt-1 mb-5 text-sm text-slate-400">
            Sua conta tem acesso a mais de uma academia. Selecione qual quer abrir.
          </p>
          <ul className="space-y-2">
            {destino.vinculos.map((v) => (
              <li key={v.alunoId}>
                <Link
                  href={hrefAreaAluno(v)}
                  className="flex items-center justify-between rounded-2xl border border-ink-600 bg-ink-900/50 px-4 py-3 text-sm font-medium text-white transition hover:border-volt-500/50 hover:bg-ink-800"
                >
                  {v.academiaNome}
                  <span className="text-xs text-volt-300">Abrir →</span>
                </Link>
              </li>
            ))}
          </ul>
          <Sair />
        </>
      ) : destino.tipo === "suspenso" ? (
        <div className="space-y-3 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-500/15 text-amber-300">
            <PauseCircle className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold text-white">Acesso suspenso</h1>
          <p className="text-sm text-slate-400">
            Seu acesso está suspenso no momento. Fale com a sua academia para
            regularizar. Se você tem acesso a outra academia, ele continua válido.
          </p>
          <Sair />
        </div>
      ) : (
        <div className="space-y-3 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-500/15 text-amber-300">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold text-white">Nenhum acesso ativo</h1>
          <p className="text-sm text-slate-400">
            Esta conta ainda não está vinculada a nenhuma academia. Se você
            recebeu um convite, abra o link do convite para ativar seu acesso.
          </p>
          <Sair />
        </div>
      )}
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-ink-950 bg-grid-fade px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-volt-500/10 blur-[120px]" />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <div className="surface rounded-3xl p-7 shadow-card">{children}</div>
      </div>
    </main>
  );
}

function Sair() {
  return (
    <form action={sairAction} className="mt-5">
      <button
        type="submit"
        className="mx-auto flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300"
      >
        <LogOut className="h-3.5 w-3.5" /> Sair
      </button>
    </form>
  );
}
