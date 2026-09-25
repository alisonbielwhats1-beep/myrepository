import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { registrarCheckinParceiro } from "@/lib/checkin-parceiro";
import { lerCheckinTotalPass, unidadeConfere } from "@/lib/totalpass-webhook";
import { validarCheckin } from "@/lib/totalpass";

export const dynamic = "force-dynamic";

/**
 * Webhook OFICIAL de check-in da TotalPass (dev.totalpass.com).
 *
 * A URL (…/api/totalpass/checkin/<webhook_token>) é cadastrada na TotalPass
 * pelo próprio GestAcad quando o dono conecta a academia em Integrações
 * (Server Action conectarTotalPass). A TotalPass não assina o webhook: a
 * autenticação é o token imprevisível da URL + a conferência do código da
 * unidade no corpo + o link de validação precisar ser da TotalPass.
 *
 * Fluxo: registra o acesso com a mesma decisão da recepção e, se permitido e
 * com a validação automática ligada, libera a entrada na TotalPass com um POST
 * no link exclusivo do check-in (prazo de 90 min do lado deles).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token ?? "";
  if (token.length < 32 || token.length > 128) {
    return NextResponse.json({ erro: "Não encontrado." }, { status: 404 });
  }

  const supabase = createServiceRoleClient();

  const { data: integ } = await supabase
    .from("integracao_totalpass")
    .select(
      "academia_id, codigo_unidade, place_uuid, validacao_automatica, academias(politica_inadimplencia)"
    )
    .eq("webhook_token", token)
    .maybeSingle();

  if (!integ) {
    return NextResponse.json({ erro: "Não encontrado." }, { status: 404 });
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const leitura = lerCheckinTotalPass(corpo);
  if (leitura.tipo === "ignorar") {
    return NextResponse.json({ ok: true, ignorado: leitura.motivo }, { status: 200 });
  }
  if (leitura.tipo === "invalido") {
    return NextResponse.json({ erro: leitura.motivo }, { status: 400 });
  }
  const checkin = leitura.checkin;

  if (!unidadeConfere(checkin, integ)) {
    return NextResponse.json({ erro: "Unidade não confere." }, { status: 403 });
  }

  const academia = (Array.isArray(integ.academias) ? integ.academias[0] : integ.academias) as
    | { politica_inadimplencia: "liberar" | "alertar" | "bloquear" | null }
    | null;

  const nome = checkin.nomeUsuario ? `TotalPass: ${checkin.nomeUsuario}` : "TotalPass";
  const r = await registrarCheckinParceiro(supabase, {
    academiaId: integ.academia_id,
    politica: academia?.politica_inadimplencia ?? null,
    cpf: checkin.cpf,
    eventoId: checkin.eventoId,
    observacaoSemCadastro: `${nome} (sem cadastro na academia)`,
  });

  if ("erro" in r) {
    console.error("[totalpass/checkin] erro ao registrar acesso:", r.erro);
    return NextResponse.json({ erro: "Falha interna." }, { status: 500 });
  }
  // Reenvio do mesmo check-in: já foi tratado (inclusive a validação).
  if (r.duplicado) {
    return NextResponse.json({ ok: true, duplicado: true }, { status: 200 });
  }

  const bloqueado = r.decisao?.resultado === "bloqueado";
  let nota: string;
  let erroIntegracao: string | null = null;

  if (bloqueado) {
    nota = "não validado na TotalPass (acesso bloqueado pela academia)";
  } else if (!integ.validacao_automatica) {
    nota = "aguardando validação manual no Portal da TotalPass";
  } else {
    const v = await validarCheckin(checkin.endpoint);
    if (v.resultado === "validado") {
      nota = "validado na TotalPass";
    } else {
      nota = `não validado: ${v.detalhe}`;
      if (v.resultado === "falhou") erroIntegracao = v.detalhe;
    }
  }

  const { data: acesso } = await supabase
    .from("acessos_catraca")
    .select("observacao")
    .eq("id", r.acessoId)
    .maybeSingle();
  await supabase
    .from("acessos_catraca")
    .update({ observacao: [acesso?.observacao, nota].filter(Boolean).join(" · ").slice(0, 500) })
    .eq("id", r.acessoId);

  await supabase
    .from("integracao_totalpass")
    .update({
      ultimo_checkin_em: new Date().toISOString(),
      ultimo_erro: erroIntegracao,
      atualizado_em: new Date().toISOString(),
    })
    .eq("academia_id", integ.academia_id);

  return NextResponse.json({ ok: true }, { status: 200 });
}
