import { NextRequest, NextResponse } from "next/server";
import { getSessao } from "@/lib/auth";
import { parseIntelligenceQuestion } from "@/lib/intelligence/parser";
import { answerIntelligenceQuestion } from "@/lib/intelligence/services";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getSessao();
  if (!session) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }

  // O slug é apenas parte da rota. O tenant verdadeiro vem da sessão e nunca
  // de academia_id enviado pelo navegador.
  if (session.academia.slug_url !== params.slug) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  // A V1 foi desenhada para o proprietário e inclui números financeiros.
  // Manter o gate aqui e no layout impede que outro papel chame a rota à mão.
  if (session.papel !== "dono") {
    return NextResponse.json(
      { error: "O GestAcad Intelligence está disponível para o proprietário." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pergunta inválida." }, { status: 400 });
  }

  const question =
    typeof body === "object" && body !== null && "question" in body
      ? String((body as { question: unknown }).question).trim()
      : "";

  if (!question || question.length > 300) {
    return NextResponse.json(
      { error: "Escreva uma pergunta de até 300 caracteres." },
      { status: 400 }
    );
  }

  try {
    const parsed = parseIntelligenceQuestion(question);
    const answer = await answerIntelligenceQuestion(parsed, session);
    return NextResponse.json({ answer });
  } catch (error) {
    console.error("[intelligence] falha ao responder:", error);
    return NextResponse.json(
      { error: "Não foi possível consultar os dados agora. Tente novamente." },
      { status: 500 }
    );
  }
}

