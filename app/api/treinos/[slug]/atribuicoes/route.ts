import { NextRequest, NextResponse } from "next/server";
import { getSessao } from "@/lib/auth";
import { podeGerenciarTreinos } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FORMATO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lista os alunos que já receberam uma cópia de um treino-modelo — para a
 * seção "Já atribuído a" da tela de atribuição. Instrutor e dono/gerente veem.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const sessao = await getSessao();
  if (!sessao) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }
  if (
    sessao.academia.slug_url !== params.slug ||
    !podeGerenciarTreinos(sessao.papel)
  ) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const modeloId = (request.nextUrl.searchParams.get("modelo") ?? "").trim();
  if (!FORMATO_UUID.test(modeloId)) {
    return NextResponse.json({ erro: "Modelo inválido." }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("treinos")
    .select("id, nome_treino, atribuido_em, aluno:alunos!inner(id, nome)")
    .eq("academia_id", sessao.academia.id)
    .eq("modelo_origem_id", modeloId)
    .not("aluno_id", "is", null)
    .order("atribuido_em", { ascending: false });

  if (error) {
    return NextResponse.json(
      { erro: "Não foi possível carregar as atribuições." },
      { status: 500 }
    );
  }

  const atribuicoes = (data ?? []).map((t) => {
    const aluno = t.aluno as unknown as { id: string; nome: string } | null;
    return {
      treinoId: t.id,
      alunoId: aluno?.id ?? "",
      alunoNome: aluno?.nome ?? "Aluno",
      atribuidoEm: t.atribuido_em as string | null,
    };
  });

  return NextResponse.json(
    { atribuicoes },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
