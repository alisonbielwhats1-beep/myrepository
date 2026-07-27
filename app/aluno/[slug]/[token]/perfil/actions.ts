"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getFichaAlunoPublica } from "@/lib/data";
import {
  enviarFotoPerfil,
  removerFotoAntiga,
  validarArquivoFoto,
} from "@/lib/fotos-perfil";

export type EstadoFoto = { erro?: string; ok?: boolean; savedAt?: number };

/** IP real do cliente (último hop confiável / x-real-ip), p/ rate-limit — mesmo helper usado em feedback. */
function ipCliente(): string {
  const h = headers();
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const partes = (h.get("x-forwarded-for") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  return partes[partes.length - 1] || "desconhecido";
}

/**
 * Atualiza (ou remove) SOMENTE a foto de perfil do próprio aluno. Resolve o
 * aluno INTEIRAMENTE pelo token pessoal + slug — antes de qualquer upload,
 * sem isso o pedido é recusado. Conhecer o aluno_id sozinho nunca é
 * suficiente para alterar a foto: não existe (nem existiu) uma variante desta
 * ação que aceite aluno_id. Nenhum outro dado (e-mail, telefone, plano,
 * matrícula, vencimento, status) é alterável por aqui.
 *
 * O arquivo em si vai para o Supabase Storage (bucket `fotos-perfil`, sem
 * política de escrita para anon/authenticated — só a service role grava, e
 * só depois da validação de token+slug abaixo). A RPC
 * `atualizar_foto_aluno_publico` só recebe a URL pública já pronta.
 */
export async function atualizarFotoAluno(
  slug: string,
  token: string,
  _estado: EstadoFoto,
  formData: FormData
): Promise<EstadoFoto> {
  const ficha = await getFichaAlunoPublica(token, slug);
  if (!ficha || ficha.academia.slug_url !== slug) {
    return { erro: "Link inválido." };
  }

  const remover = formData.get("remover") === "1";
  const arquivo = remover ? null : (formData.get("foto") as File | null);

  let extensao: string | undefined;
  if (!remover) {
    const validado = validarArquivoFoto(arquivo);
    if ("erro" in validado) return { erro: validado.erro };
    extensao = validado.extensao;
  }

  const supabase = createClient();

  // Anti-spam: no máx. 5 alterações a cada 5 min por IP+token (mesmo padrão do feedback).
  const { data: liberado } = await supabase.rpc("acao_permitida", {
    p_chave: `foto:${token}:${ipCliente()}`,
    p_max: 5,
    p_janela_seg: 300,
  });
  if (liberado === false) {
    return { erro: "Muitas alterações em pouco tempo. Tente novamente em alguns minutos." };
  }

  let novaUrl: string | null = null;
  if (!remover && arquivo && extensao) {
    const enviado = await enviarFotoPerfil(ficha.academia.id, ficha.aluno.id, arquivo, extensao);
    if ("erro" in enviado) return { erro: enviado.erro };
    novaUrl = enviado.url;
  }

  const { data: ok, error } = await supabase.rpc("atualizar_foto_aluno_publico", {
    p_token: token,
    p_slug: slug,
    p_foto_url: novaUrl,
  });

  if (error || ok !== true) {
    return { erro: "Não foi possível atualizar a foto. Tente novamente." };
  }

  await removerFotoAntiga(ficha.aluno.foto_perfil_url);

  revalidatePath(`/aluno/${slug}/${token}`);
  revalidatePath(`/aluno/${slug}/${token}/perfil`);
  return { ok: true, savedAt: Date.now() };
}
