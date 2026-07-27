import Link from "next/link";
import {
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  User,
  Wallet,
} from "lucide-react";
import AvatarAluno from "@/components/aluno/AvatarAluno";
import QRCodeCard from "@/components/aluno/QRCodeCard";
import { requireFichaAluno, ultimoAcessoEfetivo } from "@/lib/aluno-publico";
import {
  getFrequenciaAlunoPublico,
  getMensalidadesAlunoPublico,
  getTokenQrAlunoPublico,
} from "@/lib/data";
import {
  badgeStatusFinanceiro,
  badgeStatusMatricula,
  calcularStatusFinanceiro,
  cn,
  formatBRL,
  formatDataHora,
  hojeSaoPaulo,
} from "@/lib/utils";

const ROTULO_FINANCEIRO: Record<"em_dia" | "pendente" | "inadimplente", string> = {
  em_dia: "Em dia",
  pendente: "Vence hoje",
  inadimplente: "Mensalidade em atraso",
};

export default async function AlunoHome({
  params,
}: {
  params: { slug: string; token: string };
}) {
  const ficha = await requireFichaAluno(params.slug, params.token);
  const { aluno, academia, treinos } = ficha;

  const [mensalidades, acessos, tokenQrAcesso] = await Promise.all([
    getMensalidadesAlunoPublico(params.token, params.slug),
    getFrequenciaAlunoPublico(params.token, params.slug),
    getTokenQrAlunoPublico(params.token, params.slug),
  ]);

  const primeiroNome = aluno.nome.split(" ")[0];
  const statusFinanceiro = calcularStatusFinanceiro(mensalidades);
  const hoje = hojeSaoPaulo();
  const proximaMensalidade = mensalidades
    .filter((m) => m.status === "pendente")
    .sort((a, b) => (a.data < b.data ? -1 : 1))[0];
  const ultimoAcesso = ultimoAcessoEfetivo(acessos);

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
      </div>
    </div>
  );
}

function AcaoRapida({
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
      className="surface flex flex-col items-start gap-2 rounded-2xl p-4 transition active:scale-[0.98] hover:border-ink-500"
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-volt-300/15 text-volt-300">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-semibold text-white">{label}</span>
    </Link>
  );
}
