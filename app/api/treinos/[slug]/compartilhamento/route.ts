import { NextRequest, NextResponse } from "next/server";
import { getSessao } from "@/lib/auth";
import { podeGerenciarTreinos } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FORMATO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lista os ids dos instrutores com quem um treino-modelo está compartilhado
 * (visibilidade='selecionado'), para pré-marcar o multi-select. O RLS (081)
 * garante que só quem pode gerenciar aquele treino enxerga a ACL.
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

  const treinoId = (request.nextUrl.searchParams.get("treino") ?? "").trim();
  if (!FORMATO_UUID.test(treinoId)) {
    return NextResponse.json({ erro: "Treino inválido." }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("treinos_compartilhamento")
    .select("perfil_id")
    .eq("treino_id", treinoId);

  if (error) {
    return NextResponse.json(
      { erro: "Não foi possível carregar o compartilhamento." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { instrutorIds: (data ?? []).map((r) => r.perfil_id as string) },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
