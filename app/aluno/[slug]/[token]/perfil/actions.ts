"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { validarUrl } from "@/lib/validacoes";
import { getFichaAlunoPublica } from "@/lib/data";

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
 * Atualiza SOMENTE a foto de perfil do próprio aluno, via RPC
 * `atualizar_foto_aluno_publico` (Fase 12). A RPC resolve o aluno
 * INTEIRAMENTE pelo token pessoal + slug — não existe (nem existiu) uma
 * variante que aceite aluno_id; conhecer o aluno_id sozinho nunca é
 * suficiente para alterar a foto. Nenhum outro dado (e-mail, telefone,
 * plano, matrícula, vencimento, status) é alterável por esta ação.
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

  const raw = String(formData.get("foto_perfil_url") ?? "").trim();
  const url = raw ? validarUrl(raw) : null;
  if (raw && !url) {
    return { erro: "Informe uma URL de imagem https:// válida." };
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

  const { data: ok, error } = await supabase.rpc("atualizar_foto_aluno_publico", {
    p_token: token,
    p_slug: slug,
    p_foto_url: url,
  });

  if (error || ok !== true) {
    return { erro: "Não foi possível atualizar a foto. Tente novamente." };
  }

  revalidatePath(`/aluno/${slug}/${token}`);
  revalidatePath(`/aluno/${slug}/${token}/perfil`);
  return { ok: true, savedAt: Date.now() };
}
