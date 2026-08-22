import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { segredoConfere, tokenBearer } from "@/lib/webhook-auth";

/**
 * Rotina diária de cobranças recorrentes.
 *
 * Agendada pelo Vercel Cron (vercel.json) uma vez por dia às 09:00 UTC, que é
 * 06:00 em America/Sao_Paulo. A decisão de quais cobranças criar é 100% do
 * banco: esta rota só dispara a RPC sincronizar_cobrancas_todas, a mesma lógica
 * que o botão "Sincronizar cobranças" usa pela RPC sincronizar_cobrancas.
 *
 * Cria apenas receitas com status 'pendente'. Não cobra cartão, não movimenta
 * dinheiro e não altera nada já existente.
 *
 * Autenticação: header Authorization: Bearer <CRON_SECRET>. O Vercel Cron envia
 * esse header automaticamente quando a env CRON_SECRET existe no projeto. O
 * segredo vive só no servidor — nunca é exposto ao navegador.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;

  // Sem segredo configurado a rota fica fechada, em vez de aberta por omissão.
  if (!segredo) {
    console.error("[cron/cobrancas] CRON_SECRET não configurado.");
    return NextResponse.json({ erro: "Não configurado." }, { status: 503 });
  }

  const token = tokenBearer(req.headers.get("authorization"));
  if (!segredoConfere(token, segredo)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("sincronizar_cobrancas_todas", {
    p_dias: 7,
  });

  if (error) {
    console.error("[cron/cobrancas] falha:", error.message);
    return NextResponse.json({ erro: "Falha na sincronização." }, { status: 500 });
  }

  const linhas = (data as Array<{
    academia_id: string;
    criadas: number;
    ja_existiam: number;
    alunos_elegiveis: number;
  }>) ?? [];

  const total = linhas.reduce(
    (acc, l) => ({
      criadas: acc.criadas + (l.criadas ?? 0),
      jaExistiam: acc.jaExistiam + (l.ja_existiam ?? 0),
      elegiveis: acc.elegiveis + (l.alunos_elegiveis ?? 0),
    }),
    { criadas: 0, jaExistiam: 0, elegiveis: 0 }
  );

  console.log(
    `[cron/cobrancas] ${linhas.length} academia(s) · ${total.criadas} criada(s) · ` +
      `${total.jaExistiam} já existiam · ${total.elegiveis} aluno(s) elegível(is)`
  );

  return NextResponse.json({ ok: true, academias: linhas.length, ...total });
}
