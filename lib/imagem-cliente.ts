// Processamento de imagem 100% no navegador (recorte quadrado + compressão)
// para o upload de foto de perfil — usado pela área do aluno (sem login) e
// pelo formulário de aluno no painel, para as duas telas aplicarem a mesma
// regra antes de qualquer coisa sair do dispositivo. NUNCA importar em um
// arquivo de Server Action/Server Component: depende de `window`/`canvas`.

// Qualquer formato que o aparelho consiga abrir é aceito: JPG, PNG, WebP, GIF,
// AVIF, BMP e também HEIC/HEIF (padrão da câmera do iPhone e de vários
// Android), que o Chrome não sabe abrir — para esse caso um decodificador
// (heic-to, WASM) é baixado sob demanda, só quando aparece um HEIC. O arquivo
// original nunca sai do aparelho: sempre vira um JPEG pequeno aqui.
export const TAMANHO_MAXIMO_BYTES = 50 * 1024 * 1024; // 50 MB — teto do ARQUIVO ORIGINAL, escolhido no aparelho
const LADO_MAXIMO_PX = 512; // nunca sai do navegador maior que isto
const QUALIDADE_INICIAL = 0.78;
const QUALIDADE_MINIMA = 0.4; // piso de compressão — abaixo disso a foto fica ruim demais
const ALVO_BYTES = 500 * 1024; // 500 KB — meta: tenta chegar aqui reduzindo qualidade
const LIMITE_REJEICAO_BYTES = 800 * 1024; // 800 KB — acima disso, recusa antes de enviar

class ImagemGrandeDemaisError extends Error {}
class FormatoIlegivelError extends Error {}

const ERRO_NAO_E_FOTO =
  "Esse arquivo não é uma foto. Escolha uma imagem da galeria ou tire uma foto.";
const ERRO_FORMATO_ILEGIVEL =
  "Não conseguimos abrir essa foto neste aparelho. Tire um print dela e envie o print.";

/**
 * Validação rápida antes de processar. NÃO filtra por formato: o tipo que o
 * aparelho informa não é confiável (HEIC chega como "image/heic", "image/heif"
 * ou até vazio em alguns seletores do Android). Quem decide se a imagem serve
 * é a tentativa real de abri-la (carregarImagem). Aqui só barra o que com
 * certeza não é foto (vídeo, áudio, texto, PDF) e o tamanho absurdo.
 */
export function erroDoArquivo(file: File): string | null {
  if (/^(video|audio|text)\//.test(file.type) || file.type === "application/pdf") {
    return ERRO_NAO_E_FOTO;
  }
  if (file.size === 0) return ERRO_FORMATO_ILEGIVEL;
  if (file.size > TAMANHO_MAXIMO_BYTES) {
    return "A foto deve ter no máximo 50 MB.";
  }
  return null;
}

type ImagemAberta = {
  fonte: CanvasImageSource;
  largura: number;
  altura: number;
  liberar: () => void;
};

function deBitmap(bitmap: ImageBitmap): ImagemAberta {
  return {
    fonte: bitmap,
    largura: bitmap.width,
    altura: bitmap.height,
    liberar: () => bitmap.close?.(),
  };
}

/**
 * Abre a imagem com o que o próprio navegador sabe decodificar. Três
 * tentativas, da mais rápida à mais tolerante: createImageBitmap respeitando a
 * orientação EXIF (foto de celular deitada), createImageBitmap simples e, por
 * fim, um <img> — o Safari abre HEIC/TIFF por <img> mesmo quando
 * createImageBitmap recusa. Devolve null se nenhuma funcionar.
 */
async function abrirNoNavegador(blob: Blob): Promise<ImagemAberta | null> {
  try {
    return deBitmap(await createImageBitmap(blob, { imageOrientation: "from-image" }));
  } catch {}
  try {
    return deBitmap(await createImageBitmap(blob));
  } catch {}
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error("sem dimensões");
    return {
      fonte: img,
      largura: img.naturalWidth,
      altura: img.naturalHeight,
      liberar: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

/**
 * HEIC/HEIF são contêineres ISO-BMFF: bytes 4–8 = "ftyp". Olha a assinatura
 * em vez de confiar só no tipo informado, que pode vir vazio.
 */
async function pareceHeif(file: File): Promise<boolean> {
  if (/^image\/hei[cf]/.test(file.type) || /\.(heic|heif|hif)$/i.test(file.name)) {
    return true;
  }
  try {
    const cabecalho = new Uint8Array(await file.slice(4, 8).arrayBuffer());
    return String.fromCharCode(...Array.from(cabecalho)) === "ftyp";
  } catch {
    return false;
  }
}

/** Abre qualquer imagem que o aparelho consiga ler — ou lança FormatoIlegivelError. */
export async function carregarImagem(file: File): Promise<ImagemAberta> {
  const nativa = await abrirNoNavegador(file);
  if (nativa) return nativa;

  if (await pareceHeif(file)) {
    try {
      // Import dinâmico: o decodificador (WASM, alguns MB) só é baixado por
      // quem de fato escolheu um HEIC que o navegador não abre sozinho.
      const { heicTo } = await import("heic-to/next");
      return deBitmap(await heicTo({ blob: file, type: "bitmap" }));
    } catch {}
  }
  throw new FormatoIlegivelError();
}

/** Canvas já com fundo branco — PNG/GIF transparentes não viram fundo preto no JPEG. */
export function criarCanvas(largura: number, altura: number) {
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, largura, altura);
  return { canvas, ctx };
}

function mensagemDeErro(e: unknown, limiteKb: number): string {
  if (e instanceof ImagemGrandeDemaisError) {
    return `Mesmo comprimida, essa imagem ficou acima de ${limiteKb} KB. Tente uma foto mais simples ou com menos detalhe.`;
  }
  if (e instanceof FormatoIlegivelError) return ERRO_FORMATO_ILEGIVEL;
  return "Não foi possível processar essa imagem. Tente outra foto.";
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
  const imagem = await carregarImagem(file);
  const lado = Math.min(imagem.largura, imagem.altura);
  const origemX = (imagem.largura - lado) / 2;
  const origemY = (imagem.altura - lado) / 2;
  const destino = Math.min(lado, LADO_MAXIMO_PX);

  const { canvas, ctx } = criarCanvas(destino, destino);
  try {
    ctx.drawImage(imagem.fonte, origemX, origemY, lado, lado, 0, 0, destino, destino);
  } finally {
    imagem.liberar();
  }

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
    return { erro: mensagemDeErro(e, 800) };
  }
}

// --- Imagem da Comunidade -----------------------------------------------------
// Diferente do avatar (quadrado 512px), a publicação preserva a proporção da
// foto e permite mais resolução — mas ainda comprime no navegador para caber no
// corpo de 1 MB de uma Server Action e no teto do bucket `comunidade`.
const LADO_MAXIMO_COMUNIDADE_PX = 1080;
const ALVO_BYTES_COMUNIDADE = 700 * 1024; // 700 KB — meta de compressão
const LIMITE_REJEICAO_COMUNIDADE_BYTES = 950 * 1024; // 950 KB — teto antes do envio

async function redimensionarEComprimir(
  file: File
): Promise<{ blob: Blob; largura: number; altura: number }> {
  const imagem = await carregarImagem(file);
  const maiorLado = Math.max(imagem.largura, imagem.altura);
  const escala = maiorLado > LADO_MAXIMO_COMUNIDADE_PX ? LADO_MAXIMO_COMUNIDADE_PX / maiorLado : 1;
  const largura = Math.max(1, Math.round(imagem.largura * escala));
  const altura = Math.max(1, Math.round(imagem.altura * escala));

  const { canvas, ctx } = criarCanvas(largura, altura);
  try {
    ctx.drawImage(imagem.fonte, 0, 0, imagem.largura, imagem.altura, 0, 0, largura, altura);
  } finally {
    imagem.liberar();
  }

  let qualidade = QUALIDADE_INICIAL;
  let blob = await codificarJpeg(canvas, qualidade);
  if (!blob) throw new Error("Falha ao processar a imagem.");

  while (blob.size > ALVO_BYTES_COMUNIDADE && qualidade > QUALIDADE_MINIMA) {
    qualidade = Math.max(QUALIDADE_MINIMA, qualidade - 0.1);
    const tentativa = await codificarJpeg(canvas, qualidade);
    if (!tentativa) break;
    blob = tentativa;
    if (qualidade <= QUALIDADE_MINIMA) break;
  }

  if (blob.size > LIMITE_REJEICAO_COMUNIDADE_BYTES) {
    throw new ImagemGrandeDemaisError();
  }
  // As dimensões são as do canvas que acabamos de desenhar — exatamente o que
  // o servidor vai receber. Elas viajam junto com o blob para o feed poder
  // reservar a caixa na proporção certa (migração 103).
  return { blob, largura, altura };
}

/**
 * Valida, redimensiona (mantendo a proporção, máx. 1080px no maior lado) e
 * comprime a imagem de uma publicação da comunidade. Devolve o blob pronto,
 * suas dimensões finais e uma URL de preview local (quem chama revoga com
 * `URL.revokeObjectURL`).
 */
export async function prepararImagemComunidade(
  file: File
): Promise<
  { blob: Blob; largura: number; altura: number; previewUrl: string } | { erro: string }
> {
  const erro = erroDoArquivo(file);
  if (erro) return { erro };
  try {
    const { blob, largura, altura } = await redimensionarEComprimir(file);
    return { blob, largura, altura, previewUrl: URL.createObjectURL(blob) };
  } catch (e) {
    return { erro: mensagemDeErro(e, 950) };
  }
}
