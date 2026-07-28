import { NextRequest, NextResponse } from "next/server";
import type { DecisaoAcesso } from "@/lib/types";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { decidirAcesso, statusLiberacaoDe } from "@/lib/utils";

function normalizarCpf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 ? digits : null;
}

/**
 * Webhook do Gympass — registra um check-in enviado pela plataforma.
 *
 * Formato esperado no corpo (JSON):
 * {
 *   "user": { "document": "CPF_SEM_PONTOS" },
 *   "check_in_at": "2024-01-01T10:00:00Z"   // opcional
 * }
 *
 * Autenticação: header  Authorization: Bearer <gympass_webhook_secret>
 *
 * A URL que você cadastra no painel da Gympass:
 *   https://gestacad.com.br/api/webhook/gympass/<slug-da-academia>
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const supabase = createServiceRoleClient();

  // 1. Buscar academia pelo slug
  const { data: academia } = await supabase
    .from("academias")
    .select("id, gympass_webhook_secret, politica_inadimplencia")
    .eq("slug_url", params.slug)
    .maybeSingle();

  if (!academia) {
    return NextResponse.json({ erro: "Academia não encontrada." }, { status: 404 });
  }

  // 2. Validar segredo via Bearer token
  // Rejeita se o secret não estiver configurado (string vazia = inseguro)
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!academia.gympass_webhook_secret || token !== academia.gympass_webhook_secret) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  // 3. Parsear corpo
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  // 4. Extrair CPF — Gympass envia em user.document
  const rawCpf =
    (body?.user as Record<string, string> | undefined)?.document ??
    (body?.cpf as string | undefined) ??
    null;
  const cpf = normalizarCpf(rawCpf);

  // 4b. Id do evento (para idempotência / anti-replay). A plataforma manda um
  // identificador único do check-in; se reenviar o mesmo, não duplicamos.
  const eventoId =
    (body?.id as string | undefined) ??
    (body?.event_id as string | undefined) ??
    (body?.check_in_id as string | undefined) ??
    (body?.checkin_id as string | undefined) ??
    null;

  // 5. Buscar aluno pelo CPF (opcional — acesso é registrado mesmo sem match)
  let alunoId: string | null = null;
  let observacao: string | null = null;
  let decisao: DecisaoAcesso | null = null;

  if (cpf) {
    const { data: aluno } = await supabase
      .from("alunos")
      .select("id, status_matricula")
      .eq("academia_id", academia.id)
      .eq("cpf", cpf)
      .maybeSingle();

    if (aluno) {
      alunoId = aluno.id;

      const { data: mensalidades } = await supabase
        .from("receitas")
        .select("id, competencia, data, valor, status")
        .eq("academia_id", academia.id)
        .eq("aluno_id", aluno.id)
        .eq("tipo", "mensalidade")
        .eq("status", "pendente");

      // Mesma decisão central da recepção — sem regra paralela nesta rota.
      decisao = decidirAcesso(
        aluno.status_matricula,
        academia.politica_inadimplencia ?? "liberar",
        mensalidades ?? []
      );
      observacao = decisao.motivo;
    } else {
      observacao = "CPF não encontrado no cadastro";
    }
  }

  // 6. Valor vigente configurado pelo dono (migration 049) — copiado agora
  // para o acesso, para nunca mudar retroativamente se a config mudar depois.
  // Sem config ou desativado: null, sem inventar um valor padrão.
  const { data: config } = await supabase
    .from("config_repasse_parceiros")
    .select("valor_por_checkin")
    .eq("academia_id", academia.id)
    .eq("plataforma", "gympass")
    .eq("ativo", true)
    .maybeSingle();
  const valorRepasseVigente = config?.valor_por_checkin ?? null;

  // 7. Registrar o acesso
  const { error } = await supabase.from("acessos_catraca").insert({
    academia_id: academia.id,
    aluno_id: alunoId,
    origem: "Gympass",
    // Check-in bloqueado permanece registrado, mas sem repasse: a entrada não
    // aconteceu. "alerta" é entrada permitida e mantém o repasse.
    valor_repasse: decisao?.resultado === "bloqueado" ? 0 : valorRepasseVigente,
    status_liberacao: decisao ? statusLiberacaoDe(decisao.resultado) : "liberado",
    evento_externo_id: eventoId,
    observacao,
    politica_aplicada: decisao?.politicaAplicada ?? null,
    mensalidade_id: decisao?.mensalidadeId ?? null,
    dias_atraso: decisao?.diasAtraso ?? null,
  });

  if (error) {
    // 23505 = violação de unicidade: é um reenvio do mesmo check-in. Idempotente:
    // já foi registrado, então respondemos 200 sem duplicar o repasse.
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, duplicado: true }, { status: 200 });
    }
    console.error("[webhook/gympass] erro ao inserir acesso:", error.message);
    return NextResponse.json({ erro: "Falha interna." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
