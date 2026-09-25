"use server";

import { revalidatePath } from "next/cache";
import { randomBytes, randomUUID } from "crypto";
import { headers } from "next/headers";
import { requireSecao } from "@/lib/auth";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { planoPodeAcessar } from "@/lib/planos";
import {
  autenticarUnidade,
  garantirWebhook,
  listarWebhooks,
  removerWebhook,
} from "@/lib/totalpass";
import { chaveUnidadeValida } from "@/lib/totalpass-webhook";
import type { EstadoAcao } from "@/lib/types";
import { LABELS_STATUS_INTEGRACAO, type StatusIntegracao } from "@/lib/types";
import { erroAmigavel } from "@/lib/erros-servidor";

/** Gera um novo segredo para o webhook da plataforma.
 *  Registra auditoria com usuário, academia e data/hora — nunca o valor do segredo. */
export async function rotarSecretIntegracao(
  slug: string,
  plataforma: "gympass" | "totalpass"
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "integracoes");

  if (sessao.academia.is_demo) {
    return { erro: "Ação indisponível no ambiente de demonstração." };
  }

  const supabase = createClient();

  const campo =
    plataforma === "gympass"
      ? "gympass_webhook_secret"
      : "totalpass_webhook_secret";

  const novoSecret = randomUUID();

  const { error } = await supabase
    .from("academias")
    .update({ [campo]: novoSecret })
    .eq("id", sessao.academia.id);

  if (error) return { erro: await erroAmigavel(error, "gerar uma nova chave") };

  await supabase.from("log_integracoes").insert({
    academia_id: sessao.academia.id,
    usuario_id: sessao.userId,
    plataforma,
    acao: "rotacao_secret",
  });

  revalidatePath(`/painel/${slug}/integracoes`);
  revalidatePath(`/painel/${slug}/configuracoes`);
  return { ok: true, savedAt: Date.now() };
}

/** Atualiza o status de integração de uma plataforma.
 *  Registra auditoria com status anterior e novo — nunca o valor do segredo. */
export async function atualizarStatusIntegracao(
  slug: string,
  plataforma: "gympass" | "totalpass",
  novoStatus: StatusIntegracao
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "integracoes");

  if (sessao.academia.is_demo) {
    return { erro: "Ação indisponível no ambiente de demonstração." };
  }

  if (!Object.keys(LABELS_STATUS_INTEGRACAO).includes(novoStatus)) {
    return { erro: "Status inválido." };
  }

  const supabase = createClient();
  const { data: atual } = await supabase
    .from("academias")
    .select("gympass_status, totalpass_status")
    .eq("id", sessao.academia.id)
    .maybeSingle();

  const statusAnterior =
    plataforma === "gympass"
      ? atual?.gympass_status
      : atual?.totalpass_status;

  const campoStatus =
    plataforma === "gympass" ? "gympass_status" : "totalpass_status";

  const { error } = await supabase
    .from("academias")
    .update({ [campoStatus]: novoStatus })
    .eq("id", sessao.academia.id);

  if (error) return { erro: await erroAmigavel(error, "atualizar o status") };

  await supabase.from("log_integracoes").insert({
    academia_id: sessao.academia.id,
    usuario_id: sessao.userId,
    plataforma,
    acao: "atualizar_status",
    status_anterior: statusAnterior ?? null,
    status_novo: novoStatus,
  });

  revalidatePath(`/painel/${slug}/integracoes`);
  revalidatePath(`/painel/${slug}/configuracoes`);
  return { ok: true, savedAt: Date.now() };
}

/**
 * Define o valor estimado por check-in (e se está ativo) de uma plataforma
 * parceira (migration 049). `valorReais` null grava "não configurado" —
 * nunca inventa um padrão. A escrita real acontece na RPC
 * `definir_valor_repasse_parceiro` (valida papel e faixa por dentro); esta
 * Server Action só traduz a entrada e registra a auditoria (mesmo padrão de
 * rotarSecretIntegracao/atualizarStatusIntegracao, que já usam
 * `log_integracoes` para ações de integração).
 */
export async function definirRepasseParceiro(
  slug: string,
  plataforma: "gympass" | "totalpass",
  valorReais: number | null,
  ativo: boolean
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "integracoes");

  if (sessao.academia.is_demo) {
    return { erro: "Ação indisponível no ambiente de demonstração." };
  }

  if (valorReais !== null && (!Number.isFinite(valorReais) || valorReais < 0 || valorReais > 500)) {
    return { erro: "Valor inválido. Use um número entre 0 e 500." };
  }

  const supabase = createClient();

  const { data: anterior } = await supabase
    .from("config_repasse_parceiros")
    .select("valor_por_checkin")
    .eq("plataforma", plataforma)
    .maybeSingle();

  const { data: resultado, error } = await supabase.rpc(
    "definir_valor_repasse_parceiro",
    { p_plataforma: plataforma, p_valor: valorReais, p_ativo: ativo }
  );

  if (error) return { erro: await erroAmigavel(error, "salvar") };
  if (!resultado || resultado.length === 0) {
    return { erro: "Você não tem permissão para configurar o repasse." };
  }

  await supabase.from("log_integracoes").insert({
    academia_id: sessao.academia.id,
    usuario_id: sessao.userId,
    plataforma,
    acao: "definir_valor_repasse",
    valor_anterior: anterior?.valor_por_checkin ?? null,
    valor_novo: valorReais,
    ativo_novo: ativo,
  });

  revalidatePath(`/painel/${slug}/integracoes`);
  revalidatePath(`/painel/${slug}/financeiro`);
  return { ok: true, savedAt: Date.now() };
}

// ---------------------------------------------------------------------------
// TotalPass — API oficial de Validação de Check-in (migração 108, lib/totalpass.ts)
// ---------------------------------------------------------------------------

/** Tabela da migração 108 ainda não aplicada no banco. */
function tabelaAusente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /integracao_totalpass/.test(error.message ?? "")
  );
}

const MSG_MIGRACAO =
  "A conexão com a TotalPass ainda está sendo ativada no sistema. Tente novamente mais tarde.";

/** Mesmas travas da página: dono (seção), plano com integrações, fora do demo. */
async function exigirDonoIntegracoes(slug: string) {
  const sessao = await requireSecao(slug, "integracoes");
  if (sessao.academia.is_demo) {
    return { erro: "Ação indisponível no ambiente de demonstração." } as const;
  }
  if (!planoPodeAcessar(sessao.academia.plano_saas, "integracoes")) {
    return { erro: "Integrações estão disponíveis no plano Premium." } as const;
  }
  return { sessao } as const;
}

/** Origem pública do site para montar a URL do webhook cadastrada na TotalPass. */
function origemDoSite(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export type EstadoConexaoTotalPass = EstadoAcao & { unidade?: string | null };

/**
 * Conecta a academia à TotalPass com a place_api_key que o dono gerou no
 * Portal da TotalPass: autentica (valida as chaves), cadastra a URL do
 * webhook desta academia e guarda a chave. A chave nunca volta ao navegador.
 */
export async function conectarTotalPass(
  slug: string,
  placeApiKey: string
): Promise<EstadoConexaoTotalPass> {
  const guarda = await exigirDonoIntegracoes(slug);
  if ("erro" in guarda) return { erro: guarda.erro };
  const { sessao } = guarda;

  const chave = placeApiKey.trim();
  if (!chaveUnidadeValida(chave)) {
    return { erro: "Cole a chave da unidade exatamente como aparece no Portal da TotalPass." };
  }

  const admin = createServiceRoleClient();
  const { data: existente, error: erroLeitura } = await admin
    .from("integracao_totalpass")
    .select("webhook_token")
    .eq("academia_id", sessao.academia.id)
    .maybeSingle();
  if (tabelaAusente(erroLeitura)) return { erro: MSG_MIGRACAO };

  const auth = await autenticarUnidade(chave);
  if ("erro" in auth) return { erro: auth.erro };

  const webhookToken = existente?.webhook_token ?? randomBytes(32).toString("hex");
  const webhookUrl = `${origemDoSite()}/api/totalpass/checkin/${webhookToken}`;

  const webhook = await garantirWebhook(auth.token, webhookUrl);
  const agora = new Date().toISOString();

  const { error } = await admin.from("integracao_totalpass").upsert({
    academia_id: sessao.academia.id,
    place_api_key: chave,
    place_nome: auth.placeNome,
    webhook_token: webhookToken,
    webhook_url: webhookUrl,
    webhook_registrado: !("erro" in webhook),
    ultimo_teste_em: agora,
    ultimo_erro: "erro" in webhook ? webhook.erro : null,
    atualizado_em: agora,
  });
  if (error) {
    if (tabelaAusente(error)) return { erro: MSG_MIGRACAO };
    return { erro: await erroAmigavel(error, "salvar a conexão com a TotalPass") };
  }

  const supabase = createClient();
  await supabase
    .from("academias")
    .update({ totalpass_status: "erro" in webhook ? "com_erro" : "em_testes" })
    .eq("id", sessao.academia.id);
  await supabase.from("log_integracoes").insert({
    academia_id: sessao.academia.id,
    usuario_id: sessao.userId,
    plataforma: "totalpass",
    acao: "conectar_api",
  });

  revalidatePath(`/painel/${slug}/integracoes`);
  if ("erro" in webhook) {
    return {
      erro: `Chave aceita pela TotalPass, mas o cadastro do webhook falhou: ${webhook.erro}`,
      unidade: auth.placeNome,
    };
  }
  return { ok: true, savedAt: Date.now(), unidade: auth.placeNome };
}

/** Testa a conexão guardada: autentica de novo e confere o webhook cadastrado. */
export async function testarTotalPass(slug: string): Promise<EstadoConexaoTotalPass> {
  const guarda = await exigirDonoIntegracoes(slug);
  if ("erro" in guarda) return { erro: guarda.erro };
  const { sessao } = guarda;

  const admin = createServiceRoleClient();
  const { data: integ, error } = await admin
    .from("integracao_totalpass")
    .select("place_api_key, webhook_url")
    .eq("academia_id", sessao.academia.id)
    .maybeSingle();
  if (tabelaAusente(error)) return { erro: MSG_MIGRACAO };
  if (!integ) return { erro: "A TotalPass ainda não está conectada." };

  const agora = new Date().toISOString();
  const auth = await autenticarUnidade(integ.place_api_key);
  let erroTeste: string | null = null;
  let registrado = false;
  if ("erro" in auth) {
    erroTeste = auth.erro;
  } else {
    const lista = await listarWebhooks(auth.token);
    if ("erro" in lista) {
      erroTeste = lista.erro;
    } else {
      registrado = lista.webhooks.some((w) => w.url === integ.webhook_url);
      if (!registrado) {
        // A URL foi trocada do lado da TotalPass: recoloca a nossa.
        const w = integ.webhook_url
          ? await garantirWebhook(auth.token, integ.webhook_url)
          : { erro: "URL do webhook ausente — conecte de novo." };
        if ("erro" in w) erroTeste = w.erro;
        else registrado = true;
      }
    }
  }

  await admin
    .from("integracao_totalpass")
    .update({
      ultimo_teste_em: agora,
      ultimo_erro: erroTeste,
      webhook_registrado: registrado,
      ...(!("erro" in auth) && auth.placeNome ? { place_nome: auth.placeNome } : {}),
      atualizado_em: agora,
    })
    .eq("academia_id", sessao.academia.id);

  revalidatePath(`/painel/${slug}/integracoes`);
  if (erroTeste) return { erro: erroTeste };
  return { ok: true, savedAt: Date.now(), unidade: "erro" in auth ? null : auth.placeNome };
}

/** Desconecta: remove o webhook na TotalPass (se possível) e apaga a chave. */
export async function desconectarTotalPass(slug: string): Promise<EstadoAcao> {
  const guarda = await exigirDonoIntegracoes(slug);
  if ("erro" in guarda) return { erro: guarda.erro };
  const { sessao } = guarda;

  const admin = createServiceRoleClient();
  const { data: integ, error } = await admin
    .from("integracao_totalpass")
    .select("place_api_key")
    .eq("academia_id", sessao.academia.id)
    .maybeSingle();
  if (tabelaAusente(error)) return { erro: MSG_MIGRACAO };
  if (!integ) return { ok: true, savedAt: Date.now() };

  // Melhor esforço do lado da TotalPass: mesmo que falhe (chave revogada,
  // TotalPass fora do ar), a chave sai do nosso banco — e sem a linha, a URL
  // do webhook passa a responder 404 e nada mais é registrado.
  const auth = await autenticarUnidade(integ.place_api_key);
  if (!("erro" in auth)) await removerWebhook(auth.token);

  const { error: erroDel } = await admin
    .from("integracao_totalpass")
    .delete()
    .eq("academia_id", sessao.academia.id);
  if (erroDel) return { erro: await erroAmigavel(erroDel, "desconectar a TotalPass") };

  const supabase = createClient();
  await supabase
    .from("academias")
    .update({ totalpass_status: "desativada" })
    .eq("id", sessao.academia.id);
  await supabase.from("log_integracoes").insert({
    academia_id: sessao.academia.id,
    usuario_id: sessao.userId,
    plataforma: "totalpass",
    acao: "desconectar_api",
  });

  revalidatePath(`/painel/${slug}/integracoes`);
  return { ok: true, savedAt: Date.now() };
}

/** Liga/desliga a validação automática do check-in na TotalPass. */
export async function definirValidacaoAutomaticaTotalPass(
  slug: string,
  ligada: boolean
): Promise<EstadoAcao> {
  const guarda = await exigirDonoIntegracoes(slug);
  if ("erro" in guarda) return { erro: guarda.erro };
  const { sessao } = guarda;

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("integracao_totalpass")
    .update({ validacao_automatica: ligada, atualizado_em: new Date().toISOString() })
    .eq("academia_id", sessao.academia.id)
    .select("academia_id");
  if (tabelaAusente(error)) return { erro: MSG_MIGRACAO };
  if (error) return { erro: await erroAmigavel(error, "salvar") };
  if (!data?.length) return { erro: "A TotalPass ainda não está conectada." };

  const supabase = createClient();
  await supabase.from("log_integracoes").insert({
    academia_id: sessao.academia.id,
    usuario_id: sessao.userId,
    plataforma: "totalpass",
    acao: "alterar_validacao_automatica",
    ativo_novo: ligada,
  });

  revalidatePath(`/painel/${slug}/integracoes`);
  return { ok: true, savedAt: Date.now() };
}
