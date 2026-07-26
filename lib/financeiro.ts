// Agregações financeiras puras (sem I/O) — usadas pela página Financeiro e
// pelo Dashboard, a partir das receitas/despesas já buscadas do banco.
//
// REGIME (Fase 7A):
//   • Caixa      → quando o dinheiro entrou/saiu. Usa `data_pagamento`.
//                  Alimenta KPIs do período, gráfico, saldo e projeção.
//   • Competência → a que mês o lançamento pertence. Usa `competencia`.
//                  Alimenta exclusivamente o DRE.
//
// Nunca use `data` (vencimento) para nenhum dos dois. Ela existe para saber o
// que está vencido, não para dizer quando o dinheiro se moveu.
//
// Cancelada nunca entra em nada: nem caixa, nem competência, nem pendências,
// nem projeção. Continua visível nas tabelas.

import { paraCentavos, paraReais, somarCentavos } from "./dinheiro";
import { hojeSaoPaulo } from "./utils";
import {
  CategoriaDespesa,
  Despesa,
  PontoFinanceiroMensal,
  Receita,
  TipoReceita,
} from "./types";

const NOMES_MES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function chaveMes(iso: string): string {
  return iso.slice(0, 7); // "YYYY-MM"
}

/** Últimos `meses` meses (incluindo o atual), do mais antigo ao mais recente. */
export function ultimosMeses(meses: number): { chave: string; label: string }[] {
  const [ano, mes] = hojeSaoPaulo().split("-").map(Number);
  const out: { chave: string; label: string }[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(ano, mes - 1 - i, 1);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ chave, label: NOMES_MES[d.getMonth()] });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Predicados de regime
// ---------------------------------------------------------------------------

/** Entrou em caixa dentro do período: paga, com data_pagamento na janela. */
function recebidaNoPeriodo(r: Receita, inicio: string, fim: string): boolean {
  return (
    r.status === "pago" &&
    !!r.data_pagamento &&
    r.data_pagamento >= inicio &&
    r.data_pagamento <= fim
  );
}

function pagaNoPeriodo(d: Despesa, inicio: string, fim: string): boolean {
  return (
    d.status === "pago" &&
    !!d.data_pagamento &&
    d.data_pagamento >= inicio &&
    d.data_pagamento <= fim
  );
}

/**
 * Mês de competência do lançamento.
 *
 * Mensalidades e salários têm `competencia` preenchida. Venda de produto e
 * receita manual não têm — para essas, a competência é o próprio dia do fato
 * gerador (`data`), que é quando a venda aconteceu. Sem esse fallback, todo o
 * faturamento da loja sumiria do DRE.
 */
function competenciaDe(item: { competencia: string | null; data: string }): string {
  // Trunca para o dia 1 do mês, igual ao date_trunc('month', data) da RPC —
  // as duas implementações precisam concordar.
  return item.competencia ?? `${item.data.slice(0, 7)}-01`;
}

/** Conta como competência do período (exclui cancelada; inclui pendente). */
function naCompetencia(
  item: { competencia: string | null; data: string; status: string },
  inicio: string,
  fim: string
): boolean {
  if (item.status === "cancelada") return false;
  const comp = competenciaDe(item);
  // A competência é sempre dia 1; comparar com o início do mês do período
  // evita que um filtro "05/07 a 20/07" perca a competência 01/07.
  return comp >= `${chaveMes(inicio)}-01` && comp <= fim;
}

// ---------------------------------------------------------------------------
// KPIs de caixa do período
// ---------------------------------------------------------------------------

export interface CaixaPeriodo {
  receitaRecebida: number;
  despesaPaga: number;
  resultado: number;
}

/** Receita recebida, despesa paga e resultado — tudo por data_pagamento. */
export function calcularCaixaPeriodo(
  receitas: Receita[],
  despesas: Despesa[],
  inicio: string,
  fim: string
): CaixaPeriodo {
  const recCent = somarCentavos(
    receitas.filter((r) => recebidaNoPeriodo(r, inicio, fim)),
    (r) => r.valor
  );
  const despCent = somarCentavos(
    despesas.filter((d) => pagaNoPeriodo(d, inicio, fim)),
    (d) => d.valor
  );
  return {
    receitaRecebida: paraReais(recCent),
    despesaPaga: paraReais(despCent),
    resultado: paraReais(recCent - despCent),
  };
}

// ---------------------------------------------------------------------------
// Contas a receber / a pagar — vencido e futuro separados
// ---------------------------------------------------------------------------

export interface Pendencias {
  vencido: number;
  futuro: number;
  total: number;
  qtdVencido: number;
  qtdFuturo: number;
}

function separarPendencias<T extends { status: string; data: string; valor: number }>(
  itens: T[],
  hoje: string
): Pendencias {
  const pendentes = itens.filter((i) => i.status === "pendente");
  const vencidos = pendentes.filter((i) => i.data < hoje);
  const futuros = pendentes.filter((i) => i.data >= hoje);
  const vCent = somarCentavos(vencidos, (i) => i.valor);
  const fCent = somarCentavos(futuros, (i) => i.valor);
  return {
    vencido: paraReais(vCent),
    futuro: paraReais(fCent),
    total: paraReais(vCent + fCent),
    qtdVencido: vencidos.length,
    qtdFuturo: futuros.length,
  };
}

/** Vencido a receber (data < hoje em SP) vs. futuro a receber. */
export function calcularContasAReceber(
  receitas: Receita[],
  hoje = hojeSaoPaulo()
): Pendencias {
  return separarPendencias(receitas, hoje);
}

/** Vencido a pagar vs. futuro a pagar, mesma referência de data. */
export function calcularContasAPagar(
  despesas: Despesa[],
  hoje = hojeSaoPaulo()
): Pendencias {
  return separarPendencias(despesas, hoje);
}

// ---------------------------------------------------------------------------
// Saldo registrado e projeção
// ---------------------------------------------------------------------------

export interface SaldoRegistrado {
  saldoInicial: number;
  desde: string | null;
  recebido: number;
  pago: number;
  saldo: number;
}

/**
 * Saldo registrado no GestAcad — NÃO é saldo bancário.
 *
 *   saldo_inicial
 *   + receitas pagas com data_pagamento >= desde
 *   - despesas pagas com data_pagamento >= desde
 *
 * `desde` = data_saldo_inicial da academia. Se for nula, usa o primeiro
 * lançamento pago com data_pagamento registrado no sistema.
 */
export function calcularSaldoRegistrado(
  receitas: Receita[],
  despesas: Despesa[],
  saldoInicial: number,
  dataSaldoInicial: string | null
): SaldoRegistrado {
  const recComData = receitas.filter((r) => r.status === "pago" && r.data_pagamento);
  const despComData = despesas.filter((d) => d.status === "pago" && d.data_pagamento);

  let desde = dataSaldoInicial;
  if (!desde) {
    const datas = [
      ...recComData.map((r) => r.data_pagamento!),
      ...despComData.map((d) => d.data_pagamento!),
    ];
    desde = datas.length ? datas.reduce((a, b) => (a < b ? a : b)) : null;
  }

  const recCent = somarCentavos(
    recComData.filter((r) => !desde || r.data_pagamento! >= desde),
    (r) => r.valor
  );
  const despCent = somarCentavos(
    despComData.filter((d) => !desde || d.data_pagamento! >= desde),
    (d) => d.valor
  );
  const inicialCent = paraCentavos(saldoInicial);

  return {
    saldoInicial: paraReais(inicialCent),
    desde,
    recebido: paraReais(recCent),
    pago: paraReais(despCent),
    saldo: paraReais(inicialCent + recCent - despCent),
  };
}

export interface SaldoProjetado {
  saldoRegistrado: number;
  aReceber: number;
  aPagar: number;
  projetado: number;
}

/** Saldo registrado + total a receber - total a pagar. Projeção potencial. */
export function calcularSaldoProjetado(
  saldoRegistrado: number,
  aReceber: number,
  aPagar: number
): SaldoProjetado {
  const cent =
    paraCentavos(saldoRegistrado) + paraCentavos(aReceber) - paraCentavos(aPagar);
  return {
    saldoRegistrado: paraReais(paraCentavos(saldoRegistrado)),
    aReceber: paraReais(paraCentavos(aReceber)),
    aPagar: paraReais(paraCentavos(aPagar)),
    projetado: paraReais(cent),
  };
}

// ---------------------------------------------------------------------------
// Lançamentos fora do regime de caixa (histórico incompleto)
// ---------------------------------------------------------------------------

export interface LancamentosIncompletos {
  receitas: number;
  receitasValor: number;
  despesas: number;
  despesasValor: number;
}

/**
 * Pagos que não têm data_pagamento e portanto NÃO entram no regime de caixa.
 * A interface avisa a quantidade em vez de inventar uma data para eles.
 */
export function contarIncompletos(
  receitas: Receita[],
  despesas: Despesa[]
): LancamentosIncompletos {
  const r = receitas.filter((x) => x.status === "pago" && !x.data_pagamento);
  const d = despesas.filter((x) => x.status === "pago" && !x.data_pagamento);
  return {
    receitas: r.length,
    receitasValor: paraReais(somarCentavos(r, (x) => x.valor)),
    despesas: d.length,
    despesasValor: paraReais(somarCentavos(d, (x) => x.valor)),
  };
}

// ---------------------------------------------------------------------------
// Gráfico — regime de caixa, agrupado por data_pagamento
// ---------------------------------------------------------------------------

/**
 * Série do gráfico dentro de [desde, ate]. Barras = caixa realizado
 * (data_pagamento). A linha "projetado" soma o que ainda está PENDENTE por
 * vencimento no mesmo bucket — cancelada nunca entra.
 */
export function agruparFinanceiro(
  receitas: Receita[],
  despesas: Despesa[],
  desde: string,
  ate: string
): PontoFinanceiroMensal[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  const [ay, am, ad] = desde.split("-").map(Number);
  const [by, bm, bd] = ate.split("-").map(Number);
  const dDesde = new Date(ay, am - 1, ad);
  const dAte = new Date(by, bm - 1, bd);
  const spanDias = Math.round((dAte.getTime() - dDesde.getTime()) / 86400_000) + 1;

  const recCaixa = new Map<string, number>();
  const despCaixa = new Map<string, number>();
  const recPend = new Map<string, number>();
  const despPend = new Map<string, number>();

  const add = (m: Map<string, number>, k: string, v: number | string) =>
    m.set(k, (m.get(k) ?? 0) + paraCentavos(v));

  const diario = spanDias <= 62;
  const bucket = (iso: string) => (diario ? iso : chaveMes(iso));

  for (const r of receitas) {
    if (recebidaNoPeriodo(r, desde, ate)) {
      add(recCaixa, bucket(r.data_pagamento!), r.valor);
    }
    // Pendente entra pelo vencimento; cancelada fica de fora.
    if (r.status === "pendente" && r.data >= desde && r.data <= ate) {
      add(recPend, bucket(r.data), r.valor);
    }
  }
  for (const d of despesas) {
    if (pagaNoPeriodo(d, desde, ate)) {
      add(despCaixa, bucket(d.data_pagamento!), d.valor);
    }
    if (d.status === "pendente" && d.data >= desde && d.data <= ate) {
      add(despPend, bucket(d.data), d.valor);
    }
  }

  const ponto = (chave: string, label: string): PontoFinanceiroMensal => {
    const rc = recCaixa.get(chave) ?? 0;
    const dc = despCaixa.get(chave) ?? 0;
    const rp = recPend.get(chave) ?? 0;
    const dp = despPend.get(chave) ?? 0;
    return {
      mes: label,
      receita: paraReais(rc),
      despesa: paraReais(dc),
      // Resultado de caixa do bucket + o que ainda pode entrar/sair nele.
      projetado: paraReais(rc - dc + rp - dp),
    };
  };

  const out: PontoFinanceiroMensal[] = [];
  if (diario) {
    for (let i = 0; i < spanDias; i++) {
      const dt = new Date(ay, am - 1, ad + i);
      const chave = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
      out.push(ponto(chave, `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}`));
    }
    return out;
  }

  let cursor = new Date(ay, am - 1, 1);
  const fim = new Date(by, bm - 1, 1);
  while (cursor <= fim) {
    const chave = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
    out.push(ponto(chave, NOMES_MES[cursor.getMonth()]));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return out;
}

/** Série mensal para o Dashboard (regime de caixa), últimos `meses` meses. */
export function agruparPorMes(
  receitas: Receita[],
  despesas: Despesa[],
  meses = 6
): PontoFinanceiroMensal[] {
  const janela = ultimosMeses(meses);
  const desde = `${janela[0].chave}-01`;
  const ultimo = janela[janela.length - 1].chave;
  const [uy, um] = ultimo.split("-").map(Number);
  const fimMes = new Date(uy, um, 0);
  const ate = `${uy}-${String(um).padStart(2, "0")}-${String(fimMes.getDate()).padStart(2, "0")}`;
  return agruparFinanceiro(receitas, despesas, desde, ate);
}

// ---------------------------------------------------------------------------
// DRE — regime de competência
// ---------------------------------------------------------------------------

export interface LinhaDRE<T> {
  chave: T;
  total: number;
}

export interface DRE {
  receitasPorTipo: LinhaDRE<TipoReceita>[];
  despesasPorCategoria: LinhaDRE<CategoriaDespesa>[];
  totalReceita: number;
  /** Parte da receita por competência que JÁ foi recebida. */
  receitaRecebida: number;
  /** Parte da receita por competência ainda a receber. */
  receitaAReceber: number;
  totalDespesa: number;
  despesaPaga: number;
  despesaAPagar: number;
  lucro: number;
  margem: number; // % do lucro sobre a receita
  /** Quantos lançamentos entraram pelo fallback `data` por não ter competencia. */
  semCompetencia: number;
}

/**
 * DRE em REGIME DE COMPETÊNCIA: agrupa por `competencia`, não por vencimento
 * nem por pagamento. Inclui pendentes (a receita foi gerada no mês, mesmo que
 * ainda não tenha entrado) e exclui canceladas.
 */
export function calcularDRE(
  receitas: Receita[],
  despesas: Despesa[],
  inicio: string,
  fim: string
): DRE {
  const recMap = new Map<TipoReceita, number>();
  const despMap = new Map<CategoriaDespesa, number>();
  let semCompetencia = 0;
  let recRecebidaCent = 0;
  let recAReceberCent = 0;
  let despPagaCent = 0;
  let despAPagarCent = 0;

  for (const r of receitas) {
    if (!naCompetencia(r, inicio, fim)) continue;
    if (!r.competencia) semCompetencia++;
    const c = paraCentavos(r.valor);
    recMap.set(r.tipo, (recMap.get(r.tipo) ?? 0) + c);
    if (r.status === "pago") recRecebidaCent += c;
    else if (r.status === "pendente") recAReceberCent += c;
  }
  for (const d of despesas) {
    if (!naCompetencia(d, inicio, fim)) continue;
    if (!d.competencia) semCompetencia++;
    const c = paraCentavos(d.valor);
    despMap.set(d.categoria, (despMap.get(d.categoria) ?? 0) + c);
    if (d.status === "pago") despPagaCent += c;
    else if (d.status === "pendente") despAPagarCent += c;
  }

  const receitasPorTipo = Array.from(recMap.entries())
    .map(([chave, cent]) => ({ chave, total: paraReais(cent) }))
    .sort((a, b) => b.total - a.total);
  const despesasPorCategoria = Array.from(despMap.entries())
    .map(([chave, cent]) => ({ chave, total: paraReais(cent) }))
    .sort((a, b) => b.total - a.total);

  const recCent = Array.from(recMap.values()).reduce((a, b) => a + b, 0);
  const despCent = Array.from(despMap.values()).reduce((a, b) => a + b, 0);
  const lucroCent = recCent - despCent;

  return {
    receitasPorTipo,
    despesasPorCategoria,
    totalReceita: paraReais(recCent),
    receitaRecebida: paraReais(recRecebidaCent),
    receitaAReceber: paraReais(recAReceberCent),
    totalDespesa: paraReais(despCent),
    despesaPaga: paraReais(despPagaCent),
    despesaAPagar: paraReais(despAPagarCent),
    lucro: paraReais(lucroCent),
    margem: recCent > 0 ? Math.round((lucroCent / recCent) * 10000) / 100 : 0,
    semCompetencia,
  };
}

// ---------------------------------------------------------------------------
// Adaptadores das RPCs (migration 031) para os mesmos formatos acima.
//
// As funções puras continuam sendo a especificação executável do cálculo — é
// contra elas que os testes rodam. Estes adaptadores só traduzem o retorno já
// agregado pelo Postgres para o formato que as telas consomem.
// ---------------------------------------------------------------------------

type ResumoRPC = {
  receita_recebida: number; despesa_paga: number; resultado: number;
  receber_vencido: number; receber_futuro: number;
  receber_qtd_vencido: number; receber_qtd_futuro: number;
  pagar_vencido: number; pagar_futuro: number;
  pagar_qtd_vencido: number; pagar_qtd_futuro: number;
  saldo_inicial: number; saldo_desde: string | null;
  saldo_recebido: number; saldo_pago: number; saldo: number;
  incompletas_receitas: number; incompletas_receitas_valor: number;
  incompletas_despesas: number; incompletas_despesas_valor: number;
};

const n = (v: number | string | null | undefined) => paraReais(paraCentavos(v));

export function caixaDoResumo(r: ResumoRPC | null): CaixaPeriodo {
  if (!r) return { receitaRecebida: 0, despesaPaga: 0, resultado: 0 };
  return {
    receitaRecebida: n(r.receita_recebida),
    despesaPaga: n(r.despesa_paga),
    resultado: n(r.resultado),
  };
}

export function pendenciasDoResumo(
  r: ResumoRPC | null,
  lado: "receber" | "pagar"
): Pendencias {
  if (!r) return { vencido: 0, futuro: 0, total: 0, qtdVencido: 0, qtdFuturo: 0 };
  const venc = lado === "receber" ? r.receber_vencido : r.pagar_vencido;
  const fut = lado === "receber" ? r.receber_futuro : r.pagar_futuro;
  return {
    vencido: n(venc),
    futuro: n(fut),
    total: paraReais(paraCentavos(venc) + paraCentavos(fut)),
    qtdVencido: lado === "receber" ? r.receber_qtd_vencido : r.pagar_qtd_vencido,
    qtdFuturo: lado === "receber" ? r.receber_qtd_futuro : r.pagar_qtd_futuro,
  };
}

export function saldoDoResumo(r: ResumoRPC | null): SaldoRegistrado {
  if (!r) {
    return { saldoInicial: 0, desde: null, recebido: 0, pago: 0, saldo: 0 };
  }
  return {
    saldoInicial: n(r.saldo_inicial),
    desde: r.saldo_desde,
    recebido: n(r.saldo_recebido),
    pago: n(r.saldo_pago),
    saldo: n(r.saldo),
  };
}

export function incompletosDoResumo(r: ResumoRPC | null): LancamentosIncompletos {
  if (!r) return { receitas: 0, receitasValor: 0, despesas: 0, despesasValor: 0 };
  return {
    receitas: r.incompletas_receitas,
    receitasValor: n(r.incompletas_receitas_valor),
    despesas: r.incompletas_despesas,
    despesasValor: n(r.incompletas_despesas_valor),
  };
}

type LinhaDreRPC = {
  escopo: string; chave: string; total: number;
  realizado: number; em_aberto: number; sem_competencia: number;
};

export function montarDRE(linhas: LinhaDreRPC[]): DRE {
  const receitasPorTipo: LinhaDRE<TipoReceita>[] = [];
  const despesasPorCategoria: LinhaDRE<CategoriaDespesa>[] = [];
  let recCent = 0, recRealCent = 0, recAbertoCent = 0;
  let despCent = 0, despRealCent = 0, despAbertoCent = 0;
  let semCompetencia = 0;

  for (const l of linhas) {
    const total = paraCentavos(l.total);
    semCompetencia += l.sem_competencia ?? 0;
    if (l.escopo === "receita") {
      receitasPorTipo.push({ chave: l.chave as TipoReceita, total: paraReais(total) });
      recCent += total;
      recRealCent += paraCentavos(l.realizado);
      recAbertoCent += paraCentavos(l.em_aberto);
    } else {
      despesasPorCategoria.push({
        chave: l.chave as CategoriaDespesa,
        total: paraReais(total),
      });
      despCent += total;
      despRealCent += paraCentavos(l.realizado);
      despAbertoCent += paraCentavos(l.em_aberto);
    }
  }

  receitasPorTipo.sort((a, b) => b.total - a.total);
  despesasPorCategoria.sort((a, b) => b.total - a.total);
  const lucroCent = recCent - despCent;

  return {
    receitasPorTipo,
    despesasPorCategoria,
    totalReceita: paraReais(recCent),
    receitaRecebida: paraReais(recRealCent),
    receitaAReceber: paraReais(recAbertoCent),
    totalDespesa: paraReais(despCent),
    despesaPaga: paraReais(despRealCent),
    despesaAPagar: paraReais(despAbertoCent),
    lucro: paraReais(lucroCent),
    margem: recCent > 0 ? Math.round((lucroCent / recCent) * 10000) / 100 : 0,
    semCompetencia,
  };
}

type PontoSerieRPC = {
  bucket: string; receita: number; despesa: number;
  receita_pend: number; despesa_pend: number;
};

export function montarSerie(
  pontos: PontoSerieRPC[],
  diario: boolean
): PontoFinanceiroMensal[] {
  return pontos.map((p) => {
    const [ano, mes, dia] = p.bucket.slice(0, 10).split("-");
    const rc = paraCentavos(p.receita);
    const dc = paraCentavos(p.despesa);
    const rp = paraCentavos(p.receita_pend);
    const dp = paraCentavos(p.despesa_pend);
    return {
      mes: diario ? `${dia}/${mes}` : NOMES_MES[Number(mes) - 1] ?? `${mes}/${ano}`,
      receita: paraReais(rc),
      despesa: paraReais(dc),
      projetado: paraReais(rc - dc + rp - dp),
    };
  });
}
