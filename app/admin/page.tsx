import { redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { PlanoSaas } from "@/lib/types";
import { PLANOS_SAAS } from "@/lib/planos";
import PlanoSelect from "./PlanoSelect";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Só emails listados em ADMIN_EMAILS conseguem entrar
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase());

  if (!adminEmails.includes(user.email?.toLowerCase() ?? "")) {
    redirect("/painel");
  }

  // Busca todas as academias ignorando RLS
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

  const mrr = academias.reduce((acc, a) => {
    const plano = PLANOS_SAAS.find((p) => p.value === (a.plano_saas ?? "profissional"));
    return acc + (plano?.preco ?? 0);
  }, 0);

  const totalPorPlano = PLANOS_SAAS.map((p) => ({
    ...p,
    total: academias.filter((a) => (a.plano_saas ?? "profissional") === p.value).length,
  }));

  return (
    <div className="min-h-screen bg-ink-950 p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin GestAcad</h1>
            <p className="text-sm text-slate-400">Painel interno — acesso restrito</p>
          </div>
          <span className="chip border-magenta-500/30 bg-magenta-500/10 text-magenta-300 text-xs font-semibold uppercase tracking-wide">
            Super Admin
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="surface rounded-2xl p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Academias</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-white">{academias.length}</p>
          </div>
          <div className="surface rounded-2xl p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">MRR estimado</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-volt-300">
              R$ {mrr.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
            </p>
          </div>
          {totalPorPlano.map((p) => (
            <div key={p.value} className="surface rounded-2xl p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{p.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-white">{p.total}</p>
            </div>
          ))}
        </div>

        <div className="surface overflow-hidden rounded-2xl">
          <div className="border-b border-ink-700 px-5 py-4">
            <h2 className="font-semibold text-white">Todas as academias</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Academia</th>
                  <th className="px-5 py-3 font-medium">Slug</th>
                  <th className="px-5 py-3 font-medium">Alunos</th>
                  <th className="px-5 py-3 font-medium">Usuários</th>
                  <th className="px-5 py-3 font-medium">Cadastro</th>
                  <th className="px-5 py-3 font-medium">Plano</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/70">
                {academias.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                      Nenhuma academia cadastrada.
                    </td>
                  </tr>
                )}
                {academias.map((a) => {
                  const plano = (a.plano_saas ?? "profissional") as PlanoSaas;
                  const totalAlunos = (a.alunos as unknown as { count: number }[])?.[0]?.count ?? 0;
                  const totalPerfis = (a.perfis as unknown as { count: number }[])?.[0]?.count ?? 0;
                  return (
                    <tr key={a.id} className="hover:bg-ink-700/30">
                      <td className="px-5 py-3 font-medium text-white">{a.nome_fantasia}</td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-400">{a.slug_url}</td>
                      <td className="px-5 py-3 tabular-nums text-slate-300">{totalAlunos}</td>
                      <td className="px-5 py-3 tabular-nums text-slate-300">{totalPerfis}</td>
                      <td className="px-5 py-3 text-slate-400">
                        {new Date(a.criado_em).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-5 py-3">
                        <PlanoSelect academiaId={a.id} planoAtual={plano} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600">
          Alterações no plano têm efeito imediato.
        </p>
      </div>
    </div>
  );
}
