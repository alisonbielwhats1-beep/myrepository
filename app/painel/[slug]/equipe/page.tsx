import Breadcrumbs from "@/components/painel/Breadcrumbs";
import GestaoEquipe from "@/components/painel/GestaoEquipe";
import MigracaoPendente from "@/components/painel/MigracaoPendente";
import UpgradeGuard from "@/components/ui/UpgradeGuard";
import { requireSecao } from "@/lib/auth";
import { getPerfisEquipe } from "@/lib/data";
import { PAPEIS } from "@/lib/types";
import { planoPodeAcessar, planoMinimo } from "@/lib/planos";

export const dynamic = "force-dynamic";

export default async function EquipePage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSecao(params.slug, "equipe");

  if (!planoPodeAcessar(sessao.academia.plano_saas, "equipe")) {
    return (
      <UpgradeGuard
        recurso="equipe"
        planoAtual={sessao.academia.plano_saas}
        planoNecessario={planoMinimo("equipe")}
        slug={params.slug}
        titulo="Múltiplos usuários disponível no Profissional"
        descricao="Adicione recepcionistas e instrutores com acesso controlado ao painel."
      />
    );
  }

  let perfis: Awaited<ReturnType<typeof getPerfisEquipe>> = [];
  try {
    perfis = await getPerfisEquipe(sessao.academia.id);
  } catch {
    return (
      <div className="space-y-6">
        <Breadcrumbs slug={params.slug} items={[{ label: "Equipe" }]} />
        <MigracaoPendente
          arquivo="008_papeis_e_historico_plano.sql"
          recurso="A gestão de equipe"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs slug={params.slug} items={[{ label: "Equipe" }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">Equipe e permissões</h1>
        <p className="text-sm text-slate-400">
          Defina o que cada pessoa pode acessar no painel.
        </p>
      </div>

      <div className="surface rounded-2xl p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          O que cada papel enxerga
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {PAPEIS.map((p) => (
            <li key={p.value} className="flex items-start gap-2 text-sm">
              <span className="chip mt-0.5 flex-none border-ink-600 bg-ink-700/60 text-slate-200">
                {p.label}
              </span>
              <span className="text-slate-400">{p.descricao}</span>
            </li>
          ))}
        </ul>
      </div>

      <GestaoEquipe
        slug={params.slug}
        perfis={perfis}
        meuId={sessao.userId}
        souDono={sessao.papel === "dono"}
      />
    </div>
  );
}
