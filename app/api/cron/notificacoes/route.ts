import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { segredoConfere, tokenBearer } from "@/lib/webhook-auth";

/**
 * Geração diária dos alertas operacionais (Fase 9).
 *
 * Agendada pelo Vercel Cron (vercel.json), mesmo esquema de autenticação da
 * rota de cobrancas: header Authorization: Bearer <CRON_SECRET> — mesma
 * variável de ambiente já usada por /api/cron/cobrancas, nenhum segredo novo.
 *
 * Idempotente: gerar_notificacoes_diarias() (migration 041) usa
 * UNIQUE(academia_id, dedupe_key) + ON CONFLICT DO NOTHING — rodar de novo no
 * mesmo dia (ou várias vezes seguidas) não duplica nada. Não depende de
 * horário exato: se o Vercel Cron atrasar ou pular uma execução, a próxima
 * chamada resolve o que faltou (mensalidade vencendo/atrasada usa dia exato
 * relativo a "hoje", então uma execução perdida pode pular um aviso
 * específico, mas nunca duplica nem quebra os seguintes).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;

  if (!segredo) {
    console.error("[cron/notificacoes] CRON_SECRET não configurado.");
    return NextResponse.json({ erro: "Não configurado." }, { status: 503 });
  }

  const token = tokenBearer(req.headers.get("authorization"));
  if (!segredoConfere(token, segredo)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("gerar_notificacoes_diarias");

  if (error) {
    console.error("[cron/notificacoes] falha:", error.message);
    return NextResponse.json({ erro: "Falha na geração." }, { status: 500 });
  }

  const linhas = (data as Array<{ tipo: string; criadas: number }>) ?? [];
  const total = linhas.reduce((acc, l) => acc + (l.criadas ?? 0), 0);

  console.log(
    `[cron/notificacoes] ${total} notificação(ões) criada(s) — ` +
      linhas.map((l) => `${l.tipo}: ${l.criadas}`).join(", ")
  );

  return NextResponse.json({ ok: true, total, porTipo: linhas });
}
