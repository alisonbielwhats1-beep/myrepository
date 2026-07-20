import { redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { PLANOS_SAAS } from "@/lib/planos";
import { sairAction } from "@/lib/actions/auth";
import NovaAcademiaModal from "./NovaAcademiaModal";
import AcademiaLista from "./AcademiaLista";
import { LogOut } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase());

  if (!adminEmails.includes(user.email?.toLowerCase() ?? "")) {
    redirect("/painel");
  }

  const admin = createServiceRoleClient();
  const { data: academiasDados } = await admin
    .from("academias")
    .select(`
      id, nome_fantasia, slug_url, plano_saas, criado_em,
      alunos:alunos(count),
      perfis:perfis_admin(count)
    `)
    .order("criado_em", { ascending: false });

  const academias = academiasDados ?? [];

  const totalAlunos = academias.reduce((acc, a) => {
    return acc + ((a.alunos as unknown as { count: number }[])?.[0]?.count ?? 0);
  }, 0);

  const mrr = academias.reduce((acc, a) => {
    const plano = PLANOS_SAAS.find(
      (p) => p.value === (a.plano_saas ?? "profissional")
    );
    return acc + (plano?.preco ?? 0);
  }, 0);

  const totalPorPlano = PLANOS_SAAS.map((p) => ({
    ...p,
    total: academias.filter(
      (a) => (a.plano_saas ?? "profissional") === p.value
    ).length,
  }));

  return (
    <div className="min-h-screen bg-ink-950 p-6 text-white">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin GestAcad</h1>
            <p className="text-sm text-slate-400">
              Painel interno — acesso restrito · {user.email}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <NovaAcademiaModal />
            <span className="chip border-magenta-500/30 bg-magenta-500/10 text-magenta-300 text-xs font-semibold uppercase tracking-wide">
              Super Admin
            </span>
            <form action={sairAction}>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-slate-400 hover:border-red-500/40 hover:text-red-400 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </form>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="surface rounded-2xl p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Academias
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-white">
              {academias.length}
            </p>
          </div>
          <div className="surface rounded-2xl p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              MRR estimado
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-volt-300">
              R${" "}
              {mrr.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
            </p>
          </div>
          <div className="surface rounded-2xl p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Total alunos
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-white">
              {totalAlunos}
            </p>
          </div>
          {totalPorPlano.map((p) => (
            <div key={p.value} className="surface rounded-2xl p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {p.label}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-white">
                {p.total}
              </p>
            </div>
          ))}
        </div>

        {/* Tabela */}
        <AcademiaLista academias={academias} />

        <p className="text-center text-xs text-slate-600">
          Alterações no plano têm efeito imediato · Remoção exclui academia e
          todos os dados permanentemente.
        </p>
      </div>
    </div>
  );
}
