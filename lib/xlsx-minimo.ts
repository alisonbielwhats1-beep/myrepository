// Gerador e leitor mínimos de .xlsx (Office Open XML), sem dependência nova.
//
// Por que existe: o modelo em CSV obrigava o dono a passar pelo assistente do
// Excel (escolher separador, definir tipo de cada coluna) antes de conseguir
// preencher. Com um .xlsx de verdade ele abre, digita e salva — e as colunas já
// nascem formatadas como TEXTO, o que impede o Excel de comer o zero à esquerda
// de um CPF ou virar telefone em notação científica.
//
// PURO: usa só APIs padrão que existem no navegador e no Node 18+ (TextEncoder,
// DecompressionStream, Blob, Response). Sem React/Next/Supabase — compila
// isolado no `npm run test:importar`.
//
// Escopo deliberadamente pequeno: escrevemos ZIP sem compressão (método 0,
// aceito pelo Excel) para não precisar de deflate na escrita, e na leitura
// pegamos a PRIMEIRA planilha da pasta de trabalho. Não lidamos com fórmulas,
// datas seriais nem múltiplas abas — a importação de alunos não precisa.

const codificador = new TextEncoder();

// ---------------------------------------------------------------------------
// CRC32 (exigido pelo formato ZIP)
// ---------------------------------------------------------------------------

let tabelaCrc: Uint32Array | null = null;

function crc32(dados: Uint8Array): number {
  if (!tabelaCrc) {
    tabelaCrc = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabelaCrc[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < dados.length; i++) {
    crc = tabelaCrc[(crc ^ dados[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// ZIP — escrita (stored) e leitura (stored + deflate)
// ---------------------------------------------------------------------------

interface EntradaZip {
  nome: string;
  dados: Uint8Array;
}

function concatenar(partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((s, p) => s + p.length, 0);
  const saida = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    saida.set(p, pos);
    pos += p.length;
  }
  return saida;
}

/** Monta um ZIP sem compressão. Data fixa (1980-01-01) para saída determinística. */
function zipStored(entradas: EntradaZip[]): Uint8Array {
  const corpo: Uint8Array[] = [];
  const diretorio: Uint8Array[] = [];
  let offset = 0;

  for (const e of entradas) {
    const nome = codificador.encode(e.nome);
    const crc = crc32(e.dados);
    const tam = e.dados.length;

    const local = new Uint8Array(30 + nome.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // versão necessária
    lv.setUint16(6, 0x0800, true); // nome em UTF-8
    lv.setUint16(8, 0, true); // método 0 = stored
    lv.setUint16(10, 0, true); // hora
    lv.setUint16(12, 0x0021, true); // data = 1980-01-01
    lv.setUint32(14, crc, true);
    lv.setUint32(18, tam, true);
    lv.setUint32(22, tam, true);
    lv.setUint16(26, nome.length, true);
    lv.setUint16(28, 0, true);
    local.set(nome, 30);
    corpo.push(local, e.dados);

    const central = new Uint8Array(46 + nome.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // versão de origem
    cv.setUint16(6, 20, true); // versão necessária
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x0021, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, tam, true);
    cv.setUint32(24, tam, true);
    cv.setUint16(28, nome.length, true);
    cv.setUint32(42, offset, true); // offset do cabeçalho local
    central.set(nome, 46);
    diretorio.push(central);

    offset += local.length + tam;
  }

  const dir = concatenar(diretorio);
  const fim = new Uint8Array(22);
  const fv = new DataView(fim.buffer);
  fv.setUint32(0, 0x06054b50, true);
  fv.setUint16(8, entradas.length, true);
  fv.setUint16(10, entradas.length, true);
  fv.setUint32(12, dir.length, true);
  fv.setUint32(16, offset, true);

  return concatenar([...corpo, dir, fim]);
}

async function inflarRaw(dados: Uint8Array): Promise<Uint8Array> {
  const fluxo = new Blob([dados as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

/** Extrai as entradas do ZIP pelo diretório central (fonte confiável dos tamanhos). */
async function descompactar(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decodificador = new TextDecoder("utf-8");

  // Localiza o "end of central directory" varrendo do fim (comentário até 64 KB).
  let fim = -1;
  const limite = Math.max(0, bytes.length - 22 - 0xffff);
  for (let i = bytes.length - 22; i >= limite; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new Error("Arquivo .xlsx inválido (fim do ZIP não encontrado).");

  const total = dv.getUint16(fim + 10, true);
  let pos = dv.getUint32(fim + 16, true);
  const arquivos = new Map<string, Uint8Array>();

  for (let n = 0; n < total; n++) {
    if (dv.getUint32(pos, true) !== 0x02014b50) break;
    const metodo = dv.getUint16(pos + 10, true);
    const tamComp = dv.getUint32(pos + 20, true);
    const tamNome = dv.getUint16(pos + 28, true);
    const tamExtra = dv.getUint16(pos + 30, true);
    const tamComent = dv.getUint16(pos + 32, true);
    const offsetLocal = dv.getUint32(pos + 42, true);
    const nome = decodificador.decode(bytes.subarray(pos + 46, pos + 46 + tamNome));

    // O cabeçalho local repete nome/extra com tamanhos próprios — os dados
    // começam depois deles.
    const nomeLocal = dv.getUint16(offsetLocal + 26, true);
    const extraLocal = dv.getUint16(offsetLocal + 28, true);
    const inicio = offsetLocal + 30 + nomeLocal + extraLocal;
    const bruto = bytes.subarray(inicio, inicio + tamComp);

    if (metodo === 0) arquivos.set(nome, bruto);
    else if (metodo === 8) arquivos.set(nome, await inflarRaw(bruto));
    // Outros métodos (ex.: bzip2) não são usados por Excel/Sheets — ignorados.

    pos += 46 + tamNome + tamExtra + tamComent;
  }

  return arquivos;
}

// ---------------------------------------------------------------------------
// XML — utilidades
// ---------------------------------------------------------------------------

/**
 * XML 1.0 não admite caracteres de controle (só tab, LF e CR). Se um escapar —
 * e planilha exportada de sistema legado costuma trazer — o Excel recusa o
 * arquivo inteiro. Escrito com escapes, e não com os bytes crus, para o
 * arquivo-fonte continuar sendo texto puro.
 */
const SEM_CONTROLE = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]", "g");

function escaparXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Caracteres de controle são ilegais em XML 1.0 — some com eles.
    .replace(SEM_CONTROLE, "");
}

function desescaparXml(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&"); // por último, senão desfaz os anteriores
}

/** "AB12" -> 27 (índice base-0 da coluna). */
function indiceDaColuna(ref: string): number {
  const letras = ref.replace(/[^A-Za-z]/g, "").toUpperCase();
  let n = 0;
  for (let i = 0; i < letras.length; i++) n = n * 26 + (letras.charCodeAt(i) - 64);
  return n - 1;
}

/** 0 -> "A", 26 -> "AA". */
function letraDaColuna(indice: number): string {
  let n = indice + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

const CABECALHO_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS_PLANILHA = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL_DOC = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/**
 * Estilos: o índice 2 do `cellXfs` usa numFmtId="49" (Texto). Ele é aplicado à
 * COLUNA inteira (elemento `<col style="2">`), não só às células preenchidas —
 * é isso que faz o CPF digitado na linha 300 continuar com o zero à esquerda.
 */
const ESTILOS_XML = `${CABECALHO_XML}
<styleSheet xmlns="${NS_PLANILHA}">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF1F2937"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F5C8"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
</styleSheet>`;

function celulaTexto(coluna: number, linha: number, valor: string, estilo: number): string {
  const ref = `${letraDaColuna(coluna)}${linha}`;
  if (valor === "") return `<c r="${ref}" s="${estilo}"/>`;
  // inlineStr evita a tabela de strings compartilhadas (uma parte a menos).
  return `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(
    valor
  )}</t></is></c>`;
}

/**
 * Gera um .xlsx de uma aba só, com todas as colunas formatadas como Texto,
 * cabeçalho em negrito e painel congelado na linha 1.
 *
 * `linhasVazias` reserva linhas já formatadas abaixo dos exemplos, para o dono
 * digitar sem que o Excel volte a adivinhar tipo de dado.
 */
export function gerarXlsx(
  cabecalho: string[],
  linhas: string[][],
  opcoes: { nomeAba?: string; largura?: number } = {}
): Uint8Array {
  const nomeAba = (opcoes.nomeAba ?? "Dados").slice(0, 31);
  const largura = opcoes.largura ?? 20;
  const nCols = Math.max(cabecalho.length, ...linhas.map((l) => l.length), 1);

  const xmlLinhas: string[] = [];
  xmlLinhas.push(
    `<row r="1">${cabecalho
      .map((v, c) => celulaTexto(c, 1, v, 1))
      .join("")}</row>`
  );
  linhas.forEach((linha, i) => {
    const n = i + 2;
    xmlLinhas.push(
      `<row r="${n}">${linha.map((v, c) => celulaTexto(c, n, v, 2)).join("")}</row>`
    );
  });

  const ultima = linhas.length + 1;
  const sheet = `${CABECALHO_XML}
<worksheet xmlns="${NS_PLANILHA}">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols><col min="1" max="${nCols}" width="${largura}" style="2" customWidth="1"/></cols>
<sheetData>${xmlLinhas.join("")}</sheetData>
<autoFilter ref="A1:${letraDaColuna(nCols - 1)}${Math.max(ultima, 1)}"/>
</worksheet>`;

  const contentTypes = `${CABECALHO_XML}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rels = `${CABECALHO_XML}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="${NS_REL_DOC}/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `${CABECALHO_XML}
<workbook xmlns="${NS_PLANILHA}" xmlns:r="${NS_REL_DOC}">
<sheets><sheet name="${escaparXml(nomeAba)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const workbookRels = `${CABECALHO_XML}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="${NS_REL_DOC}/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="${NS_REL_DOC}/styles" Target="styles.xml"/>
</Relationships>`;

  return zipStored([
    { nome: "[Content_Types].xml", dados: codificador.encode(contentTypes) },
    { nome: "_rels/.rels", dados: codificador.encode(rels) },
    { nome: "xl/workbook.xml", dados: codificador.encode(workbook) },
    { nome: "xl/_rels/workbook.xml.rels", dados: codificador.encode(workbookRels) },
    { nome: "xl/styles.xml", dados: codificador.encode(ESTILOS_XML) },
    { nome: "xl/worksheets/sheet1.xml", dados: codificador.encode(sheet) },
  ]);
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/** Assinatura de ZIP ("PK\x03\x04") — todo .xlsx é um ZIP. */
export function ehXlsx(bytes: Uint8Array): boolean {
  return (
    bytes.length > 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

function lerStringsCompartilhadas(xml: string): string[] {
  const saida: string[] = [];
  const reItem = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = reItem.exec(xml))) {
    // Uma <si> pode ser quebrada em vários <r><t> (trechos com formatação
    // diferente) — o texto da célula é a concatenação de todos.
    let texto = "";
    const reT = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
    let mt: RegExpExecArray | null;
    while ((mt = reT.exec(m[1]))) texto += desescaparXml(mt[1]);
    saida.push(texto);
  }
  return saida;
}

function lerAba(xml: string, compartilhadas: string[]): string[][] {
  const linhas: string[][] = [];
  const reLinha = /<row(\s[^>]*)?>([\s\S]*?)<\/row>/g;
  let ml: RegExpExecArray | null;

  while ((ml = reLinha.exec(xml))) {
    const attrsLinha = ml[1] ?? "";
    const nLinha = Number(/\br="(\d+)"/.exec(attrsLinha)?.[1] ?? linhas.length + 1);
    const celulas: string[] = [];

    const reCel = /<c(\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/c>)/g;
    let mc: RegExpExecArray | null;
    while ((mc = reCel.exec(ml[2]))) {
      const attrs = mc[1] ?? "";
      const conteudo = mc[2] ?? "";
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const tipo = /\bt="([^"]+)"/.exec(attrs)?.[1] ?? "n";

      let valor = "";
      if (tipo === "inlineStr") {
        const reT = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
        let mt: RegExpExecArray | null;
        while ((mt = reT.exec(conteudo))) valor += desescaparXml(mt[1]);
      } else {
        const cru = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(conteudo)?.[1];
        if (cru != null) {
          const texto = desescaparXml(cru);
          if (tipo === "s") valor = compartilhadas[Number(texto)] ?? "";
          else if (tipo === "b") valor = texto === "1" ? "VERDADEIRO" : "FALSO";
          else valor = texto; // número, data serial ou "str" (fórmula) — texto cru
        }
      }

      const col = ref ? indiceDaColuna(ref) : celulas.length;
      while (celulas.length < col) celulas.push("");
      celulas[col] = valor;
    }

    // Respeita o índice r= para que linhas puladas não desloquem a numeração
    // mostrada nos erros de validação.
    while (linhas.length < nLinha - 1) linhas.push([]);
    linhas[nLinha - 1] = celulas;
  }

  return linhas;
}

/**
 * Lê a primeira planilha de um .xlsx e devolve a grade de células como texto —
 * mesmo formato que `parsearCsv` produz, para cair no mesmo validador.
 */
export async function lerXlsx(bytes: Uint8Array): Promise<string[][]> {
  const arquivos = await descompactar(bytes);

  const nomesAbas = [...arquivos.keys()]
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(n))
    .sort((a, b) => {
      const na = Number(/(\d+)/.exec(a)?.[1] ?? 0);
      const nb = Number(/(\d+)/.exec(b)?.[1] ?? 0);
      return na - nb;
    });
  if (nomesAbas.length === 0) {
    throw new Error("Nenhuma planilha encontrada no arquivo .xlsx.");
  }

  const decodificador = new TextDecoder("utf-8");
  const compartilhadas = arquivos.has("xl/sharedStrings.xml")
    ? lerStringsCompartilhadas(decodificador.decode(arquivos.get("xl/sharedStrings.xml")!))
    : [];

  return lerAba(decodificador.decode(arquivos.get(nomesAbas[0])!), compartilhadas);
}
