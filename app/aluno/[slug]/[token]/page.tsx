import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  HelpCircle,
  MessageCircle,
  User,
  Wallet,
  XCircle,
} from "lucide-react";
import AvatarAluno from "@/components/aluno/AvatarAluno";
import QRCodeCard from "@/components/aluno/QRCodeCard";
import { requireFichaAluno, ultimoAcessoEfetivo } from "@/lib/aluno-publico";
import {
  getAcademiaPublica,
  getFrequenciaAlunoPublico,
  getMensalidadesAlunoPublico,
  getPoliticaAcessoAlunoPublico,
  getTokenQrAlunoPublico,
} from "@/lib/data";
import {
  badgeStatusAcesso,
  badgeStatusFinanceiro,
  badgeStatusMatricula,
  calcularStatusFinanceiro,
  cn,
  decidirAcesso,
  formatBRL,
  formatDataHora,
  hojeSaoPaulo,
} from "@/lib/utils";
import type { ResultadoAcesso } from "@/lib/types";

const ROTULO_FINANCEIRO: Record<"em_dia" | "pendente" | "inadimplente", string> = {
  em_dia: "Em dia",
  pendente: "Vence hoje",
  inadimplente: "Mensalidade em atraso",
};

const ROTULO_ACESSO: Record<ResultadoAcesso, string> = {
  liberado: "Liberado",
  alerta: "Liberado com alerta",
  bloqueado: "Bloqueado",
};

// Textos exatos pedidos para a Home do aluno — curtos, respeitosos e sem
// nenhum valor financeiro, CPF, telefone ou regra interna da academia.
const MENSAGEM_ACESSO: Record<ResultadoAcesso, string> = {
  liberado: "Seu acesso está liberado.",
  alerta: "Seu acesso está liberado, mas existe uma pendência que precisa de atenção.",
  bloqueado: "Não foi possível liberar seu acesso. Procure a recepção para verificar sua situação.",
};

const ICONE_ACESSO: Record<ResultadoAcesso, typeof CheckCircle2> = {
  liberado: CheckCircle2,
  alerta: AlertTriangle,
  bloqueado: XCircle,
};

// Quando a política da academia não pôde ser confirmada (erro do Supabase,
// RPC ausente, valor fora do enum conhecido) — nunca tratamos isso como
// "liberar". Um estado honesto e distinto dos três resultados reais.
const MENSAGEM_ACESSO_INDISPONIVEL =
  "Não foi possível confirmar sua situação de acesso. Procure a recepção.";
const BADGE_ACESSO_INDISPONIVEL = "bg-ink-600 text-slate-300 border-ink-500";

export default async function AlunoHome({
  params,
}: {
  params: { slug: string; token: string };
}) {
  const ficha = await requireFichaAluno(params.slug, params.token);
  const { aluno, academia, treinos } = ficha;

  const [mensalidades, acessos, tokenQrAcesso, politicaAcesso, academiaPublica] =
    await Promise.all([
      getMensalidadesAlunoPublico(params.token, params.slug),
      getFrequenciaAlunoPublico(params.token, params.slug),
      getTokenQrAlunoPublico(params.token, params.slug),
      getPoliticaAcessoAlunoPublico(params.token, params.slug),
      getAcademiaPublica(params.slug),
    ]);

  const primeiroNome = aluno.nome.split(" ")[0];
  const statusFinanceiro = calcularStatusFinanceiro(mensalidades);
  const hoje = hojeSaoPaulo();
  const proximaMensalidade = mensalidades
    .filter((m) => m.status === "pendente")
    .sort((a, b) => (a.data < b.data ? -1 : 1))[0];
  const ultimoAcesso = ultimoAcessoEfetivo(acessos);

  // Mesma regra oficial da recepção (decidirAcesso) — nenhuma lógica de
  // acesso paralela. Só falta, do lado do aluno, a política da academia
  // (mensalidades e status_matricula já vêm da própria ficha).
  //
  // Se a política não pôde ser confirmada (RPC falhou, retorno inesperado),
  // `politicaAcesso` chega null e NÃO calculamos decidirAcesso com um valor
  // padrão — isso poderia mostrar "Liberado" para quem na verdade estaria
  // bloqueado. `statusAcesso` fica null e a interface mostra um estado
  // honesto de indisponibilidade, nunca um resultado inventado.
  const statusAcesso = politicaAcesso
    ? decidirAcesso(aluno.status_matricula, politicaAcesso, mensalidades)
    : null;
  const IconeAcesso = statusAcesso ? ICONE_ACESSO[statusAcesso.resultado] : HelpCircle;

  const whatsappDigits = academiaPublica?.whatsapp?.replace(/\D/g, "");
  const linkWhatsapp = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
        `Olá! Sou aluno da ${academia.nome_fantasia} e preciso falar sobre minha situação.`
      )}`
    : null;

  const base = `/aluno/${params.slug}/${params.token}`;

  return (
    <div className="space-y-6">
      {/* Cabeçalho / saudação */}
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-slate-400">{academia.nome_fantasia}</p>
          <h1 className="truncate text-2xl font-bold text-white">
            Olá, {primeiroNome} 👋
          </h1>
        </div>
        <AvatarAluno nome={aluno.nome} fotoUrl={aluno.foto_perfil_url} size={48} />
      </header>

      {/* QR de acesso */}
      <QRCodeCard
        academiaSlug={params.slug}
        tokenQrAcesso={tokenQrAcesso}
        matriculaCodigo={aluno.matricula_codigo}
      />

      {/* Resumo da matrícula e situação financeira */}
      <div className="surface space-y-3 rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="label-muted">Plano atual</p>
            <p className="font-semibold text-white">
              {aluno.plano_nome ?? "Sem plano definido"}
            </p>
          </div>
          <span className={cn("chip", badgeStatusMatricula(aluno.status_matricula))}>
            Matrícula {aluno.status_matricula}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-ink-600/60 pt-3">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Wallet className="h-4 w-4 text-volt-300" />
            Situação financeira
          </div>
          <span className={cn("chip", badgeStatusFinanceiro(statusFinanceiro))}>
            {ROTULO_FINANCEIRO[statusFinanceiro]}
          </span>
        </div>

        {/* Status de acesso — mesma regra da recepção (decidirAcesso),
            separado do cadastral e do financeiro acima. Nunca mostra valor
            vencido, quantidade de mensalidades ou motivo detalhado. */}
        <div className="flex items-center justify-between gap-2 border-t border-ink-600/60 pt-3">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <IconeAcesso className="h-4 w-4 text-volt-300" />
            Situação de acesso
          </div>
          <span
            className={cn(
              "chip",
              statusAcesso ? badgeStatusAcesso(statusAcesso.resultado) : BADGE_ACESSO_INDISPONIVEL
            )}
          >
            {statusAcesso ? ROTULO_ACESSO[statusAcesso.resultado] : "Indisponível"}
          </span>
        </div>
        <p className="text-xs text-slate-400">
          {statusAcesso ? MENSAGEM_ACESSO[statusAcesso.resultado] : MENSAGEM_ACESSO_INDISPONIVEL}
        </p>

        {proximaMensalidade && (
          <div className="flex items-center justify-between gap-2 border-t border-ink-600/60 pt-3 text-sm">
            <div className="flex items-center gap-2 text-slate-300">
              <CalendarClock className="h-4 w-4 text-cyanx-400" />
              Próxima mensalidade
            </div>
            <div className="text-right">
              <p className="font-semibold text-white">
                {formatBRL(proximaMensalidade.valor)}
              </p>
              <p className="text-xs text-slate-500">
                vence em{" "}
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
      </div>

      {/* Treino atual / próximo */}
      <Link
        href={`${base}/treinos`}
        className="surface flex items-center justify-between rounded-2xl p-4 transition hover:border-ink-500"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-700 text-volt-300">
            <Dumbbell className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-white">
              {treinos.length > 0 ? "Seu treino" : "Nenhum treino atribuído"}
            </p>
            <p className="text-sm text-slate-400">
              {treinos[0]?.nome_treino ?? "Fale com a recepção da sua academia"}
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-500" />
      </Link>

      {/* Último acesso */}
      <div className="surface flex items-center justify-between rounded-2xl p-4">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <CalendarDays className="h-4 w-4 text-volt-300" />
          Último acesso
        </div>
        <p className="text-sm font-medium text-white">
          {ultimoAcesso ? formatDataHora(ultimoAcesso) : "Nenhum acesso registrado"}
        </p>
      </div>

      {/* Ações principais */}
      <div className="grid grid-cols-2 gap-3">
        <AcaoRapida href={`${base}/treinos`} icon={Dumbbell} label="Ver meu treino" />
        <AcaoRapida href={`${base}/mensalidades`} icon={Wallet} label="Ver mensalidades" />
        <AcaoRapida href={`${base}/frequencia`} icon={CalendarDays} label="Ver frequência" />
        <AcaoRapida href={`${base}/perfil`} icon={User} label="Meu perfil" />
        {linkWhatsapp && (
          <AcaoRapida
            href={linkWhatsapp}
            icon={MessageCircle}
            label="Falar com a academia"
            externo
            className="col-span-2"
          />
        )}
      </div>
    </div>
  );
}

function AcaoRapida({
  href,
  icon: Icon,
  label,
  externo,
  className,
}: {
  href: string;
  icon: typeof Dumbbell;
  label: string;
  /** true = link externo (ex.: wa.me) — abre em nova aba, sem navegação interna do Next. */
  externo?: boolean;
  className?: string;
}) {
  const classeBase = cn(
    "surface flex flex-col items-start gap-2 rounded-2xl p-4 transition active:scale-[0.98] hover:border-ink-500",
    className
  );
  const conteudo = (
    <>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-volt-300/15 text-volt-300">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-semibold text-white">{label}</span>
    </>
  );

  if (externo) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classeBase}>
        {conteudo}
      </a>
    );
  }

  return (
    <Link href={href} className={classeBase}>
      {conteudo}
    </Link>
  );
}
