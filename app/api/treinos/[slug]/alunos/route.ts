import { NextRequest, NextResponse } from "next/server";
import { getSessao } from "@/lib/auth";
import { podeGerenciarTreinos } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Busca leve e paginada para o seletor "Atribuir a aluno". */
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

  const termo = (request.nextUrl.searchParams.get("q") ?? "")
    .trim()
    .replace(/[%_]/g, "")
    .slice(0, 80);

  const supabase = createClient();
  let consulta = supabase
    .from("alunos")
    .select("id, nome, matricula_codigo")
    .eq("academia_id", sessao.academia.id)
    .eq("status_matricula", "ativa")
    .order("nome", { ascending: true })
    .limit(20);

  if (termo) consulta = consulta.ilike("nome", `%${termo}%`);

  const { data, error } = await consulta;
  if (error) {
    return NextResponse.json(
      { erro: "Não foi possível carregar os alunos." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { alunos: data ?? [] },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

