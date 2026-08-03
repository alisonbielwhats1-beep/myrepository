// Upload do clipe de demonstração do exercício (vídeo curto ou GIF) via
// Supabase Storage. Só é importado por Server Actions ("use server"), nunca
// por um Client Component — usa a service role, que ignora RLS. Quem chama
// (app/painel/[slug]/treinos/actions.ts) já validou sessão+seção do painel
// antes; este módulo nunca valida quem está autorizado.

import { randomUUID } from "crypto";
import { createServiceRoleClient } from "./supabase/server";

export const BUCKET_MIDIA_EXERCICIOS = "midia-exercicios";

/**
 * Teto do arquivo aceito aqui. O bucket (migration 053) já recusa acima de
 * 4 MB, mas validar antes de subir evita gastar uma chamada de rede com um
 * arquivo que vai ser rejeitado de qualquer forma — e a mensagem de erro
 * fica melhor. Combinado com next.config.mjs (Server Action até 4 MB de
 * corpo) e o teto de payload de Function do Vercel (4.5 MB), este é o menor
 * dos três — a primeira barreira, não a última.
 */
export const TAMANHO_MAXIMO_BYTES = 4 * 1024 * 1024;

const EXTENSAO_POR_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "image/gif": "gif",
};

/**
 * Valida o arquivo recebido no servidor — nunca confia na validação já feita
 * no cliente (components/ui/VideoUpload.tsx), que existe só para dar
 * feedback rápido antes de gastar upload.
 */
export function validarArquivoMidiaExercicio(
  file: File | null
): { erro: string } | { extensao: string } {
  if (!file || file.size === 0) {
    return { erro: "Selecione um vídeo ou GIF." };
  }
  const extensao = EXTENSAO_POR_MIME[file.type];
  if (!extensao) {
    return { erro: "Envie um vídeo MP4/WebM ou um GIF." };
  }
  if (file.size > TAMANHO_MAXIMO_BYTES) {
    return { erro: "Arquivo muito grande — envie um clipe curto (poucos segundos) de até 4 MB." };
  }
  return { extensao };
}

/**
 * Envia o clipe para o bucket `midia-exercicios` com um nome não previsível
 * (UUID) e devolve a URL pública. `upsert: false` porque cada envio ganha um
 * nome novo — nunca sobrescreve um arquivo existente, então uma troca de
 * clipe nunca serve cache antigo (a URL em si muda).
 */
export async function enviarMidiaExercicio(
  academiaId: string,
  arquivo: File,
  extensao: string
): Promise<{ url: string } | { erro: string }> {
  const supabase = createServiceRoleClient();
  const caminho = `${academiaId}/${randomUUID()}.${extensao}`;

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const { error } = await supabase.storage
    .from(BUCKET_MIDIA_EXERCICIOS)
    .upload(caminho, bytes, { contentType: arquivo.type, upsert: false });

  if (error) {
    return { erro: "Não foi possível enviar o arquivo. Tente novamente." };
  }

  const { data } = supabase.storage.from(BUCKET_MIDIA_EXERCICIOS).getPublicUrl(caminho);
  return { url: data.publicUrl };
}
