"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  FilterX,
  HeartPulse,
  Loader2,
  Pencil,
  QrCode,
  Search,
  Target,
  UserPlus,
  UserRound,
  Video,
  Wallet,
  X,
} from "lucide-react";
import {
  Aluno,
  CatalogoExercicio,
  FORMAS_PAGAMENTO,
  HistoricoPlano,
  Papel,
  Plano,
  ProgressoAluno as TipoProgresso,
  StatusFinanceiro,
  StatusMatricula,
  Treino,
} from "@/lib/types";
import {
  badgeStatusFinanceiro,
  badgeStatusMatricula,
  cn,
  hojeSaoPaulo,
} from "@/lib/utils";
import { origemPublica } from "@/lib/site-url";
import FormActions from "@/components/ui/FormActions";
import ConfirmButton from "@/components/ui/ConfirmButton";
import ExercicioBuilder, {
  type LinhaExercicio,
} from "@/components/painel/ExercicioBuilder";
import ProgressoAluno from "@/components/painel/ProgressoAluno";
import HistoricoPlanoAluno from "@/components/painel/HistoricoPlanoAluno";
import AcessoAlunoCard from "@/components/painel/AcessoAlunoCard";
import FotoAlunoAdminCard from "@/components/painel/FotoAlunoAdminCard";
import {
  atualizarAluno,
  atualizarTreino,
  criarAluno,
  criarTreino,
  excluirAluno,
  excluirTreino,
} from "@/app/painel/[slug]/alunos/actions";
import { cancelarCobranca, marcarPago } from "@/app/painel/[slug]/financeiro/actions";
import type { MensalidadeDetalhe } from "@/lib/data";
import {
  rotuloDiaVencimento,
  DIA_VENCIMENTO_MIN,
  DIA_VENCIMENTO_MAX,
} from "@/lib/vencimento";

const STATUS_OPCOES: { value: StatusMatricula; label: string }[] = [
  { value: "ativa", label: "Ativa" },
  { value: "pendente", label: "Pendente" },
  { value: "trancada", label: "Trancada" },
  { value: "inativa", label: "Inativa" },
  { value: "cancelada", label: "Cancelada" },
];

export default function GestaoAlunos({
  slug,
  alunosIniciais,
  totalAlunos,
  pagina,
  tamanhoPagina,
  buscaInicial = "",
  statusInicial = "",
  planoIdInicial = "",
  treinosIniciais,
  planos,
  catalogo,
  progresso,
  historico,
  statusFinanceiroMap = {},
  mensalidadesPorAluno = {},
  papel,
  academiaNome,
  isDemo = false,
}: {
  slug: string;
  alunosIniciais: Aluno[];
  totalAlunos: number;
  pagina: number;
  tamanhoPagina: number;
  buscaInicial?: string;
  statusInicial?: string;
  planoIdInicial?: string;
  treinosIniciais: Treino[];
  planos: Plano[];
  catalogo: CatalogoExercicio[];
  progresso: TipoProgresso[];
  historico: HistoricoPlano[];
  statusFinanceiroMap?: Record<string, StatusFinanceiro>;
  mensalidadesPorAluno?: Record<string, MensalidadeDetalhe[]>;
  papel: Papel;
  academiaNome: string;
  isDemo?: boolean;
}) {
  const alunos = alunosIniciais;
  const treinos = treinosIniciais;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingFiltro, startFiltro] = useTransition();

  const [selecionadoId, setSelecionadoId] = useState<string | null>(
    alunosIniciais[0]?.id ?? null
  );
  const [mostrarNovoAluno, setMostrarNovoAluno] = useState(totalAlunos === 0);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  // Id do aluno cadastrado agora, só para destacar o envio do acesso logo
  // depois do cadastro. Comparado com a seleção atual, então trocar de aluno
  // já desfaz o destaque sem precisar limpar nada.
  const [recemCadastradoId, setRecemCadastradoId] = useState<string | null>(null);
  const financialRef = useRef<HTMLDivElement>(null);

  // NÃO existe fallback de seleção aqui — de propósito.
  //
  // A versão anterior fazia `setSelecionadoId(alunosIniciais[0]?.id)` sempre que
  // o aluno selecionado não estava na lista. Isso causava o bug do QR do aluno
  // errado: ao cadastrar um aluno, `setSelecionadoId(novoId)` acontece antes do
  // `router.refresh()` chegar, então por um instante o novo id não está na
  // lista — e a seleção pulava para `alunosIniciais[0]`, que é o aluno mais
  // recente ANTERIOR (ordem criado_em DESC), tipicamente o último que o usuário
  // tinha aberto. Pior: como esse id É válido, o efeito nunca mais corrigia, e
  // o painel ficava preso no aluno errado exibindo o QR dele.
  //
  // Agora, se o aluno selecionado não está na lista, a ficha simplesmente não
  // renderiza (ver `alunoSelecionado` abaixo) até o refresh trazê-lo. Nunca se
  // troca a seleção por outro aluno.

  // ---- Busca e filtros no servidor (Fase 13) ----
  const [busca, setBusca] = useState(buscaInicial);
  const primeiraBuscaRef = useRef(true);

  const aplicarFiltro = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(searchParams.toString());
    for (const [chave, valor] of Object.entries(patch)) {
      if (valor) p.set(chave, valor);
      else p.delete(chave);
    }
    if (!("pagina" in patch)) p.delete("pagina");
    startFiltro(() => router.push(`${pathname}?${p.toString()}`));
  };

  // Debounce: só busca 400ms depois que o usuário parar de digitar.
  useEffect(() => {
    if (primeiraBuscaRef.current) {
      primeiraBuscaRef.current = false;
      return;
    }
    const t = setTimeout(() => aplicarFiltro({ q: busca.trim() || null }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const filtrosAtivos = !!buscaInicial || !!statusInicial || !!planoIdInicial;
  const limparFiltros = () => {
    setBusca("");
    aplicarFiltro({ q: null, status: null, planoId: null });
  };

  const totalPaginas = Math.max(1, Math.ceil(totalAlunos / tamanhoPagina));

  const treinosDoAluno = treinos.filter((t) => t.aluno_id === selecionadoId);
  const alunoSelecionado = alunos.find((a) => a.id === selecionadoId) ?? null;

  function selecionarEScrollFinanceiro(alunoId: string) {
    setSelecionadoId(alunoId);
    setTimeout(() => financialRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  // Pré-computa total em aberto por aluno para exibir na lista.
  const totaisAberto: Record<string, number> = {};
  for (const [id, mens] of Object.entries(mensalidadesPorAluno)) {
    totaisAberto[id] = mens
      .filter((m) => m.status === "pendente")
      .reduce((s, m) => s + Number(m.valor), 0);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
      {/* Coluna esquerda: cadastro + lista de alunos */}
      <div className="space-y-6">
        {mostrarNovoAluno ? (
          <FormularioAluno
            slug={slug}
            planos={planos}
            onCancelar={totalAlunos > 0 ? () => setMostrarNovoAluno(false) : undefined}
            onSalvo={(id) => {
              setMostrarNovoAluno(false);
              // Sem id não se seleciona nada: manter o aluno anterior
              // selecionado aqui é exatamente como o QR errado era entregue.
              if (!id) {
                setSelecionadoId(null);
                setRecemCadastradoId(null);
                return;
              }
              setSelecionadoId(id);
              setRecemCadastradoId(id);
              // O recém-cadastrado é o mais recente (ordem criado_em DESC),
              // logo está na primeira página SEM filtros. Com filtro ou página
              // ativos ele poderia não aparecer na lista — e a ficha ficaria
              // sem renderizar. Limpa para garantir que ele fique visível.
              if (filtrosAtivos || pagina > 1) {
                setBusca("");
                aplicarFiltro({ q: null, status: null, planoId: null, pagina: null });
              }
            }}
          />
        ) : (
          <button
            onClick={() => setMostrarNovoAluno(true)}
            className="btn-volt w-full"
          >
            <UserPlus className="h-4 w-4" /> Cadastrar aluno
          </button>
        )}

        <div className="surface rounded-2xl">
          <div className="border-b border-ink-700 px-5 py-3">
            <h2 className="font-semibold text-white">
              Alunos{" "}
              <span className="text-sm font-normal text-slate-500">
                ({totalAlunos})
              </span>
            </h2>
          </div>

          <div
            className={cn(
              "flex flex-wrap items-end gap-3 border-b border-ink-700 px-5 py-3 transition-opacity",
              pendingFiltro && "pointer-events-none opacity-60"
            )}
            aria-busy={pendingFiltro}
          >
            {/* `min-w-0` obrigatório: sem ele o <select> de planos não encolhe
                abaixo da largura do nome de plano mais longo (min-width: auto
                de item flex) e empurra a linha além da tela no celular. */}
            <label className="min-w-0 flex-1 basis-[10rem]">
              <span className="mb-1 block text-[11px] font-medium text-slate-400">
                Buscar
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome, matrícula ou telefone"
                  className="inp !py-1.5 pl-9 text-xs"
                  autoComplete="off"
                />
              </div>
            </label>
            <label className="min-w-0 flex-1 basis-[7rem]">
              <span className="mb-1 block text-[11px] font-medium text-slate-400">
                Status
              </span>
              <select
                defaultValue={statusInicial}
                onChange={(e) => aplicarFiltro({ status: e.target.value || null })}
                className="inp !py-1.5 text-xs"
              >
                <option value="">Todos</option>
                {STATUS_OPCOES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 flex-1 basis-[7rem]">
              <span className="mb-1 block text-[11px] font-medium text-slate-400">
                Plano
              </span>
              <select
                defaultValue={planoIdInicial}
                onChange={(e) => aplicarFiltro({ planoId: e.target.value || null })}
                className="inp !py-1.5 text-xs"
              >
                <option value="">Todos</option>
                {planos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            {filtrosAtivos && (
              <button
                type="button"
                onClick={limparFiltros}
                className="btn-ghost !py-1.5 text-xs"
              >
                <FilterX className="h-3.5 w-3.5" /> Limpar
              </button>
            )}
          </div>

          {alunos.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">
              {filtrosAtivos
                ? "Nenhum aluno encontrado para os filtros selecionados."
                : "Nenhum aluno cadastrado ainda."}
            </p>
          ) : (
            <ul className="max-h-[560px] divide-y divide-ink-700/70 overflow-auto">
              {alunos.map((a) =>
                editandoId === a.id ? (
                  <li key={a.id} className="p-4">
                    <FormularioAluno
                      slug={slug}
                      planos={planos}
                      alunoExistente={a}
                      onCancelar={() => setEditandoId(null)}
                      onSalvo={(id) => {
                        setEditandoId(null);
                        // Seleciona o aluno recém-editado para que o alerta de
                        // condições médicas (e a ficha) reflita o que foi salvo.
                        if (id) setSelecionadoId(id);
                      }}
                    />
                  </li>
                ) : (
                  <LinhaAluno
                    key={a.id}
                    slug={slug}
                    aluno={a}
                    ativo={selecionadoId === a.id}
                    statusFinanceiro={statusFinanceiroMap[a.id]}
                    totalAberto={totaisAberto[a.id] ?? 0}
                    onSelecionar={() => setSelecionadoId(a.id)}
                    onVerFinanceiro={() => selecionarEScrollFinanceiro(a.id)}
                    onEditar={() => setEditandoId(a.id)}
                  />
                )
              )}
            </ul>
          )}

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-ink-700 px-5 py-3">
              <span className="text-xs text-slate-500">
                Página {pagina} de {totalPaginas}
              </span>
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => aplicarFiltro({ pagina: String(pagina - 1) })}
                  disabled={pagina <= 1}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-ink-600 text-slate-300 transition hover:bg-ink-700 disabled:pointer-events-none disabled:opacity-40"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => aplicarFiltro({ pagina: String(pagina + 1) })}
                  disabled={pagina >= totalPaginas}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-ink-600 text-slate-300 transition hover:bg-ink-700 disabled:pointer-events-none disabled:opacity-40"
                  aria-label="Próxima página"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Coluna direita: montagem da ficha de treino */}
      <div className="space-y-6">
        {selecionadoId && !alunoSelecionado && (
          <div className="surface flex items-start gap-3 rounded-2xl p-4">
            <Loader2 className="mt-0.5 h-4 w-4 flex-none animate-spin text-slate-500" />
            <p className="text-sm text-slate-400">
              Carregando a ficha do aluno… Se ela não aparecer, o aluno não está
              na página ou nos filtros atuais —{" "}
              <button
                type="button"
                onClick={limparFiltros}
                className="text-volt-300 underline underline-offset-2"
              >
                limpar filtros
              </button>
              . Nenhuma ficha de outro aluno é exibida no lugar.
            </p>
          </div>
        )}

        {alunoSelecionado && (
          <>
            <FotoAlunoAdminCard
              slug={slug}
              alunoId={alunoSelecionado.id}
              nome={alunoSelecionado.nome}
              fotoUrl={alunoSelecionado.foto_perfil_url}
            />
            <AcessoAlunoCard
              key={alunoSelecionado.id}
              slug={slug}
              alunoId={alunoSelecionado.id}
              nome={alunoSelecionado.nome}
              telefone={alunoSelecionado.telefone}
              academiaNome={academiaNome}
              tokenAcessoPublico={alunoSelecionado.token_acesso_publico}
              isDono={papel === "dono"}
              isDemo={isDemo}
              recemCadastrado={alunoSelecionado.id === recemCadastradoId}
            />
          </>
        )}

        {alunoSelecionado?.condicoes_medicas && (
          <div className="surface flex items-start gap-3 rounded-2xl border-magenta-500/30 p-4">
            <HeartPulse className="mt-0.5 h-4 w-4 flex-none text-magenta-400" />
            <div>
              <p className="text-sm font-semibold text-magenta-300">
                Atenção — condições médicas
              </p>
              <p className="mt-0.5 whitespace-pre-line text-sm text-slate-300">
                {alunoSelecionado.condicoes_medicas}
              </p>
            </div>
          </div>
        )}

        <div className="surface rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-white">
              <Dumbbell className="h-4 w-4 text-volt-300" /> Montar ficha de treino
            </h2>
            {alunoSelecionado && (
              <span className="text-sm text-slate-400">
                para{" "}
                <span className="font-medium text-white">
                  {alunoSelecionado.nome}
                </span>
              </span>
            )}
          </div>

          {!alunoSelecionado ? (
            <p className="mt-4 text-sm text-slate-500">
              Selecione um aluno para montar a ficha.
            </p>
          ) : (
            <FormularioTreino
              key={alunoSelecionado.id}
              slug={slug}
              alunoId={alunoSelecionado.id}
              proximaOrdem={treinosDoAluno.length + 1}
              catalogo={catalogo}
            />
          )}
        </div>

        {/* Fichas já montadas */}
        {alunoSelecionado && (
          <div className="surface rounded-2xl p-5">
            <h3 className="font-semibold text-white">
              Fichas de {alunoSelecionado.nome.split(" ")[0]}
            </h3>
            {treinosDoAluno.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Nenhuma ficha montada ainda.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {treinosDoAluno.map((t) => (
                  <CardFichaTreino
                    key={t.id}
                    slug={slug}
                    treino={t}
                    catalogo={catalogo}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Plano & renovação */}
        {alunoSelecionado && (
          <HistoricoPlanoAluno
            slug={slug}
            alunoId={alunoSelecionado.id}
            registros={historico.filter((h) => h.aluno_id === alunoSelecionado.id)}
          />
        )}

        {/* Progresso (peso, medidas, fotos) */}
        {alunoSelecionado && (
          <ProgressoAluno
            slug={slug}
            alunoId={alunoSelecionado.id}
            alunoNome={alunoSelecionado.nome}
            registros={progresso.filter((p) => p.aluno_id === alunoSelecionado.id)}
          />
        )}

        {/* Situação financeira */}
        {alunoSelecionado && (
          <SituacaoFinanceira
            sectionRef={financialRef}
            slug={slug}
            aluno={alunoSelecionado}
            plano={planos.find((p) => p.id === alunoSelecionado.plano_id)}
            mensalidades={mensalidadesPorAluno[alunoSelecionado.id] ?? []}
            statusFinanceiro={statusFinanceiroMap[alunoSelecionado.id]}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linha da lista de alunos (com link para o app do aluno, editar e excluir)
// ---------------------------------------------------------------------------
function LinhaAluno({
  slug,
  aluno,
  ativo,
  statusFinanceiro,
  totalAberto,
  onSelecionar,
  onVerFinanceiro,
  onEditar,
}: {
  slug: string;
  aluno: Aluno;
  ativo: boolean;
  statusFinanceiro?: StatusFinanceiro;
  totalAberto: number;
  onSelecionar: () => void;
  onVerFinanceiro: () => void;
  onEditar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  const copiarLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = `${origemPublica()}/aluno/${slug}/${aluno.token_acesso_publico}`;
    await navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  };

  return (
    <li>
      <div
        onClick={onSelecionar}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onSelecionar()}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition",
          ativo ? "bg-volt-500/10" : "hover:bg-ink-700/40"
        )}
      >
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-ink-600">
          {aluno.foto_perfil_url ? (
            <Image
              src={aluno.foto_perfil_url}
              alt={aluno.nome}
              fill
              sizes="40px"
              className="media-native object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center bg-ink-700 text-slate-500">
              <UserRound className="h-4 w-4" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-white">
            <span className="truncate">{aluno.nome}</span>
            {aluno.condicoes_medicas && (
              <span
                title={`Condições médicas: ${aluno.condicoes_medicas}`}
                aria-label="Aluno com condições médicas registradas"
                className="inline-flex flex-none items-center gap-0.5 rounded-full border border-magenta-500/40 bg-magenta-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-magenta-300"
              >
                <HeartPulse className="h-3 w-3" />
                Saúde
              </span>
            )}
          </p>
          <p className="truncate text-xs text-slate-500">
            {aluno.matricula_codigo}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={cn(
              "chip text-[10px]",
              badgeStatusMatricula(aluno.status_matricula)
            )}
          >
            {aluno.status_matricula}
          </span>
          {statusFinanceiro && statusFinanceiro !== "em_dia" && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onVerFinanceiro(); }}
              title="Ver situação financeira"
              className={cn(
                "chip text-[10px] cursor-pointer hover:opacity-80 transition-opacity",
                badgeStatusFinanceiro(statusFinanceiro)
              )}
            >
              {statusFinanceiro === "inadimplente" ? "inadimplente" : "vence hoje"}
            </button>
          )}
          {totalAberto > 0 && (
            <span className="text-[10px] text-red-400 tabular-nums">
              {totalAberto.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 })} em aberto
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={copiarLink}
          title="Copiar link do app do aluno"
          className="grid h-8 w-8 flex-none place-items-center rounded-lg text-slate-500 transition hover:bg-ink-700 hover:text-volt-300"
        >
          {copiado ? (
            <Check className="h-4 w-4 text-volt-300" />
          ) : (
            <QrCode className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditar();
          }}
          title="Editar aluno"
          className="grid h-8 w-8 flex-none place-items-center rounded-lg text-slate-500 transition hover:bg-ink-700 hover:text-white"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <span onClick={(e) => e.stopPropagation()}>
          <ConfirmButton
            action={() => excluirAluno(slug, aluno.id)}
            confirmText={`Excluir o aluno "${aluno.nome}"? Treinos e histórico serão removidos.`}
            label="Excluir aluno"
          />
        </span>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Seção de situação financeira do aluno selecionado
// ---------------------------------------------------------------------------
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function formatComp(comp: string | null): string {
  if (!comp) return "—";
  const [y, m] = comp.split("-");
  return `${MESES[parseInt(m) - 1]}/${y.slice(2)}`;
}

function BotaoPago({ slug, receitaId }: { slug: string; receitaId: string }) {
  const [expandido, setExpandido] = useState(false);
  const [forma, setForma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!expandido) {
    return (
      <button
        onClick={() => setExpandido(true)}
        className="rounded-md bg-volt-500/15 px-2 py-1 text-[10px] font-medium text-volt-300 transition hover:bg-volt-500/25"
      >
        Marcar pago
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <select
          value={forma}
          onChange={(e) => setForma(e.target.value)}
          className="h-6 rounded border border-ink-600 bg-ink-900 px-1 text-[10px] text-slate-200 focus:outline-none"
          autoFocus
        >
          <option value="">Forma…</option>
          {FORMAS_PAGAMENTO.map((f) => (
            <option key={f.value} value={f.label}>
              {f.label}
            </option>
          ))}
        </select>
        <button
          disabled={!forma || pending}
          onClick={() =>
            start(async () => {
              setErro(null);
              const resultado = await marcarPago(slug, receitaId, forma);
              if (resultado.erro) {
                setErro(resultado.erro);
                return;
              }
              setExpandido(false);
              setForma("");
            })
          }
          title="Confirmar pagamento"
          className="grid h-6 w-6 place-items-center rounded bg-volt-500/15 text-volt-300 transition hover:bg-volt-500/25 disabled:opacity-40"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </button>
        <button
          onClick={() => { setExpandido(false); setForma(""); setErro(null); }}
          title="Fechar"
          className="grid h-6 w-6 place-items-center rounded text-slate-500 transition hover:text-slate-300"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {erro && <p className="text-[10px] text-red-400">{erro}</p>}
    </div>
  );
}

function BotaoCancelar({ slug, receitaId }: { slug: string; receitaId: string }) {
  const [expandido, setExpandido] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pending, start] = useTransition();

  if (!expandido) {
    return (
      <button
        onClick={() => setExpandido(true)}
        className="rounded-md px-2 py-1 text-[10px] font-medium text-slate-500 transition hover:bg-ink-700 hover:text-slate-300"
      >
        Cancelar
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        placeholder="Motivo…"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        className="h-6 w-28 rounded border border-ink-600 bg-ink-900 px-1.5 text-[10px] text-slate-200 placeholder-slate-600 focus:outline-none"
        autoFocus
      />
      <button
        disabled={!motivo.trim() || pending}
        onClick={() =>
          start(async () => {
            await cancelarCobranca(slug, receitaId, motivo.trim());
            setExpandido(false);
            setMotivo("");
          })
        }
        title="Confirmar cancelamento"
        className="grid h-6 w-6 place-items-center rounded bg-red-500/15 text-red-400 transition hover:bg-red-500/25 disabled:opacity-40"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
      </button>
      <button
        onClick={() => { setExpandido(false); setMotivo(""); }}
        title="Cancelar"
        className="grid h-6 w-6 place-items-center rounded text-slate-500 transition hover:text-slate-300"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function SituacaoFinanceira({
  sectionRef,
  slug,
  aluno,
  plano,
  mensalidades,
  statusFinanceiro,
}: {
  sectionRef: React.RefObject<HTMLDivElement>;
  slug: string;
  aluno: Aluno;
  plano: Plano | undefined;
  mensalidades: MensalidadeDetalhe[];
  statusFinanceiro: StatusFinanceiro | undefined;
}) {
  // Mesma referência de data da regra financeira e da decisão de acesso.
  const hoje = hojeSaoPaulo();
  const pendentes = mensalidades.filter((m) => m.status === "pendente");
  const totalAberto = pendentes.reduce((s, m) => s + Number(m.valor), 0);
  const vencMaisAntigo = pendentes.length
    ? pendentes.reduce((min, m) => (m.data < min ? m.data : min), pendentes[0].data)
    : null;
  const diasAtraso = vencMaisAntigo && vencMaisAntigo < hoje
    ? Math.floor((Date.now() - new Date(vencMaisAntigo + "T00:00:00").getTime()) / 86_400_000)
    : 0;

  const sorted = [...mensalidades].sort((a, b) => {
    if (a.status !== b.status) return a.status === "pendente" ? -1 : 1;
    return b.data.localeCompare(a.data);
  });

  return (
    <div ref={sectionRef} className="surface rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <Wallet className="h-4 w-4 text-volt-300" /> Situação financeira
        </h3>
        <a
          href={`/painel/${slug}/financeiro/receitas?aluno=${aluno.id}`}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          Ir para Financeiro <ArrowRight className="h-3 w-3" />
        </a>
      </div>

      {/* Resumo do plano */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="label-muted">Plano</p>
          <p className="mt-0.5 text-sm font-medium text-white truncate">
            {plano?.nome ?? <span className="text-slate-500">Sem plano</span>}
          </p>
        </div>
        <div>
          <p className="label-muted">Mensalidade</p>
          <p className="mt-0.5 text-sm font-medium text-white">
            {plano ? plano.valor_mensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
          </p>
        </div>
        <div>
          <p className="label-muted">Vencimento</p>
          <p className="mt-0.5 text-sm font-medium text-white">
            {rotuloDiaVencimento(aluno.dia_vencimento)}
          </p>
        </div>
        <div>
          <p className="label-muted">Situação</p>
          <p className="mt-0.5">
            {statusFinanceiro ? (
              <span className={cn("chip text-[10px]", badgeStatusFinanceiro(statusFinanceiro))}>
                {statusFinanceiro === "em_dia" ? "Em dia" : statusFinanceiro === "inadimplente" ? "Inadimplente" : "Vence hoje"}
              </span>
            ) : (
              <span className="text-sm text-slate-500">—</span>
            )}
          </p>
        </div>
      </div>

      {/* Alertas de inadimplência */}
      {pendentes.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm">
          <span className="flex items-center gap-1.5 font-medium text-red-300">
            <AlertCircle className="h-4 w-4 flex-none" />
            {pendentes.length} em aberto
          </span>
          <span className="text-red-200 tabular-nums">
            Total: {totalAberto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
          {vencMaisAntigo && (
            <span className="text-red-300/80 text-xs">
              Mais antigo: {new Date(vencMaisAntigo + "T00:00:00").toLocaleDateString("pt-BR")}
              {diasAtraso > 0 && ` · ${diasAtraso} dias de atraso`}
            </span>
          )}
        </div>
      )}

      {/* Lista de mensalidades */}
      {mensalidades.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma mensalidade registrada.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="pb-2 pr-4 font-medium">Competência</th>
                <th className="pb-2 pr-4 font-medium">Vencimento</th>
                <th className="pb-2 pr-4 font-medium">Valor</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/50">
              {sorted.map((m) => {
                const cancelada = m.status === "cancelada";
                return (
                  <tr key={m.id} className={cn("group", cancelada && "opacity-50")}>
                    <td className={cn("py-2 pr-4", cancelada ? "text-slate-600 line-through" : "text-slate-300")}>
                      {formatComp(m.competencia)}
                    </td>
                    <td className={cn("py-2 pr-4", cancelada ? "text-slate-600 line-through" : "text-slate-300")}>
                      {new Date(m.data + "T00:00:00").toLocaleDateString("pt-BR")}
                      {m.data_pagamento && (
                        <span className="block text-[10px] text-volt-300/70">
                          Pago {new Date(m.data_pagamento + "T00:00:00").toLocaleDateString("pt-BR")}
                          {m.forma_pagamento && ` · ${m.forma_pagamento}`}
                        </span>
                      )}
                    </td>
                    <td className={cn("py-2 pr-4 tabular-nums", cancelada ? "text-slate-600 line-through" : "font-medium text-white")}>
                      {Number(m.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={cn(
                        "chip text-[10px]",
                        m.status === "pago"
                          ? "bg-volt-500/15 text-volt-300 border-volt-500/30"
                          : m.status === "cancelada"
                          ? "bg-slate-500/15 text-slate-500 border-slate-500/30"
                          : m.data < hoje
                          ? "bg-red-500/15 text-red-400 border-red-500/30"
                          : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                      )}>
                        {m.status === "pago" ? "pago"
                          : m.status === "cancelada" ? "cancelada"
                          : m.data < hoje ? "vencida"
                          : "a vencer"}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {m.status === "pendente" && (
                        <div className="flex items-center justify-end gap-1">
                          <BotaoPago slug={slug} receitaId={m.id} />
                          <BotaoCancelar slug={slug} receitaId={m.id} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formulário de cadastro/edição de aluno
// ---------------------------------------------------------------------------
function FormularioAluno({
  slug,
  planos,
  alunoExistente,
  onCancelar,
  onSalvo,
}: {
  slug: string;
  planos: Plano[];
  alunoExistente?: Aluno;
  onCancelar?: () => void;
  onSalvo: (id: string) => void;
}) {
  const router = useRouter();
  const acao = alunoExistente
    ? atualizarAluno.bind(null, slug, alunoExistente.id)
    : criarAluno.bind(null, slug);
  const [estado, formAction] = useFormState(acao, {});
  // Uma chave por abertura do formulário de cadastro — evita duplo
  // clique/reenvio criar dois alunos quando não há CPF (edição não precisa:
  // é sempre a mesma linha, por id).
  const [chaveIdempotencia] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  // Controle do plano selecionado (para exibir info de ciclo e pagamento).
  const [planoSelecionadoId, setPlanoSelecionadoId] = useState(
    alunoExistente?.plano_id ?? ""
  );
  const planoSelecionado = planos.find((p) => p.id === planoSelecionadoId) ?? null;
  const exibirPagamento =
    !alunoExistente &&
    !!planoSelecionado &&
    planoSelecionado.cobranca_recorrente &&
    planoSelecionado.valor_mensal > 0;

  const [pagamentoInicial, setPagamentoInicial] = useState<"a_pagar" | "pago_agora">("a_pagar");
  const [diaVencimento, setDiaVencimento] = useState(
    alunoExistente?.dia_vencimento ?? new Date().getDate()
  );
  const hoje = hojeSaoPaulo();
  const [dataPagamento, setDataPagamento] = useState(hoje);

  useEffect(() => {
    if (estado.ok) {
      router.refresh();
      onSalvo(estado.id ?? alunoExistente?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  // Próxima renovação (exibição — cálculo aproximado no cliente).
  function proximaRenovacao(meses: number): string {
    const d = new Date();
    d.setMonth(d.getMonth() + meses, 1);
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }

  return (
    <form action={formAction} className="surface rounded-2xl p-5">
      <h2 className="flex items-center gap-2 font-semibold text-white">
        <UserPlus className="h-4 w-4 text-volt-300" />
        {alunoExistente ? "Editar aluno" : "Cadastrar aluno"}
      </h2>

      {!alunoExistente && (
        <input type="hidden" name="chave_idempotencia" value={chaveIdempotencia} />
      )}

      {estado.erro && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}

      <div className="mt-4 space-y-3">
        <Field label="Nome completo">
          <input
            name="nome"
            defaultValue={alunoExistente?.nome}
            placeholder="Ex: João da Silva"
            className="inp"
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="CPF">
            <input
              name="cpf"
              defaultValue={alunoExistente?.cpf ?? ""}
              placeholder="000.000.000-00"
              className="inp"
            />
          </Field>
          <Field label="Status">
            <select
              name="status"
              defaultValue={alunoExistente?.status_matricula ?? "ativa"}
              className="inp"
            >
              <option value="ativa">Ativa</option>
              <option value="pendente">Pendente</option>
              <option value="trancada">Trancada</option>
              <option value="inativa">Inativa</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="E-mail">
            <input
              name="email"
              type="email"
              defaultValue={alunoExistente?.email ?? ""}
              placeholder="aluno@email.com"
              className="inp"
            />
          </Field>
          <Field label="Telefone">
            <input
              name="telefone"
              defaultValue={alunoExistente?.telefone ?? ""}
              placeholder="(11) 90000-0000"
              className="inp"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Plano">
            <select
              name="plano_id"
              value={planoSelecionadoId}
              onChange={(e) => {
                setPlanoSelecionadoId(e.target.value);
                setPagamentoInicial("a_pagar");
              }}
              className="inp"
            >
              <option value="">Nenhum</option>
              {planos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dia de vencimento">
            <input
              name="dia_vencimento"
              type="number"
              min={DIA_VENCIMENTO_MIN}
              max={DIA_VENCIMENTO_MAX}
              value={diaVencimento}
              onChange={(e) =>
                setDiaVencimento(
                  Math.min(
                    DIA_VENCIMENTO_MAX,
                    Math.max(DIA_VENCIMENTO_MIN, parseInt(e.target.value) || DIA_VENCIMENTO_MIN)
                  )
                )
              }
              className="inp"
            />
            {/* Duas mensagens, nunca as duas ao mesmo tempo:
                - a fixa ensina que existe a opção de "último dia do mês", que
                  ninguém descobre sozinho olhando um campo numérico;
                - a de aviso só aparece depois de escolher 29, 30 ou 31, e
                  responde na hora a dúvida de "e fevereiro?" — a mesma que o
                  dono levantou quando pediu o dia 31. */}
            {diaVencimento > 28 ? (
              <p className="mt-1 text-xs text-amber-300/80">
                Nos meses que não têm dia {diaVencimento}, a cobrança cai no último
                dia do mês — em fevereiro, dia 28 (29 em ano bissexto).
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">
                De 1 a 31. Use 31 para cobrar sempre no último dia do mês.
              </p>
            )}
          </Field>
        </div>

        {/* Painel de ciclo e pagamento inicial — somente ao cadastrar com plano recorrente */}
        {exibirPagamento && planoSelecionado && (
          <div className="rounded-xl border border-ink-600 bg-ink-800/60 p-4 space-y-4">
            {/* Info do ciclo */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
              <div>
                <p className="label-muted">Valor do plano</p>
                <p className="mt-0.5 font-semibold text-white">
                  {planoSelecionado.valor_mensal.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
              </div>
              <div>
                <p className="label-muted">Dia de vencimento</p>
                <p className="mt-0.5 font-semibold text-white">Dia {diaVencimento}</p>
              </div>
              <div>
                <p className="label-muted">Início do ciclo</p>
                <p className="mt-0.5 font-semibold text-white">
                  {new Date().toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div>
                <p className="label-muted">Próxima renovação</p>
                <p className="mt-0.5 font-semibold text-white">
                  {proximaRenovacao(planoSelecionado.recorrencia_meses)}
                </p>
              </div>
            </div>

            {/* Pagamento inicial */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Pagamento inicial</p>
              <input type="hidden" name="pagamento_inicial" value={pagamentoInicial} />
              <div className="flex gap-3">
                {(["a_pagar", "pago_agora"] as const).map((op) => (
                  <label
                    key={op}
                    className={cn(
                      "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition",
                      pagamentoInicial === op
                        ? op === "pago_agora"
                          ? "border-volt-500/50 bg-volt-500/10 text-volt-300"
                          : "border-amber-500/50 bg-amber-500/10 text-amber-300"
                        : "border-ink-600 bg-ink-800 text-slate-400 hover:border-ink-500"
                    )}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      checked={pagamentoInicial === op}
                      onChange={() => setPagamentoInicial(op)}
                    />
                    {op === "pago_agora" ? "✓ Pago agora" : "⏳ A pagar"}
                  </label>
                ))}
              </div>

              {pagamentoInicial === "pago_agora" && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Forma de pagamento">
                    <select name="forma_pagamento" className="inp" required>
                      <option value="">Selecione…</option>
                      {FORMAS_PAGAMENTO.map((f) => (
                        <option key={f.value} value={f.label}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Data do pagamento">
                    <input
                      name="data_pagamento"
                      type="date"
                      value={dataPagamento}
                      onChange={(e) => setDataPagamento(e.target.value)}
                      max={hoje}
                      className="inp"
                      required
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>
        )}

        <p className="rounded-lg border border-ink-600 bg-ink-800/50 px-3 py-2 text-xs text-slate-400">
          {alunoExistente
            ? "A foto de perfil se envia direto na ficha do aluno, logo acima."
            : "Depois de salvar, a foto de perfil se envia na ficha do aluno recém-cadastrado."}
        </p>
      </div>

      <div className="mt-5 border-t border-ink-700 pt-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <HeartPulse className="h-3.5 w-3.5 text-magenta-400" /> Saúde e anamnese
          <span className="normal-case text-slate-500">
            — só a equipe vê, nunca aparece pro aluno
          </span>
        </p>
        <div className="mt-3 space-y-3">
          <Field label="Objetivo">
            <input
              name="objetivo"
              defaultValue={alunoExistente?.objetivo ?? ""}
              placeholder="Ex: Emagrecimento, hipertrofia, condicionamento..."
              className="inp"
            />
          </Field>
          <Field label="Condições médicas / restrições / lesões">
            <textarea
              name="condicoes_medicas"
              defaultValue={alunoExistente?.condicoes_medicas ?? ""}
              placeholder="Ex: Hérnia de disco L4-L5, evitar carga axial. Hipertensão controlada."
              rows={3}
              className="inp"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contato de emergência">
              <input
                name="contato_emergencia_nome"
                defaultValue={alunoExistente?.contato_emergencia_nome ?? ""}
                placeholder="Nome"
                className="inp"
              />
            </Field>
            <Field label="Telefone de emergência">
              <input
                name="contato_emergencia_telefone"
                defaultValue={alunoExistente?.contato_emergencia_telefone ?? ""}
                placeholder="(11) 90000-0000"
                className="inp"
              />
            </Field>
          </div>
        </div>
      </div>

      <FormActions
        onCancelar={onCancelar}
        salvarLabel={alunoExistente ? "Salvar alterações" : "Adicionar aluno"}
        className="mt-4"
      />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Formulário de nova ficha de treino
// ---------------------------------------------------------------------------
/**
 * Ficha já montada: resumo dos exercícios e, ao clicar em "Editar", o mesmo
 * construtor usado na criação — agora pré-preenchido com o que está salvo.
 *
 * Antes só existia "Excluir": para trocar um vídeo ou corrigir uma carga o
 * professor precisava apagar a ficha e remontar tudo. A mídia de cada
 * exercício aparece como miniatura para ele conferir, sem abrir a edição, se
 * a foto e o vídeo realmente foram salvos.
 */
function CardFichaTreino({
  slug,
  treino,
  catalogo,
}: {
  slug: string;
  treino: Treino;
  catalogo: CatalogoExercicio[];
}) {
  const [editando, setEditando] = useState(false);
  const exercicios = [...(treino.exercicios ?? [])].sort(
    (a, b) => a.ordem - b.ordem
  );

  return (
    <div className="rounded-xl border border-ink-600 bg-ink-900/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-white">{treino.nome_treino}</p>
        <div className="flex items-center gap-2">
          {treino.objetivo && (
            <span className="chip border-magenta-500/30 bg-magenta-500/10 text-magenta-400">
              {treino.objetivo}
            </span>
          )}
          <button
            type="button"
            onClick={() => setEditando((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:border-volt-500/50 hover:bg-ink-700"
          >
            <Pencil className="h-3 w-3 text-volt-300" />
            {editando ? "Cancelar" : "Editar"}
          </button>
          <ConfirmButton
            action={() => excluirTreino(slug, treino.id)}
            confirmText={`Excluir a ficha "${treino.nome_treino}"?`}
            label="Excluir ficha"
          />
        </div>
      </div>

      {editando ? (
        <FormularioEdicaoTreino
          slug={slug}
          treino={treino}
          exercicios={exercicios}
          catalogo={catalogo}
          onSalvo={() => setEditando(false)}
        />
      ) : (
        <>
          <p className="mt-1 text-xs text-slate-500">
            {exercicios.length} exercícios
          </p>
          <div className="mt-3 space-y-1.5">
            {exercicios.map((ex) => (
              <div
                key={ex.id}
                className="flex items-center gap-2 text-xs text-slate-300"
              >
                {/* Miniatura: confirma visualmente que a mídia foi salva. */}
                {ex.video_demonstracao_url ? (
                  <span className="inline-flex flex-none items-center gap-1 rounded bg-volt-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-volt-300">
                    <Video className="h-3 w-3" /> vídeo
                  </span>
                ) : (
                  <span className="w-[52px] flex-none" />
                )}
                {ex.imagem_demonstracao_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={ex.imagem_demonstracao_url}
                    alt=""
                    className="h-6 w-6 flex-none rounded object-cover"
                  />
                ) : (
                  <span className="h-6 w-6 flex-none rounded bg-ink-700" />
                )}
                <span className="truncate">
                  {ex.nome_exercicio} · {ex.series}x{ex.repeticoes}
                  {ex.carga_kg ? ` · ${ex.carga_kg}kg` : ""}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FormularioEdicaoTreino({
  slug,
  treino,
  exercicios,
  catalogo,
  onSalvo,
}: {
  slug: string;
  treino: Treino;
  exercicios: Treino["exercicios"];
  catalogo: CatalogoExercicio[];
  onSalvo: () => void;
}) {
  const acao = atualizarTreino.bind(null, slug, treino.id);
  const [estado, formAction] = useFormState(acao, {});

  useEffect(() => {
    if (estado.ok) onSalvo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  // Converte o que está salvo no banco para as linhas do construtor.
  const iniciais: LinhaExercicio[] = (exercicios ?? []).map((ex) => ({
    nome_exercicio: ex.nome_exercicio,
    series: ex.series,
    repeticoes: ex.repeticoes,
    carga_kg: ex.carga_kg ?? 0,
    descanso_segundos: ex.descanso_segundos ?? 0,
    observacoes: ex.observacoes ?? "",
    imagem_demonstracao_url: ex.imagem_demonstracao_url ?? "",
    video_demonstracao_url: ex.video_demonstracao_url ?? "",
  }));

  return (
    <form action={formAction} className="mt-4 space-y-4">
      {estado.erro && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome do treino">
          <input
            name="nome_treino"
            defaultValue={treino.nome_treino}
            className="inp"
            required
          />
        </Field>
        <Field label="Objetivo">
          <div className="relative">
            <Target className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              name="objetivo"
              defaultValue={treino.objetivo ?? ""}
              placeholder="Ex: Hipertrofia"
              className="inp pl-9"
            />
          </div>
        </Field>
      </div>

      <ExercicioBuilder slug={slug} catalogo={catalogo} iniciais={iniciais} />

      <FormActions salvarLabel="Salvar alterações" />
    </form>
  );
}

function FormularioTreino({
  slug,
  alunoId,
  proximaOrdem,
  catalogo,
}: {
  slug: string;
  alunoId: string;
  proximaOrdem: number;
  catalogo: CatalogoExercicio[];
}) {
  const acao = criarTreino.bind(null, slug, alunoId);
  const [estado, formAction] = useFormState(acao, {});
  const [nomeTreino, setNomeTreino] = useState("");
  const [objetivo, setObjetivo] = useState("Hipertrofia");
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (estado.ok) {
      setNomeTreino("");
      setObjetivo("Hipertrofia");
      setResetKey((k) => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  return (
    <form action={formAction} className="mt-4 space-y-4">
      {estado.erro && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome do treino">
          <input
            value={nomeTreino}
            onChange={(e) => setNomeTreino(e.target.value)}
            name="nome_treino"
            placeholder={`Ex: Treino ${String.fromCharCode(64 + proximaOrdem)} - Peito e Tríceps`}
            className="inp"
            required
          />
        </Field>
        <Field label="Objetivo">
          <div className="relative">
            <Target className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              name="objetivo"
              placeholder="Ex: Hipertrofia"
              className="inp pl-9"
            />
          </div>
        </Field>
      </div>

      <ExercicioBuilder key={resetKey} slug={slug} catalogo={catalogo} />

      <FormActions salvarLabel="Salvar ficha de treino" />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

