// Processamento de imagem 100% no navegador (recorte quadrado + compressão)
// para o upload de foto de perfil — usado pela área do aluno (sem login) e
// pelo formulário de aluno no painel, para as duas telas aplicarem a mesma
// regra antes de qualquer coisa sair do dispositivo. NUNCA importar em um
// arquivo de Server Action/Server Component: depende de `window`/`canvas`.

export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"] as const;
export const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5 MB — teto do ARQUIVO ORIGINAL, escolhido no aparelho
const LADO_MAXIMO_PX = 512; // nunca sai do navegador maior que isto
const QUALIDADE_INICIAL = 0.78;
const QUALIDADE_MINIMA = 0.4; // piso de compressão — abaixo disso a foto fica ruim demais
const ALVO_BYTES = 500 * 1024; // 500 KB — meta: tenta chegar aqui reduzindo qualidade
const LIMITE_REJEICAO_BYTES = 800 * 1024; // 800 KB — acima disso, recusa antes de enviar

class ImagemGrandeDemaisError extends Error {}

/** Validação rápida antes de processar — mesma checagem que o servidor repete depois. */
export function erroDoArquivo(file: File): string | null {
  if (!TIPOS_ACEITOS.includes(file.type as (typeof TIPOS_ACEITOS)[number])) {
    return "Envie uma imagem JPG, PNG ou WebP.";
  }
  if (file.size > TAMANHO_MAXIMO_BYTES) {
    return "A imagem deve ter no máximo 5 MB.";
  }
  return null;
}

async function carregarBitmap(file: File): Promise<ImageBitmap> {
  try {
    // "from-image" respeita a orientação EXIF da foto (comum em câmera de celular).
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(file);
  }
}

function codificarJpeg(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", qualidade));
}

/**
 * Recorta para o maior quadrado centralizado, redimensiona para no máximo
 * 512x512 e reencoda como JPEG. Começa em ~78% de qualidade; se o resultado
 * ainda passar de 500 KB, reduz a qualidade em passos até caber (ou até o
 * piso de compressão). Nunca sai do navegador acima de 800 KB — passou disso
 * mesmo no piso de qualidade, a foto é recusada ali mesmo, antes do envio.
 */
async function recortarQuadradoEComprimir(file: File): Promise<Blob> {
  const bitmap = await carregarBitmap(file);
  const lado = Math.min(bitmap.width, bitmap.height);
  const origemX = (bitmap.width - lado) / 2;
  const origemY = (bitmap.height - lado) / 2;
  const destino = Math.min(lado, LADO_MAXIMO_PX);

  const canvas = document.createElement("canvas");
  canvas.width = destino;
  canvas.height = destino;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");
  ctx.drawImage(bitmap, origemX, origemY, lado, lado, 0, 0, destino, destino);
  bitmap.close?.();

  let qualidade = QUALIDADE_INICIAL;
  let blob = await codificarJpeg(canvas, qualidade);
  if (!blob) throw new Error("Falha ao processar a imagem.");

  // Ainda acima da meta de 500 KB: tenta comprimir mais, em passos, até o piso de qualidade.
  while (blob.size > ALVO_BYTES && qualidade > QUALIDADE_MINIMA) {
    qualidade = Math.max(QUALIDADE_MINIMA, qualidade - 0.1);
    const tentativa = await codificarJpeg(canvas, qualidade);
    if (!tentativa) break;
    blob = tentativa;
    if (qualidade <= QUALIDADE_MINIMA) break;
  }

  if (blob.size > LIMITE_REJEICAO_BYTES) {
    throw new ImagemGrandeDemaisError();
  }

  return blob;
}

/**
 * Valida, recorta (quadrado) e comprime a imagem escolhida (câmera ou
 * galeria). Devolve o blob pronto para envio + uma URL de preview local.
 * Quem chama é responsável por `URL.revokeObjectURL(previewUrl)` quando não
 * precisar mais dela.
 */
export async function prepararFotoParaEnvio(
  file: File
): Promise<{ blob: Blob; previewUrl: string } | { erro: string }> {
  const erro = erroDoArquivo(file);
  if (erro) return { erro };
  try {
    const blob = await recortarQuadradoEComprimir(file);
    return { blob, previewUrl: URL.createObjectURL(blob) };
  } catch (e) {
    if (e instanceof ImagemGrandeDemaisError) {
      return {
        erro:
          "Mesmo comprimida, essa imagem ficou acima de 800 KB. Tente uma foto mais simples ou com menos detalhe.",
      };
    }
    return { erro: "Não foi possível processar essa imagem. Tente outra foto." };
  }
}
