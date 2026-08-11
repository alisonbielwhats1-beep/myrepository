// Parser e validação da importação de alunos em massa (CSV) — Bloco de vendas.
//
// PURO (sem I/O, sem React/Next/Supabase): compila isolado pelo `npm run
// test:importar`, no mesmo padrão de lib/faixas-comerciais.ts. O servidor lê o
// arquivo e chama `analisarPlanilha`; o componente cliente usa a MESMA função
// para a pré-visualização — uma regra só, sem divergência.
//
// Decisão do dono (2026-08): telefone NÃO bloqueia (barraria migração de base
// incompleta) — importa todos, mas avisa quem está sem telefone e trata número
// em formato inválido como erro (número torto é pior que vazio).

import { normalizarCpf } from "./validacoes";
import { StatusMatricula } from "./types";
import { ehXlsx, gerarXlsx, lerXlsx } from "./xlsx-minimo";

const STATUS_VALIDOS: StatusMatricula[] = [
  "ativa",
  "inativa",
  "trancada",
  "pendente",
  "cancelada",
];

/** Uma linha pronta para virar aluno (já validada e normalizada). */
export interface AlunoImportado {
  linha: number;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  plano_id: string | null;
  /** null = deixar o servidor aplicar o padrão (min(hoje, 28)). */
  dia_vencimento: number | null;
  status_matricula: StatusMatricula;
}

export interface ProblemaImport {
  linha: number;
  motivo: string;
}

export interface ResultadoAnalise {
  validos: AlunoImportado[];
  erros: ProblemaImport[];
  /** Não bloqueiam a importação (ex.: aluno sem telefone). */
  avisos: ProblemaImport[];
  totalLinhas: number;
}

export const CABECALHO_MODELO = [
  "nome",
  "cpf",
  "telefone",
  "email",
  "plano",
  "dia_vencimento",
  "status",
];

/** Teto por importação — evita estourar o tempo de função da Vercel. */
export const MAX_LINHAS_IMPORT = 2000;

/** Remove acento e baixa a caixa, para casar cabeçalhos de forma tolerante. */
function chaveColuna(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

// Aliases aceitos por coluna (já normalizados por chaveColuna).
const ALIASES: Record<string, string> = {
  nome: "nome",
  cpf: "cpf",
  telefone: "telefone",
  celular: "telefone",
  whatsapp: "telefone",
  fone: "telefone",
  email: "email",
  plano: "plano",
  diavencimento: "dia_vencimento",
  vencimento: "dia_vencimento",
  dia: "dia_vencimento",
  status: "status",
};

/**
 * Parser de CSV tolerante: detecta separador `,` ou `;` (Excel BR usa `;`),
 * respeita aspas (inclusive `""` escapado), aceita CRLF/LF e ignora BOM.
 */
export function parsearCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  const primeira = t.split(/\r?\n/, 1)[0] ?? "";
  const delim =
    (primeira.match(/;/g)?.length ?? 0) > (primeira.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";

  const linhas: string[][] = [];
  let campo = "";
  let registro: string[] = [];
  let aspas = false;

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          aspas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      aspas = true;
    } else if (c === delim) {
      registro.push(campo);
      campo = "";
    } else if (c === "\n") {
      registro.push(campo);
      linhas.push(registro);
      registro = [];
      campo = "";
    } else if (c !== "\r") {
      campo += c;
    }
  }
  if (campo !== "" || registro.length > 0) {
    registro.push(campo);
    linhas.push(registro);
  }
  return linhas;
}

// ---------------------------------------------------------------------------
// Modelo para o dono preencher
// ---------------------------------------------------------------------------

/** Linhas de exemplo do modelo: uma completa e uma só com o obrigatório. */
const EXEMPLOS_MODELO: string[][] = [
  ["João da Silva", "12345678901", "11999998888", "joao@email.com", "Mensal", "10", "ativa"],
  ["Maria Souza (apague estas 2 linhas)", "", "", "", "", "", ""],
];

/**
 * Modelo em .xlsx — formato recomendado. As colunas já vêm formatadas como
 * Texto, então o Excel não come o zero à esquerda do CPF nem transforma o
 * telefone em notação científica, e o dono não precisa passar pelo assistente
 * de importação (escolher separador / tipo de coluna) antes de digitar.
 */
export function gerarModeloXlsx(): Uint8Array {
  return gerarXlsx(CABECALHO_MODELO, EXEMPLOS_MODELO, {
    nomeAba: "Alunos",
    largura: 22,
  });
}

/**
 * Modelo em CSV — alternativa para quem usa outra ferramenta. Usa `;` porque é
 * o separador de lista do Excel em português: com vírgula ele joga a linha
 * inteira numa coluna só. O BOM faz o Excel reconhecer o UTF-8 (acentos).
 */
export function gerarModeloCsv(): string {
  const linhas = [CABECALHO_MODELO, ...EXEMPLOS_MODELO];
  return "﻿" + linhas.map((l) => l.join(";")).join("\r\n") + "\r\n";
}

/**
 * Lê o arquivo enviado (xlsx ou csv) e devolve a grade de células.
 *
 * A detecção é pelos bytes, não pela extensão: cliente que renomeia .csv para
 * .xlsx (ou o contrário) continua funcionando. Usada tanto pela pré-visualização
 * no navegador quanto pela Server Action — mesma leitura dos dois lados.
 */
export async function linhasDoArquivo(arquivo: File): Promise<string[][]> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (ehXlsx(bytes)) return lerXlsx(bytes);
  return parsearCsv(new TextDecoder("utf-8").decode(bytes));
}

/** Telefone brasileiro: só dígitos, 10 (fixo) ou 11 (celular com 9). */
function telefoneValido(digits: string): boolean {
  return digits.length === 10 || digits.length === 11;
}

/**
 * Analisa a planilha inteira contra os planos existentes da academia.
 * Cada linha vira: válida, erro (não entra) ou aviso (entra, mas com ressalva).
 */
export function analisarPlanilha(
  texto: string,
  planos: { id: string; nome: string }[]
): ResultadoAnalise {
  return analisarLinhas(parsearCsv(texto), planos);
}

/**
 * Mesma análise, a partir da grade de células já lida — é por aqui que o .xlsx
 * entra, reusando integralmente a validação do CSV.
 */
export function analisarLinhas(
  grade: string[][],
  planos: { id: string; nome: string }[]
): ResultadoAnalise {
  // Guarda o número ORIGINAL da linha antes de descartar as vazias, para que
  // "Linha 15" no relatório seja a linha 15 que o dono vê no Excel.
  const linhas = grade
    .map((celulas, i) => ({ celulas, numero: i + 1 }))
    .filter((l) => l.celulas.some((c) => c.trim() !== ""));

  const erros: ProblemaImport[] = [];
  const avisos: ProblemaImport[] = [];
  const validos: AlunoImportado[] = [];

  if (linhas.length === 0) {
    return { validos, erros: [{ linha: 0, motivo: "Planilha vazia." }], avisos, totalLinhas: 0 };
  }

  // Cabeçalho → índice de cada coluna conhecida.
  const cabecalho = linhas[0].celulas.map((c) => ALIASES[chaveColuna(c)] ?? "");
  const idx = (nome: string) => cabecalho.indexOf(nome);
  if (idx("nome") === -1) {
    return {
      validos,
      erros: [{ linha: 1, motivo: 'Falta a coluna "nome" no cabeçalho. Baixe o modelo.' }],
      avisos,
      totalLinhas: 0,
    };
  }

  const planoPorNome = new Map(planos.map((p) => [chaveColuna(p.nome), p.id]));
  const cpfsVistos = new Map<string, number>(); // cpf -> primeira linha
  const dados = linhas.slice(1);

  if (dados.length > MAX_LINHAS_IMPORT) {
    erros.push({
      linha: 0,
      motivo: `A planilha tem ${dados.length} linhas. Importe no máximo ${MAX_LINHAS_IMPORT} por vez (divida em partes).`,
    });
  }

  dados.slice(0, MAX_LINHAS_IMPORT).forEach(({ celulas, numero: nLinha }) => {
    const val = (nome: string) => (idx(nome) >= 0 ? (celulas[idx(nome)] ?? "").trim() : "");

    const nome = val("nome");
    if (!nome) {
      erros.push({ linha: nLinha, motivo: "Nome em branco." });
      return;
    }

    // CPF (opcional, mas se vier tem que ser válido e não repetido).
    let cpf: string | null = null;
    const cpfBruto = val("cpf");
    if (cpfBruto) {
      cpf = normalizarCpf(cpfBruto);
      if (!cpf) {
        erros.push({ linha: nLinha, motivo: `CPF inválido ("${cpfBruto}").` });
        return;
      }
      const antes = cpfsVistos.get(cpf);
      if (antes) {
        erros.push({ linha: nLinha, motivo: `CPF repetido na planilha (já na linha ${antes}).` });
        return;
      }
      cpfsVistos.set(cpf, nLinha);
    }

    // Plano (opcional; se vier, tem que existir na academia).
    let planoId: string | null = null;
    const planoBruto = val("plano");
    if (planoBruto) {
      planoId = planoPorNome.get(chaveColuna(planoBruto)) ?? null;
      if (!planoId) {
        erros.push({ linha: nLinha, motivo: `Plano "${planoBruto}" não existe nesta academia.` });
        return;
      }
    }

    // Telefone (opcional; formato inválido é erro; ausência é aviso).
    let telefone: string | null = null;
    const foneBruto = val("telefone");
    if (foneBruto) {
      const digits = foneBruto.replace(/\D/g, "");
      if (!telefoneValido(digits)) {
        erros.push({ linha: nLinha, motivo: `Telefone inválido ("${foneBruto}"). Use DDD + número.` });
        return;
      }
      telefone = foneBruto; // guarda como veio (o link de WhatsApp limpa na hora)
    } else {
      avisos.push({ linha: nLinha, motivo: `${nome}: sem telefone — não receberá WhatsApp até preencher.` });
    }

    // E-mail (opcional; formato torto vira aviso e é descartado, não bloqueia).
    let email: string | null = null;
    const emailBruto = val("email");
    if (emailBruto) {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailBruto)) {
        email = emailBruto;
      } else {
        avisos.push({ linha: nLinha, motivo: `${nome}: e-mail inválido ("${emailBruto}") — ignorado.` });
      }
    }

    // Dia de vencimento (opcional; 1..28; fora disso é erro).
    let diaVencimento: number | null = null;
    const diaBruto = val("dia_vencimento");
    if (diaBruto) {
      const n = parseInt(diaBruto, 10);
      if (!Number.isFinite(n) || n < 1 || n > 28) {
        erros.push({ linha: nLinha, motivo: `Dia de vencimento inválido ("${diaBruto}"). Use 1 a 28.` });
        return;
      }
      diaVencimento = n;
    }

    // Status (opcional; deriva do plano quando em branco).
    let status: StatusMatricula;
    const statusBruto = chaveColuna(val("status"));
    if (statusBruto) {
      const casado = STATUS_VALIDOS.find((s) => s === statusBruto);
      if (!casado) {
        erros.push({
          linha: nLinha,
          motivo: `Status inválido ("${val("status")}"). Use: ${STATUS_VALIDOS.join(", ")}.`,
        });
        return;
      }
      status = casado;
    } else {
      status = planoId ? "ativa" : "pendente";
    }
    // Sem plano nunca fica "ativa" (mesma regra do cadastro no servidor).
    if (planoId === null && status === "ativa") status = "pendente";

    validos.push({
      linha: nLinha,
      nome,
      cpf,
      telefone,
      email,
      plano_id: planoId,
      dia_vencimento: diaVencimento,
      status_matricula: status,
    });
  });

  return { validos, erros, avisos, totalLinhas: dados.length };
}
