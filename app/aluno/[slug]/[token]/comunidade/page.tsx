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

  // Ações vinculadas a (slug, token) — o servidor resolve o aluno pelo token,
  // nunca por id do cliente.
  const curtir = (postId: string, curtir: boolean) =>
    alternarCurtida(params.slug, params.token, postId, curtir);
  const comentar = (postId: string, texto: string) =>
    comentarPost(params.slug, params.token, postId, texto);
  const removerPost = (postId: string) =>
    excluirPost(params.slug, params.token, postId);
  const removerComentario = (comentarioId: string) =>
    excluirComentario(params.slug, params.token, comentarioId);
  const denunciar = (postId: string, motivo: string) =>
    denunciarPost(params.slug, params.token, postId, motivo);

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
          curtir,
          comentar,
          excluirPost: removerPost,
          excluirComentario: removerComentario,
          denunciar,
        }}
      />
    </div>
  );
}
