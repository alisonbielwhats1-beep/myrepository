// Helpers puros (sem I/O, sem React/Next) para a área do aluno sem login
// (Fase 12): classificação de mensalidade e agregação de frequência.
//
// Ficam num módulo à parte — e não em lib/aluno-publico.ts — porque este
// precisa ser compilável isoladamente pelos scripts `npm run test:*`, no
// mesmo padrão de lib/utils.ts e lib/validacoes.ts. lib/aluno-publico.ts
// importa `react`/`next/navigation` e reexporta tudo daqui.

import { AcessoAlunoPublico, FichaAlunoPublica, MensalidadeAlunoPublica } from "./types";
import { hojeSaoPaulo } from "./utils";

/**
 * ÚNICO lugar que decide se uma ficha de aluno pode ser servida para um
 * slug de academia. Usada tanto por `requireFichaAluno` (produção) quanto
 * pelos testes de isolamento — nenhuma rota reimplementa esta checagem.
 * `ficha` nulo (aluno inexistente) ou academia divergente (aluno de outra
 * academia, inclusive com slug adulterado na URL) sempre reprovam.
 */
const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Formato de UUID do token de acesso público (Fase 12). Checagem só de
 * forma — não confirma que o token existe, só evita mandar lixo óbvio pro
 * banco. Token malformado deve virar o MESMO "link inválido" genérico de um
 * token bem-formado mas inexistente, nunca um erro de sintaxe do Postgres
 * vazando pro navegador.
 */
export function tokenTemFormatoValido(token: string | null | undefined): boolean {
  return !!token && FORMATO_UUID.test(token);
}

export function fichaPertenceAoSlug(
  ficha: Pick<FichaAlunoPublica, "academia"> | null,
  slug: string
): boolean {
  return !!ficha && ficha.academia.slug_url === slug;
}

export type ClassificacaoMensalidade = "vencida" | "pendente" | "paga" | "cancelada";

/**
 * Classifica uma mensalidade do aluno para exibição. Nunca usa o `status`
 * bruto do banco direto na tela: "pendente" sozinho não diz se já venceu.
 */
export function classificarMensalidade(
  m: Pick<MensalidadeAlunoPublica, "status" | "data">,
  hoje: string = hojeSaoPaulo()
): ClassificacaoMensalidade {
  if (m.status === "cancelada") return "cancelada";
  if (m.status === "pago") return "paga";
  return m.data < hoje ? "vencida" : "pendente";
}

const ACESSO_EFETIVO = new Set(["liberado", "alerta"]);

/** Só entrada efetiva conta (liberado/alerta) — negado nunca é presença, mesmo que já venha misturado. */
function apenasEfetivos(acessos: AcessoAlunoPublico[]): AcessoAlunoPublico[] {
  return acessos.filter((a) => ACESSO_EFETIVO.has(a.status_liberacao));
}

/** Subtrai `dias` de uma data-calendário YYYY-MM-DD (aritmética em UTC, mesma base de lib/utils#diasEntre). */
function subtrairDias(dataISO: string, dias: number): string {
  const d = new Date(`${dataISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

/** Data-calendário em America/Sao_Paulo de um timestamp ISO. */
function dataCalendarioSP(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Conta acessos efetivos com data-calendário (SP) >= `desde`. */
export function contarAcessosDesde(
  acessos: AcessoAlunoPublico[],
  desde: string
): number {
  return apenasEfetivos(acessos).filter(
    (a) => dataCalendarioSP(a.data_hora_entrada) >= desde
  ).length;
}

/** Frequência da semana (últimos 7 dias) e do mês (últimos 30 dias) corridos, contando só acesso efetivo. */
export function frequenciaSemanaEMes(
  acessos: AcessoAlunoPublico[],
  hoje: string = hojeSaoPaulo()
): { semana: number; mes: number } {
  return {
    semana: contarAcessosDesde(acessos, subtrairDias(hoje, 6)),
    mes: contarAcessosDesde(acessos, subtrairDias(hoje, 29)),
  };
}

/** Último acesso efetivo (mais recente), ou null se o aluno nunca acessou. */
export function ultimoAcessoEfetivo(acessos: AcessoAlunoPublico[]): string | null {
  const efetivos = apenasEfetivos(acessos);
  if (efetivos.length === 0) return null;
  return efetivos.reduce(
    (max, a) => (a.data_hora_entrada > max ? a.data_hora_entrada : max),
    efetivos[0].data_hora_entrada
  );
}

/** true se a URL de foto é utilizável (perfil sem foto → avatar padrão). */
export function temFotoValida(url: string | null | undefined): boolean {
  return !!url && url.trim().length > 0;
}

/** Iniciais do nome para o avatar padrão quando não há foto. */
export function iniciaisNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] ?? "" : "";
  return (primeira + ultima).toUpperCase();
}
