import Link from "next/link";
import {
  BadgeCheck,
  ChevronRight,
  CreditCard,
  FileText,
  Lock,
  MessageSquare,
  MessagesSquare,
  Ruler,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { GraficoProgressoPeso } from "@/components/painel/DashboardCharts";
import AvatarAluno from "@/components/aluno/AvatarAluno";
import FotoPerfilForm from "@/components/aluno/FotoPerfilForm";
import { requireFichaAluno } from "@/lib/aluno-publico";
import { badgeStatusMatricula, cn, formatDataDeInstante } from "@/lib/utils";
import { atualizarFotoAluno } from "./actions";

export default async function PerfilPage({
  params,
}: {
  params: { slug: string; token: string };
}) {
  const ficha = await requireFichaAluno(params.slug, params.token);
  const { aluno, progresso } = ficha;
  const alunoDesde = formatDataDeInstante(aluno.criado_em);

  const dadosPeso = progresso
    .filter((p) => p.peso_kg != null)
    .map((p) => ({
      data: new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      peso: Number(p.peso_kg),
    }));
  const ultimoProgresso = progresso[progresso.length - 1];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-slate-400">Sua conta</p>
        <h1 className="text-2xl font-bold text-white">Perfil</h1>
      </header>

      {/* Header compacto: identidade + foto num só bloco (auditoria de UX) —
          antes eram dois cards separados (avatar centralizado de 96px +
          FotoPerfilForm à parte). A foto é o único dado editável pelo aluno
          sem login. */}
      <div className="surface rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <AvatarAluno nome={aluno.nome} fotoUrl={aluno.foto_perfil_url} size={56} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-white">{aluno.nome}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={cn(
                  "chip",
                  badgeStatusMatricula(aluno.status_matricula)
                )}
              >
                <BadgeCheck className="h-3.5 w-3.5" />
                Matrícula {aluno.status_matricula}
              </span>
              <span className="text-xs text-slate-500">desde {alunoDesde}</span>
            </div>
          </div>
        </div>
        <div className="mt-4 border-t border-ink-600/60 pt-4">
          <FotoPerfilForm
            nome={aluno.nome}
            fotoAtual={aluno.foto_perfil_url}
            atualizar={atualizarFotoAluno.bind(null, params.slug, params.token)}
          />
        </div>
      </div>

      {/* Evolução — sobe para o topo do conteúdo (auditoria de UX): é o que o
          aluno quer ver, não pode ser o último de seis cards empilhados. */}
      {progresso.length > 0 && (
        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2 text-slate-300">
            <Ruler className="h-4 w-4 text-volt-300" />
            <span className="text-sm font-medium">Sua evolução</span>
          </div>

          {dadosPeso.length >= 2 && (
            <div className="mt-3">
              <GraficoProgressoPeso dados={dadosPeso} />
            </div>
          )}

          {ultimoProgresso && (
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {ultimoProgresso.peso_kg != null && (
                <Medida label="Peso" valor={`${ultimoProgresso.peso_kg} kg`} />
              )}
              {ultimoProgresso.percentual_gordura != null && (
                <Medida
                  label="% Gordura"
                  valor={`${ultimoProgresso.percentual_gordura}%`}
                />
              )}
              {ultimoProgresso.peito_cm != null && (
                <Medida label="Peito" valor={`${ultimoProgresso.peito_cm} cm`} />
              )}
              {ultimoProgresso.cintura_cm != null && (
                <Medida label="Cintura" valor={`${ultimoProgresso.cintura_cm} cm`} />
              )}
              {ultimoProgresso.braco_cm != null && (
                <Medida label="Braço" valor={`${ultimoProgresso.braco_cm} cm`} />
              )}
              {ultimoProgresso.coxa_cm != null && (
                <Medida label="Coxa" valor={`${ultimoProgresso.coxa_cm} cm`} />
              )}
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Última medição em{" "}
            {ultimoProgresso &&
              new Date(ultimoProgresso.data + "T00:00:00").toLocaleDateString(
                "pt-BR"
              )}
          </p>
        </div>
      )}

      {/* Plano */}
      {aluno.plano_nome && (
        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2 text-slate-300">
            <CreditCard className="h-4 w-4 text-volt-300" />
            <span className="text-sm font-medium">Plano atual</span>
          </div>
          <p className="mt-2 text-lg font-bold text-white">{aluno.plano_nome}</p>
        </div>
      )}

      {/* Identificação */}
      <div className="surface space-y-3 rounded-2xl p-5">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <ShieldCheck className="h-4 w-4 text-slate-500" />
          Matrícula {aluno.matricula_codigo ?? "—"}
        </div>
      </div>

      {/* Mais — itens secundários (rotas preservadas, só saíram da barra
          inferior fixa no Bloco 2) e documentos legais do piloto. */}
      <div className="surface divide-y divide-ink-600/60 overflow-hidden rounded-2xl">
        <LinkSecundario href={`/aluno/${params.slug}/${params.token}/loja`} icon={ShoppingBag} label="Loja" />
        <LinkSecundario
          href={`/aluno/${params.slug}/${params.token}/atendimento`}
          icon={MessagesSquare}
          label="Fale com a academia"
        />
        <LinkSecundario
          href={`/aluno/${params.slug}/${params.token}/feedback`}
          icon={MessageSquare}
          label="Deixar feedback"
        />
        <LinkSecundario href="/termos" icon={FileText} label="Termos de Uso" />
        <LinkSecundario href="/privacidade" icon={Lock} label="Política de Privacidade" />
      </div>

      <p className="px-1 text-center text-xs text-slate-500">
        Nome, contato, plano, matrícula e vencimento são controlados pela
        academia. Para atualizar esses dados, fale com a recepção.
      </p>
    </div>
  );
}

function LinkSecundario({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof ShoppingBag;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 p-4 transition hover:bg-ink-700/40"
    >
      <span className="flex items-center gap-3 text-sm text-white">
        <Icon className="h-4 w-4 text-slate-400" />
        {label}
      </span>
      <ChevronRight className="h-4 w-4 text-slate-500" />
    </Link>
  );
}

function Medida({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl bg-ink-700/60 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold text-white">{valor}</p>
    </div>
  );
}
