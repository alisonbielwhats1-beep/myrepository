import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  Flame,
  HelpCircle,
  QrCode,
  Trophy,
  User,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import AvatarAluno from "@/components/aluno/AvatarAluno";
import AvisosAluno from "@/components/aluno/AvisosAluno";
import {
  requireFichaAluno,
  sequenciaSemanalTreino,
} from "@/lib/aluno-publico";
import {
  getFeedComunidade,
  getFrequenciaAlunoPublico,
  getMensalidadesAlunoPublico,
  getNotificacoesAluno,
  getPoliticaAcessoAlunoPublico,
  getRecordesAluno,
  getSessoesAtivasTreino,
} from "@/lib/data";
import {
  badgeStatusAcesso,
  badgeStatusFinanceiro,
  calcularStatusFinanceiro,
  cn,
  dataSaoPaulo,
  decidirAcesso,
  formatBRL,
  hojeSaoPaulo,
} from "@/lib/utils";
import {
  ROTULO_DIA_LONGO,
  diaSemanaHojeSaoPaulo,
  normalizarDias,
} from "@/lib/dias-semana";
import type { DiaSemana } from "@/lib/dias-semana";
import type {
  FichaTreinoPublico,
  ResultadoAcesso,
  StatusFinanceiro,
} from "@/lib/types";

const ROTULO_FINANCEIRO: Record<StatusFinanceiro, string> = {
  em_dia: "Em dia",
  a_vencer: "A vencer",
  pendente: "Vence hoje",
  inadimplente: "Em atraso",
};

const ROTULO_ACESSO: Record<ResultadoAcesso, string> = {
  liberado: "Liberado",
  alerta: "Com alerta",
  bloqueado: "Bloqueado",
};

const ICONE_ACESSO: Record<ResultadoAcesso, typeof CheckCircle2> = {
  liberado: CheckCircle2,
  alerta: AlertTriangle,
  bloqueado: XCircle,
};

const BADGE_ACESSO_INDISPONIVEL = "bg-ink-600 text-slate-300 border-ink-500";

/** "Treino A - Peito e Tríceps" → { titulo, grupos }. */
function separarNome(nome: string): { titulo: string; grupos: string | null } {
  const partes = nome.split(/\s+[-–—]\s+/);
  if (partes.length < 2) return { titulo: nome.trim(), grupos: null };
  return { titulo: partes[0].trim(), grupos: partes.slice(1).join(" · ").trim() };
}

/**
 * Próximo treino a partir de amanhã (auditoria de UX, item 2): um dia de
 * descanso nunca deve ser um beco sem saída — mostramos qual é o próximo dia
 * de treino para o aluno se situar na semana. Varre os 7 dias seguintes (com
 * volta ao início da semana) e devolve a primeira ficha que se aplica.
 */
function proximoTreino(
  treinos: FichaTreinoPublico[],
  diaHoje: DiaSemana
): { treino: FichaTreinoPublico; dia: DiaSemana } | null {
  const porOrdem = [...treinos].sort((a, b) => a.ordem - b.ordem);
  for (let i = 1; i <= 7; i++) {
    const dia = (((diaHoje - 1 + i) % 7) + 1) as DiaSemana;
    const treino = porOrdem.find((t) => normalizarDias(t.dias_semana).includes(dia));
    if (treino) return { treino, dia };
  }
  return null;
}

export default async function AlunoHome({
  params,
}: {
  params: { slug: string; token: string };
}) {
  const ficha = await requireFichaAluno(params.slug, params.token);
  const { aluno, academia, treinos } = ficha;

  const [mensalidades, acessos, politicaAcesso, recordes, avisos, feed, sessoes] =
    await Promise.all([
      getMensalidadesAlunoPublico(params.token, params.slug),
      getFrequenciaAlunoPublico(params.token, params.slug),
      getPoliticaAcessoAlunoPublico(params.token, params.slug),
      getRecordesAluno(params.token, params.slug),
      getNotificacoesAluno(params.token, params.slug),
      getFeedComunidade(params.token, params.slug, 3),
      getSessoesAtivasTreino(params.token, params.slug),
    ]);

  const base = `/aluno/${params.slug}/${params.token}`;
  const primeiroNome = aluno.nome.split(" ")[0];
  const statusFinanceiro = calcularStatusFinanceiro(mensalidades);
  const hoje = hojeSaoPaulo();
  const seq = sequenciaSemanalTreino(acessos);

  // Treino de hoje: primeira ficha (por ordem) cujos dias incluem o dia atual.
  const diaHoje = diaSemanaHojeSaoPaulo();
  const treinoHoje = [...treinos]
    .sort((a, b) => a.ordem - b.ordem)
    .find((t) => normalizarDias(t.dias_semana).includes(diaHoje));

  // Sessão em andamento do treino de hoje (Bloco 1): habilita "Retomar de onde
  // parei" e a barra de progresso no herói, em vez de um "Iniciar" cru.
  const sessaoHoje = treinoHoje
    ? sessoes.find((s) => s.treino_id === treinoHoje.id && s.status === "ativa")
    : undefined;
  const totalExerciciosHoje = treinoHoje?.exercicios?.length ?? 0;
  const feitosHoje = sessaoHoje
    ? sessaoHoje.progresso.filter((p) => p.concluido).length
    : 0;
  const progressoPct =
    totalExerciciosHoje > 0
      ? Math.round((feitosHoje / totalExerciciosHoje) * 100)
      : 0;

  // Próximo treino da semana — usado no estado "dia de descanso" para dar saída.
  const proximo = proximoTreino(treinos, diaHoje);

  // "Treinos este mês" = check-ins (acessos) do mês corrente no fuso da academia.
  const prefixoMes = hoje.slice(0, 7); // YYYY-MM
  const treinosNoMes = acessos.filter(
    (a) => dataSaoPaulo(a.data_hora_entrada).slice(0, 7) === prefixoMes
  ).length;

  const nomePorExercicio = new Map(
    treinos.flatMap((t) => t.exercicios ?? []).map((e) => [e.id, e.nome_exercicio])
  );
  const recordeTop = Object.entries(recordes)
    .map(([id, kg]) => ({ nome: nomePorExercicio.get(id) ?? null, kg }))
    .filter((r): r is { nome: string; kg: number } => r.nome !== null)
    .sort((a, b) => b.kg - a.kg)[0];

  const proximaMensalidade = mensalidades
    .filter((m) => m.status === "pendente")
    .sort((a, b) => (a.data < b.data ? -1 : 1))[0];

  const statusAcesso = politicaAcesso
    ? decidirAcesso(aluno.status_matricula, politicaAcesso, mensalidades)
    : null;
  const IconeAcesso = statusAcesso ? ICONE_ACESSO[statusAcesso.resultado] : HelpCircle;

  return (
    <div className="space-y-6">
      {/* Saudação */}
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-slate-400">{academia.nome_fantasia}</p>
          <h1 className="truncate text-2xl font-bold text-white">
            Olá, {primeiroNome} 👋
          </h1>
        </div>
        <AvatarAluno nome={aluno.nome} fotoUrl={aluno.foto_perfil_url} size={48} />
      </header>

      {/* Avisos in-app (ex.: treino novo atribuído) */}
      <AvisosAluno slug={params.slug} token={params.token} notificacoes={avisos} />

      {/* TREINO DE HOJE — herói da home. Único destaque verde da tela. */}
      <Link
        href={`${base}/treinos`}
        className={cn(
          "surface block rounded-2xl p-5 transition active:scale-[0.99]",
          treinoHoje
            ? "border-volt-400/50 bg-volt-500/[0.06] shadow-glow hover:border-volt-400"
            : "hover:border-ink-500"
        )}
      >
        <div className="flex items-center justify-between">
          <p className="label-muted">Treino de hoje</p>
          {treinoHoje && sessaoHoje ? (
            <span className="rounded-full bg-volt-300 px-2.5 py-1 text-xs font-bold tabular-nums text-ink-950">
              {feitosHoje} de {totalExerciciosHoje}
            </span>
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-volt-300/15 text-volt-300">
              <Dumbbell className="h-5 w-5" />
            </span>
          )}
        </div>
        {treinoHoje ? (
          <>
            <h2 className="mt-2 text-xl font-bold text-white">
              {separarNome(treinoHoje.nome_treino).grupos ??
                separarNome(treinoHoje.nome_treino).titulo}
            </h2>
            <p className="mt-0.5 text-sm text-slate-400">
              {separarNome(treinoHoje.nome_treino).grupos
                ? separarNome(treinoHoje.nome_treino).titulo + " · "
                : ""}
              {totalExerciciosHoje} exercícios
            </p>
            {sessaoHoje && totalExerciciosHoje > 0 && (
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-valuenow={progressoPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-volt-300 transition-[width] duration-300"
                  style={{ width: `${progressoPct}%` }}
                />
              </div>
            )}
            <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-volt-300">
              {sessaoHoje ? "Retomar de onde parei" : "Começar treino"}
              <ChevronRight className="h-4 w-4" />
            </span>
          </>
        ) : treinos.length > 0 ? (
          <>
            <h2 className="mt-2 text-lg font-bold text-white">
              Dia de descanso — e está tudo certo.
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Você treinou {seq.treinosSemana}{" "}
              {seq.treinosSemana === 1 ? "vez" : "vezes"} esta semana.
              {proximo && (
                <>
                  {" "}
                  Próximo: {separarNome(proximo.treino.nome_treino).titulo} na{" "}
                  {ROTULO_DIA_LONGO[proximo.dia].toLowerCase()}.
                </>
              )}
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-200">
              Ver a semana <ChevronRight className="h-4 w-4" />
            </span>
          </>
        ) : (
          <>
            <h2 className="mt-2 text-lg font-bold text-white">
              Seu treino ainda está sendo montado
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Fale com a recepção da sua academia para receber sua ficha.
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-200">
              Ver meus treinos <ChevronRight className="h-4 w-4" />
            </span>
          </>
        )}
      </Link>

      {/* SEU PROGRESSO */}
      <section className="surface rounded-2xl p-4">
        <p className="label-muted">Seu progresso</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-ink-900/50 p-3">
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <CalendarDays className="h-3.5 w-3.5 text-volt-300" /> Este mês
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-white">
              {treinosNoMes}
              <span className="ml-1 text-sm font-medium text-slate-400">
                {treinosNoMes === 1 ? "treino" : "treinos"}
              </span>
            </p>
          </div>
          <div className="rounded-xl bg-ink-900/50 p-3">
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <Flame className="h-3.5 w-3.5 text-volt-300" /> Sequência
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-white">
              {seq.semanasSeguidas}
              <span className="ml-1 text-sm font-medium text-slate-400">
                {seq.semanasSeguidas === 1 ? "semana" : "semanas"}
              </span>
            </p>
          </div>
        </div>
        {recordeTop && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-ink-900/50 p-3">
            <span className="flex items-center gap-2 text-sm text-slate-300">
              <Trophy className="h-4 w-4 text-amber-400" /> Recorde: {recordeTop.nome}
            </span>
            <span className="flex-none font-bold tabular-nums text-amber-300">
              {recordeTop.kg} kg
            </span>
          </div>
        )}
      </section>

      {/* COMUNIDADE — prévia */}
      <Link
        href={`${base}/comunidade`}
        className="surface block rounded-2xl p-4 transition hover:border-ink-500"
      >
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-semibold text-white">
            <Users className="h-4 w-4 text-volt-300" /> Comunidade
          </p>
          <ChevronRight className="h-5 w-5 text-slate-500" />
        </div>
        {feed.length > 0 ? (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex -space-x-2">
              {feed.slice(0, 3).map((p) => (
                <AvatarAluno
                  key={p.id}
                  nome={p.autor.nome}
                  fotoUrl={p.autor.foto_url}
                  size={32}
                  className="ring-2 ring-ink-800"
                />
              ))}
            </div>
            <p className="min-w-0 flex-1 truncate text-sm text-slate-400">
              {feed[0].autor.nome.split(" ")[0]}
              {feed.length > 1 ? " e outros publicaram" : " publicou"} recentemente
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">
            Veja e compartilhe conquistas com a galera da academia.
          </p>
        )}
      </Link>

      {/* Situação (financeiro + acesso) — informações importantes, condensadas */}
      <section className="surface space-y-3 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Wallet className="h-4 w-4 text-volt-300" /> Situação financeira
          </div>
          <span className={cn("chip", badgeStatusFinanceiro(statusFinanceiro))}>
            {ROTULO_FINANCEIRO[statusFinanceiro]}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-ink-600/60 pt-3">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <IconeAcesso className="h-4 w-4 text-volt-300" /> Situação de acesso
          </div>
          <span
            className={cn(
              "chip",
              statusAcesso
                ? badgeStatusAcesso(statusAcesso.resultado)
                : BADGE_ACESSO_INDISPONIVEL
            )}
          >
            {statusAcesso ? ROTULO_ACESSO[statusAcesso.resultado] : "Indisponível"}
          </span>
        </div>

        {proximaMensalidade && (
          <div className="flex items-center justify-between gap-2 border-t border-ink-600/60 pt-3 text-sm">
            <div className="flex items-center gap-2 text-slate-300">
              <CalendarClock className="h-4 w-4 text-cyanx-400" /> Próxima mensalidade
            </div>
            <div className="text-right">
              <p className="font-semibold text-white">
                {formatBRL(proximaMensalidade.valor)}
              </p>
              <p className="text-xs text-slate-500">
                vence{" "}
                {new Date(proximaMensalidade.data + "T00:00:00").toLocaleDateString(
                  "pt-BR",
                  { day: "2-digit", month: "2-digit" }
                )}
                {proximaMensalidade.data < hoje && (
                  <span className="text-red-400"> · vencida</span>
                )}
              </p>
            </div>
          </div>
        )}

        <Link
          href={`${base}/mensalidades`}
          className="flex items-center justify-between border-t border-ink-600/60 pt-3 text-sm text-slate-400 transition hover:text-slate-200"
        >
          Ver mensalidades <ChevronRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Atalhos pequenos, incluindo o acesso (item 9: no máximo um atalho discreto) */}
      <div className="grid grid-cols-3 gap-3">
        <AtalhoPequeno href={`${base}/frequencia`} icon={CalendarDays} label="Frequência" />
        <AtalhoPequeno href={`${base}/acesso`} icon={QrCode} label="Acesso" />
        <AtalhoPequeno href={`${base}/perfil`} icon={User} label="Perfil" />
      </div>
    </div>
  );
}

function AtalhoPequeno({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Dumbbell;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="surface flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center transition active:scale-[0.98] hover:border-ink-500"
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-700 text-slate-300">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-xs font-medium text-slate-300">{label}</span>
    </Link>
  );
}
