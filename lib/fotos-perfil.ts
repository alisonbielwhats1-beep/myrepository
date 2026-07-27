// Upload de foto de perfil do aluno (Supabase Storage), compartilhado pelas
// duas telas que podem trocar a foto: a área do aluno sem login (valida
// token+slug antes de chamar isto) e o painel do admin (valida sessão+seção
// antes de chamar isto). Este módulo NUNCA valida quem está autorizado —
// isso é responsabilidade de quem chama; aqui só entra depois de aprovado.
//
// Só é importado por Server Actions ("use server"), nunca por um Client
// Component — usa a service role, que ignora RLS.

import { randomUUID } from "crypto";
import { createServiceRoleClient } from "./supabase/server";

export const BUCKET_FOTOS_PERFIL = "fotos-perfil";
/**
 * Teto do arquivo que ESTA função aceita — não é o teto da foto original
 * (essa, até 5 MB, nunca sai do navegador: é recortada/comprimida ali, ver
 * lib/imagem-cliente.ts). O que chega aqui já deveria ser o JPEG processado,
 * recusado no cliente acima de 800 KB. 900 KB dá uma margem pequena para um
 * cliente adulterado ou uma variação de encoder, sem reabrir espaço para o
 * arquivo original de 5 MB — e continua bem abaixo do limite padrão de 1 MB
 * do corpo de uma Server Action (nunca aumentado para isto, de propósito).
 */
export const TAMANHO_MAXIMO_BYTES = 900 * 1024;

const EXTENSAO_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Valida o arquivo recebido no servidor — nunca confia na validação já
 * feita no cliente (tipo, tamanho, recorte e compressão podem ser burlados
 * antes do envio; um cliente adulterado poderia mandar qualquer coisa até o
 * limite de corpo da Server Action). Mesmas regras nos dois pontos de
 * entrada (aluno e admin).
 */
export function validarArquivoFoto(
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
 * Envia a foto para o bucket `fotos-perfil` com um nome não previsível
 * (UUID — não dá pra adivinhar/trocar a foto de outro aluno só pela URL) e
 * devolve a URL pública. `upsert: false` porque cada envio ganha um nome
 * novo — nunca sobrescreve um arquivo existente, então cache antigo (CDN,
 * navegador, `next/image`) nunca serve uma foto trocada: a URL em si mudou.
 */
export async function enviarFotoPerfil(
  academiaId: string,
  alunoId: string,
  arquivo: File,
  extensao: string
): Promise<{ url: string } | { erro: string }> {
  const supabase = createServiceRoleClient();
  const caminho = `${academiaId}/${alunoId}/${randomUUID()}.${extensao}`;

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const { error } = await supabase.storage
    .from(BUCKET_FOTOS_PERFIL)
    .upload(caminho, bytes, { contentType: arquivo.type, upsert: false });

  if (error) {
    return { erro: "Não foi possível enviar a imagem. Tente novamente." };
  }

  const { data } = supabase.storage.from(BUCKET_FOTOS_PERFIL).getPublicUrl(caminho);
  return { url: data.publicUrl };
}

/**
 * Remove a foto antiga do Storage ao trocar/excluir — evita arquivo órfão
 * acumulando no bucket. Nunca tenta apagar uma URL que não é do nosso bucket
 * (foto antiga colada como link externo, de antes desta migration).
 */
export async function removerFotoAntiga(urlAntiga: string | null): Promise<void> {
  const caminho = caminhoNoBucket(urlAntiga);
  if (!caminho) return;
  const supabase = createServiceRoleClient();
  await supabase.storage.from(BUCKET_FOTOS_PERFIL).remove([caminho]);
}

function caminhoNoBucket(url: string | null): string | null {
  if (!url) return null;
  const marcador = `/storage/v1/object/public/${BUCKET_FOTOS_PERFIL}/`;
  const idx = url.indexOf(marcador);
  if (idx === -1) return null;
  try {
    return decodeURIComponent(url.slice(idx + marcador.length));
  } catch {
    return null;
  }
}
