import { Clock3, DoorOpen, ShieldAlert, UserCheck } from "lucide-react";
import Breadcrumbs from "@/components/painel/Breadcrumbs";
import CatracaLog from "@/components/painel/CatracaLog";
import HistoricoAcessos from "@/components/painel/HistoricoAcessos";
import StatTile from "@/components/painel/StatTile";
import { requireSecao } from "@/lib/auth";
import {
  getAcessosPaginado,
  getAcessosRecentes,
  getAlunosResumo,
  getMensalidadesPendentes,
  getPlanos,
  getUltimosAcessosPorAluno,
} from "@/lib/data";
import { calcularStatusFinanceiro, dataSaoPaulo, hojeSaoPaulo, horaSaoPaulo } from "@/lib/utils";
import type { OrigemAcesso, StatusFinanceiro, StatusLiberacao } from "@/lib/types";

const TAMANHO_PAGINA = 20;

export default async function RecepcaoPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: {
    pagina?: string;
    de?: string;
    ate?: string;
    resultado?: string;
    origem?: string;
    alunoId?: string;
  };
}) {
  const sessao = await requireSecao(params.slug, "recepcao");

  const pagina = Math.max(1, Number(searchParams.pagina) || 1);
  const resultadoValido: StatusLiberacao[] = ["liberado", "alerta", "negado", "pendente"];
  const origemValida: OrigemAcesso[] = ["Direto", "Gympass", "TotalPass"];
  const resultado = resultadoValido.includes(searchParams.resultado as StatusLiberacao)
    ? (searchParams.resultado as StatusLiberacao)
    : undefined;
  const origem = origemValida.includes(searchParams.origem as OrigemAcesso)
    ? (searchParams.origem as OrigemAcesso)
    : undefined;

  // "Hoje" com folga de 36h para cobrir qualquer fuso sem repetir o teto de
  // 50 linhas que getAcessos(academiaId) aplicava por padrão — numa academia
  // com mais de 50 check-ins no dia, os cards "acessos hoje"/"negados
  // hoje"/"pico de hoje" vinham truncados (Fase 13). O recorte por horário
  // continua sendo feito abaixo, exatamente como antes.
  const desde36h = new Date(Date.now() - 36 * 3600_000).toISOString();

  const [acessos, alunos, planos, mensalidades, ultimosAcessos, historico] =
    await Promise.all([
      getAcessosRecentes(sessao.academia.id, desde36h),
      getAlunosResumo(sessao.academia.id),
      getPlanos(sessao.academia.id),
      getMensalidadesPendentes(sessao.academia.id),
      getUltimosAcessosPorAluno(sessao.academia.id),
      getAcessosPaginado(sessao.academia.id, {
        pagina,
        tamanhoPagina: TAMANHO_PAGINA,
        dataIni: searchParams.de,
        dataFim: searchParams.ate,
        resultado,
        origem,
        alunoId: searchParams.alunoId || undefined,
      }),
    ]);

  // Situação financeira resumida por aluno — mesma regra usada na ficha do
  // aluno (calcularStatusFinanceiro), reaproveitada aqui para o preview de busca.
  const mensalidadesPorAluno: Record<string, { status: string; data: string }[]> = {};
  for (const m of mensalidades) {
    (mensalidadesPorAluno[m.aluno_id] ??= []).push(m);
  }
  const statusFinanceiroMap: Record<string, StatusFinanceiro> = {};
  for (const [alunoId, mens] of Object.entries(mensalidadesPorAluno)) {
    statusFinanceiroMap[alunoId] = calcularStatusFinanceiro(mens);
  }

  // "Hoje" sempre em America/Sao_Paulo — new Date().toDateString() usava o
  // fuso do processo (UTC no servidor): um acesso às 22h39 em SP (01h39 UTC
  // do dia seguinte) contava junto com um acesso às 01h05 em SP do dia
  // seguinte de verdade, porque os dois caem no mesmo dia em UTC.
  const hoje = hojeSaoPaulo();
  const acessosHoje = acessos.filter(
    (a) => dataSaoPaulo(a.data_hora_entrada) === hoje
  );
  // "alerta" é entrada PERMITIDA — conta como liberado e ainda tem contagem própria.
  const alertasHoje = acessosHoje.filter(
    (a) => a.status_liberacao === "alerta"
  ).length;
  const permitidosHoje = acessosHoje.filter(
    (a) => a.status_liberacao === "liberado" || a.status_liberacao === "alerta"
  ).length;
  const negadosHoje = acessosHoje.filter(
    (a) => a.status_liberacao === "negado"
  ).length;
  const ativos = alunos.filter((a) => a.status_matricula === "ativa").length;

  // Horário com mais entradas hoje, calculado a partir de dados reais —
  // hora do dia em SP (mesmo motivo do agrupamento de "hoje" acima).
  const contagemHora = new Map<number, number>();
  for (const a of acessosHoje) {
    const h = horaSaoPaulo(a.data_hora_entrada);
    contagemHora.set(h, (contagemHora.get(h) ?? 0) + 1);
  }
  let horaPico: number | null = null;
  let maxAcessos = 0;
  for (const [h, n] of contagemHora) {
    if (n > maxAcessos) {
      maxAcessos = n;
      horaPico = h;
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs slug={params.slug} items={[{ label: "Recepção / Catraca" }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">Recepção &amp; Catraca</h1>
        <p className="text-sm text-slate-400">
          Monitore entradas em tempo real e libere acessos.
        </p>
      </div>

      {/* "Repasse hoje" (Gympass + TotalPass) foi retirado: o valor vinha de
          constantes fixas no código, não de um contrato ou fonte real de
          repasse. O histórico de acessos, os check-ins e as integrações
          continuam intactos. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={DoorOpen}
          label="Acessos hoje"
          value={String(acessosHoje.length)}
          hint={`${permitidosHoje} permitidos · ${negadosHoje} negados`}
          accent="volt"
        />
        <StatTile
          icon={ShieldAlert}
          label="Com alerta hoje"
          value={String(alertasHoje)}
          hint="entraram devendo"
          accent="amber"
        />
        <StatTile
          icon={UserCheck}
          label="Alunos ativos"
          value={String(ativos)}
          hint={`${alunos.length} no total`}
          accent="slate"
        />
        <StatTile
          icon={Clock3}
          label="Pico de hoje"
          value={horaPico !== null ? `${String(horaPico).padStart(2, "0")}h` : "—"}
          hint={horaPico !== null ? `${maxAcessos} acessos` : "sem acessos hoje"}
          accent="slate"
        />
      </div>

      <CatracaLog
        alunos={alunos}
        planos={planos}
        statusFinanceiroMap={statusFinanceiroMap}
        ultimosAcessos={ultimosAcessos}
        slug={params.slug}
      />

      <HistoricoAcessos
        slug={params.slug}
        papel={sessao.papel}
        acessos={historico.acessos}
        total={historico.total}
        pagina={pagina}
        tamanhoPagina={TAMANHO_PAGINA}
        alunos={alunos}
      />
    </div>
  );
}
