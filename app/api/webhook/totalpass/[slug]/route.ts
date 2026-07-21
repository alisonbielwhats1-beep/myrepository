import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

const REPASSE_TOTALPASS = 10;

function normalizarCpf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 ? digits : null;
}

/**
 * Webhook do TotalPass — registra um check-in enviado pela plataforma.
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
    .select("id, totalpass_webhook_secret")
    .eq("slug_url", params.slug)
    .maybeSingle();

  if (!academia) {
    return NextResponse.json({ erro: "Academia não encontrada." }, { status: 404 });
  }

  // 2. Validar segredo via Bearer token
  // Rejeita se o secret não estiver configurado (string vazia = inseguro)
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!academia.totalpass_webhook_secret || token !== academia.totalpass_webhook_secret) {
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

  // 5. Buscar aluno pelo CPF
  let alunoId: string | null = null;
  let liberado = true;

  if (cpf) {
    const { data: aluno } = await supabase
      .from("alunos")
      .select("id, status_matricula")
      .eq("academia_id", academia.id)
      .eq("cpf", cpf)
      .maybeSingle();

    if (aluno) {
      alunoId = aluno.id;
      liberado = aluno.status_matricula === "ativa";
    }
  }

  // 6. Registrar o acesso
  const { error } = await supabase.from("acessos_catraca").insert({
    academia_id: academia.id,
    aluno_id: alunoId,
    origem: "TotalPass",
    valor_repasse: REPASSE_TOTALPASS,
    status_liberacao: liberado ? "liberado" : "negado",
    evento_externo_id: eventoId,
    observacao: !alunoId
      ? "CPF não encontrado no cadastro"
      : !liberado
      ? "Matrícula não está ativa"
      : null,
  });

  if (error) {
    // 23505 = reenvio do mesmo check-in. Idempotente: responde 200 sem duplicar.
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, duplicado: true }, { status: 200 });
    }
    console.error("[webhook/totalpass] erro ao inserir acesso:", error.message);
    return NextResponse.json({ erro: "Falha interna." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
