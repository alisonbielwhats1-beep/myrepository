import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { registrarCheckinParceiro } from "@/lib/checkin-parceiro";
import { segredoConfere, tokenBearer } from "@/lib/webhook-auth";

function normalizarCpf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 ? digits : null;
}

/**
 * Webhook LEGADO do TotalPass (segredo Bearer gerado pelo GestAcad). A
 * TotalPass real não chama este formato — a integração oficial é
 * /api/totalpass/checkin/[token] (lib/totalpass.ts). Mantido só para não
 * quebrar quem já tenha configurado algo apontando para cá.
 *
 *
 * Formato esperado no corpo (JSON):
 * {
 *   "user_cpf": "CPF_SEM_PONTOS",
 *   "check_in_timestamp": "2024-01-01T10:00:00.000Z"   // opcional
 * }
 *
 * Autenticação: header  Authorization: Bearer <totalpass_webhook_secret>
 *
 * A URL que você cadastra no painel da TotalPass:
 *   https://gestacad.com.br/api/webhook/totalpass/<slug-da-academia>
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const supabase = createServiceRoleClient();

  // 1. Buscar academia pelo slug
  const { data: academia } = await supabase
    .from("academias")
    .select("id, totalpass_webhook_secret, politica_inadimplencia")
    .eq("slug_url", params.slug)
    .maybeSingle();

  if (!academia) {
    return NextResponse.json({ erro: "Academia não encontrada." }, { status: 404 });
  }

  // 2. Validar segredo via Bearer token, em tempo constante. Fail-closed: sem
  // secret configurado, nega (segredoConfere trata null/vazio).
  const token = tokenBearer(req.headers.get("authorization"));
  if (!segredoConfere(token, academia.totalpass_webhook_secret)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  // 3. Parsear corpo
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  // 4. Extrair CPF — TotalPass envia em user_cpf ou cpf
  const rawCpf =
    (body?.user_cpf as string | undefined) ??
    (body?.cpf as string | undefined) ??
    null;
  const cpf = normalizarCpf(rawCpf);

  // 4b. Id do evento (idempotência / anti-replay).
  const eventoId =
    (body?.id as string | undefined) ??
    (body?.event_id as string | undefined) ??
    (body?.check_in_id as string | undefined) ??
    (body?.checkin_id as string | undefined) ??
    null;

  // 5–7. Decisão de acesso + registro (mesma lógica do webhook oficial).
  const r = await registrarCheckinParceiro(supabase, {
    academiaId: academia.id,
    politica: academia.politica_inadimplencia,
    cpf,
    eventoId,
  });
  if ("erro" in r) {
    console.error("[webhook/totalpass] erro ao inserir acesso:", r.erro);
    return NextResponse.json({ erro: "Falha interna." }, { status: 500 });
  }
  if (r.duplicado) {
    return NextResponse.json({ ok: true, duplicado: true }, { status: 200 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
