import RedesSociaisAcademia from "@/components/aluno/comunidade/RedesSociaisAcademia";
import FeedComunidade from "@/components/aluno/comunidade/FeedComunidade";
import { requireFichaAluno } from "@/lib/aluno-publico";
import { getAcademiaPublica, getFeedComunidade } from "@/lib/data";
import {
  alternarCurtida,
  comentarPost,
  criarPost,
  denunciarPost,
  excluirComentario,
  excluirPost,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function ComunidadePage({
  params,
}: {
  params: { slug: string; token: string };
}) {
  const ficha = await requireFichaAluno(params.slug, params.token);
  const [posts, academiaPublica] = await Promise.all([
    getFeedComunidade(params.token, params.slug, 20),
    getAcademiaPublica(params.slug),
  ]);

  const eu = {
    nome: ficha.aluno.nome,
    foto_url: ficha.aluno.foto_perfil_url,
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-slate-400">{ficha.academia.nome_fantasia}</p>
        <h1 className="text-2xl font-bold text-white">Comunidade</h1>
      </header>

      <RedesSociaisAcademia academia={academiaPublica} />

      <FeedComunidade
        academiaNome={ficha.academia.nome_fantasia}
        eu={eu}
        postsIniciais={posts}
        criar={criarPost.bind(null, params.slug, params.token)}
        acoes={{
          // .bind gera uma *bound server action* — que PODE ser passada a um
          // Client Component. Uma função comum embrulhando a action não pode
          // (Next: "Functions cannot be passed directly to Client Components").
          // O servidor sempre resolve o aluno por token+slug, nunca por id do cliente.
          curtir: alternarCurtida.bind(null, params.slug, params.token),
          comentar: comentarPost.bind(null, params.slug, params.token),
          excluirPost: excluirPost.bind(null, params.slug, params.token),
          excluirComentario: excluirComentario.bind(null, params.slug, params.token),
          denunciar: denunciarPost.bind(null, params.slug, params.token),
        }}
      />
    </div>
  );
}
