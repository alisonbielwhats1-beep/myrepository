// Regra de geração de cobranças recorrentes — especificação executável.
//
// A implementação de PRODUÇÃO vive no banco (RPC sincronizar_cobrancas, na
// migration 032), porque botão manual e cron precisam compartilhar exatamente a
// mesma lógica. Este arquivo é o espelho testável dessa regra: é contra ele que
// tests/cobrancas.test.cjs roda. Ao mexer em um, mexa no outro.
//
// A regra NÃO olha status de pagamento em momento nenhum: o não pagamento da
// cobrança anterior não impede a próxima ser criada.

/** Último dia do mês de uma competência YYYY-MM-01. */
function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Índice absoluto de mês, para diferença entre competências. */
function indiceMes(iso: string): number {
  const [ano, mes] = iso.split("-").map(Number);
  return ano * 12 + mes;
}

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function competenciaDe(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function somarMeses(competencia: string, meses: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const total = (ano * 12 + (mes - 1)) + meses;
  const novoAno = Math.floor(total / 12);
  const novoMes = (total % 12) + 1;
  return `${novoAno}-${String(novoMes).padStart(2, "0")}-01`;
}

/** Um aluno só entra na geração se estiver ativo e com plano cobrável. */
export function elegivelParaCobranca(entrada: {
  statusMatricula: string;
  cobrancaRecorrente: boolean;
  valorMensal: number;
  planoId: string | null;
}): boolean {
  return (
    entrada.statusMatricula === "ativa" &&
    entrada.planoId !== null &&
    entrada.cobrancaRecorrente === true &&
    Number(entrada.valorMensal) > 0
  );
}

export type CobrancaPlanejada = {
  /** YYYY-MM-01 */
  competencia: string;
  /** YYYY-MM-DD */
  vencimento: string;
};

/**
 * Competências que devem existir hoje para um aluno elegível.
 *
 * Janela: do mês corrente até o mês em que cai `hoje + diasAntecedencia`. Uma
 * cobrança nasce assim que faltam `diasAntecedencia` dias ou menos para o
 * vencimento — vencimento 26/08 com antecedência 7 aparece a partir de 19/08.
 *
 * A janela não retroage além do mês corrente de propósito: um cron que ficou
 * dias fora do ar não deve despejar meses de cobranças retroativas de uma vez.
 *
 * Ciclo ancorado em `anchorISO` (historico_planos.data_inicio, com fallback na
 * criação do aluno): mensal cobra todo mês; recorrência maior só cobra quando
 * o número de meses decorridos fecha um múltiplo do ciclo.
 */
export function competenciasAGerar(entrada: {
  /** data_inicio do ciclo, YYYY-MM-DD */
  anchorISO: string;
  diaVencimento: number;
  recorrenciaMeses: number;
  /** hoje em America/Sao_Paulo, YYYY-MM-DD */
  hojeISO: string;
  diasAntecedencia?: number;
}): CobrancaPlanejada[] {
  const {
    anchorISO,
    diaVencimento,
    recorrenciaMeses,
    hojeISO,
    diasAntecedencia = 7,
  } = entrada;

  const limite = somarDias(hojeISO, diasAntecedencia);
  const primeira = competenciaDe(hojeISO);
  const ultima = competenciaDe(limite);
  const ancora = competenciaDe(anchorISO);
  const recorrencia = Math.max(1, Math.floor(recorrenciaMeses) || 1);
  const dia = Math.min(Math.max(Math.floor(diaVencimento) || 1, 1), 31);

  const saida: CobrancaPlanejada[] = [];
  let comp = primeira;

  while (indiceMes(comp) <= indiceMes(ultima)) {
    const decorridos = indiceMes(comp) - indiceMes(ancora);

    // Antes do início do ciclo, ou mês intermediário de plano não mensal.
    if (decorridos >= 0 && (recorrencia === 1 || decorridos % recorrencia === 0)) {
      const [ano, mes] = comp.split("-").map(Number);
      const diaFinal = Math.min(dia, ultimoDiaDoMes(ano, mes));
      const vencimento = `${ano}-${String(mes).padStart(2, "0")}-${String(diaFinal).padStart(2, "0")}`;

      // Só cria quando já estamos dentro da antecedência.
      if (vencimento <= limite) saida.push({ competencia: comp, vencimento });
    }

    comp = somarMeses(comp, 1);
  }

  return saida;
}
