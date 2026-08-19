import Breadcrumbs from "@/components/painel/Breadcrumbs";
import ModeracaoComunidade from "@/components/painel/ModeracaoComunidade";
import { requireSecao } from "@/lib/auth";
import { getPostsModeracao } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ComunidadePainelPage({
  params,
}: {
  params: { slug: string };
}) {
  await requireSecao(params.slug, "comunidade");
  const posts = await getPostsModeracao(false, 50);

  return (
    <div className="space-y-6">
      <Breadcrumbs slug={params.slug} items={[{ label: "Comunidade" }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">Comunidade</h1>
        <p className="text-sm text-slate-400">
          Publicações dos alunos da sua academia. Remova conteúdo impróprio;
          denúncias aparecem em destaque.
        </p>
      </div>

      <ModeracaoComunidade slug={params.slug} postsIniciais={posts} />
    </div>
  );
}
