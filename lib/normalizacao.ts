// Padronização dos dados de cadastro digitados no painel — nome, e-mail e
// telefone. Decisão do dono (2026-08-11), depois de a recepção cadastrar uma
// base inteira em CAIXA ALTA.
//
// NORMALIZAR ≠ VALIDAR. Nada aqui recusa, bloqueia ou esvazia o que o usuário
// digitou: cada função ACEITA qualquer entrada e devolve a mesma informação em
// formato padronizado. Quando não sabe formatar (telefone fora do padrão BR,
// por exemplo), devolve o texto original em vez de descartar — perder o dado do
// cliente seria pior do que guardá-lo torto. Quem recusa entrada é
// lib/validacoes.ts (CPF, URL, slug); os dois módulos não se misturam.
//
// PURO (sem I/O, sem React/Next/Supabase): compila isolado pelo
// `npm run test:normalizacao`, no mesmo padrão de lib/importar-alunos.ts. É o
// que permite o formulário (client) e as Server Actions usarem exatamente a
// mesma regra — sem divergência entre o que a tela mostra e o que o banco
// grava.

/**
 * Partículas que ficam em minúscula no meio de um nome próprio em português:
 * "Maria da Silva", não "Maria Da Silva". Inclui as formas italianas/espanholas
 * ("di", "del", "la", "y") e holandesas/alemãs ("van", "von") que aparecem em
 * sobrenomes brasileiros. Nunca se aplica à primeira palavra — "Da Silva" como
 * sobrenome único continua "Da Silva".
 */
const PARTICULAS = new Set([
  "da", "das", "de", "del", "di", "do", "dos", "du",
  "e", "la", "las", "le", "les", "van", "von", "y",
]);

/**
 * Algarismos romanos de I a X — a única forma de "Neto III" não virar "Iii".
 * Só casa a palavra inteira; nenhum nome próprio brasileiro colide com estes
 * padrões escritos por extenso.
 */
const ALGARISMOS_ROMANOS = /^(?:i{1,3}|iv|v|vi{1,3}|ix|x)$/;

/**
 * Capitaliza a inicial de cada segmento de uma palavra composta, tratando
 * hífen e apóstrofo como separadores internos:
 *   "ana-maria" -> "Ana-Maria"
 *   "d'avila"   -> "D'Avila"
 *   "j."        -> "J."
 * Usa \p{L} (unicode) para que "ávila" -> "Ávila" funcione com acento.
 */
function capitalizarSegmentos(palavra: string): string {
  return palavra.replace(
    /(^|[-'’])(\p{L})/gu,
    (_todo, separador: string, letra: string) =>
      separador + letra.toLocaleUpperCase("pt-BR")
  );
}

/**
 * Padroniza um nome próprio (aluno, funcionário, plano, produto).
 *
 * Aceita qualquer caixa e devolve capitalização de nome próprio brasileiro:
 *   "MARIA DA SILVA"  -> "Maria da Silva"
 *   "  joão   pedro " -> "João Pedro"
 *   "JOSE D'AVILA JR" -> "Jose D'Avila Jr"
 *   "CARLOS NETO III" -> "Carlos Neto III"
 *
 * Limite conhecido e aceito: uma sigla real digitada em caixa alta ("MC", "TRX")
 * vira "Mc"/"Trx", porque num texto todo em maiúsculas é impossível distinguir
 * sigla de palavra comum. Como isto roda na gravação e não na digitação, o
 * campo continua editável e a correção manual sobrevive.
 *
 * Devolve string vazia para entrada vazia/nula — nunca null, porque nome é
 * campo obrigatório e quem chama já trata "" como "não preenchido".
 */
export function normalizarNomeProprio(raw: string | null | undefined): string {
  const base = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!base) return "";

  return base
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((palavra, indice) => {
      // Partícula só fica minúscula no meio do nome, nunca na primeira palavra.
      if (indice > 0 && PARTICULAS.has(palavra)) return palavra;
      if (ALGARISMOS_ROMANOS.test(palavra)) {
        return palavra.toLocaleUpperCase("pt-BR");
      }
      return capitalizarSegmentos(palavra);
    })
    .join(" ");
}

/**
 * Padroniza um e-mail: sem espaços em volta e sempre em minúsculas.
 *
 * O domínio é case-insensitive por definição (RFC 1035) e nenhum provedor
 * relevante diferencia a caixa da parte local, então baixar tudo é seguro e
 * evita o mesmo endereço entrar duas vezes como "JOAO@" e "joao@".
 *
 * NÃO valida formato: e-mail torto é problema de validação, não de
 * padronização. Devolve null quando vem vazio (a coluna é nullable).
 */
export function normalizarEmail(raw: string | null | undefined): string | null {
  const email = (raw ?? "").trim().toLowerCase();
  return email || null;
}

/**
 * Padroniza um telefone brasileiro para o formato legível "(11) 98765-4321".
 *
 * Por que formatado e não só dígitos: o telefone é EXIBIDO cru na tela (ficha
 * do aluno, lista de funcionários, log da catraca) — "11987654321" é pior de
 * ler do que "(11) 98765-4321". O link do WhatsApp não é afetado: `linkWhats`
 * (lib/whats.ts) já limpa a máscara e prefixa o DDI na hora de montar a URL, e
 * a busca da catraca compara só dígitos.
 *
 * Um DDI 55 digitado junto é removido — ele é reposto por `linkWhats` quando
 * necessário, e guardá-lo aqui só faria o número aparecer com 13 dígitos na
 * tela.
 *
 * Fora do padrão de 10/11 dígitos (fixo/celular), devolve o que foi digitado,
 * sem máscara e sem descartar: um número incompleto ou estrangeiro continua
 * visível para a recepção corrigir. Devolve null só quando vem vazio.
 */
export function normalizarTelefone(raw: string | null | undefined): string | null {
  const original = (raw ?? "").trim();
  if (!original) return null;

  // DDI estrangeiro explícito ("+1 415 555 0100") sai intacto: sem esta linha,
  // os 11 dígitos de um número dos EUA seriam formatados como se fossem um
  // celular brasileiro — inventando um número que não existe. Só "+55" segue
  // para a formatação nacional abaixo.
  if (original.startsWith("+") && !original.replace(/\D/g, "").startsWith("55")) {
    return original;
  }

  const digitos = original.replace(/\D/g, "");
  const nacional =
    digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos;

  if (nacional.length === 11) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
  }
  if (nacional.length === 10) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
  }
  return original;
}
