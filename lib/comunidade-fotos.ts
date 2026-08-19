// Upload da imagem de uma publicação da comunidade (Supabase Storage). Mesmo
// desenho de lib/fotos-perfil.ts: este módulo NUNCA valida quem está
// autorizado — quem chama (a Server Action) já validou token+slug do aluno
// antes. Só é importado por Server Actions ("use server"); usa a service role,
// que ignora RLS, e por isso jamais deve ser importado por um Client Component.

import { randomUUID } from "crypto";
import { createServiceRoleClient } from "./supabase/server";

export const BUCKET_COMUNIDADE = "comunidade";

/**
 * Teto do arquivo que ESTA função aceita. O que chega aqui já é o JPEG
 * processado no navegador (lib/imagem-cliente.ts → prepararImagemComunidade),
 * recusado no cliente acima de 950 KB. 980 KB dá uma margem pequena para
 * variação de encoder sem reabrir espaço para o arquivo original de 5 MB, e
 * continua dentro do corpo padrão de 1 MB de uma Server Action do Next.
 */
export const TAMANHO_MAXIMO_BYTES = 980 * 1024;

const EXTENSAO_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Valida o arquivo no servidor — nunca confia na validação do cliente (tipo,
 * tamanho e compressão podem ser burlados antes do envio).
 */
export function validarImagemComunidade(
  file: File | null
): { erro: string } | { extensao: string } {
  if (!file || file.size === 0) {
    return { erro: "Selecione uma imagem." };
  }
  const extensao = EXTENSAO_POR_MIME[file.type];
  if (!extensao) {
    return { erro: "Envie uma imagem JPG, PNG ou WebP." };
  }
  if (file.size > TAMANHO_MAXIMO_BYTES) {
    return { erro: "A imagem enviada é maior do que o esperado. Tente novamente." };
  }
  return { extensao };
}

/**
 * Envia a imagem para o bucket `comunidade` com um caminho não previsível
 * (academia/aluno/UUID) e devolve a URL pública. `upsert: false`: cada envio
 * ganha um nome novo, então nunca sobrescreve arquivo existente. A pasta
 * inclui academia_id + aluno_id para facilitar limpeza/auditoria por tenant.
 */
export async function enviarImagemComunidade(
  academiaId: string,
  alunoId: string,
  arquivo: File,
  extensao: string
): Promise<{ url: string } | { erro: string }> {
  const supabase = createServiceRoleClient();
  const caminho = `${academiaId}/${alunoId}/${randomUUID()}.${extensao}`;

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const { error } = await supabase.storage
    .from(BUCKET_COMUNIDADE)
    .upload(caminho, bytes, { contentType: arquivo.type, upsert: false });

  if (error) {
    return { erro: "Não foi possível enviar a imagem. Tente novamente." };
  }

  const { data } = supabase.storage.from(BUCKET_COMUNIDADE).getPublicUrl(caminho);
  return { url: data.publicUrl };
}
