"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  FilterX,
  HeartPulse,
  Loader2,
  Printer,
  Search,
  UserPlus,
} from "lucide-react";
import {
  Aluno,
  CatalogoExercicio,
  HistoricoPlano,
  Papel,
  Plano,
  ProgressoAluno as TipoProgresso,
  StatusFinanceiro,
  StatusMatricula,
  Treino,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import ProgressoAluno from "@/components/painel/ProgressoAluno";
import HistoricoPlanoAluno from "@/components/painel/HistoricoPlanoAluno";
import AcessoAlunoCard from "@/components/painel/AcessoAlunoCard";
import FotoAlunoAdminCard from "@/components/painel/FotoAlunoAdminCard";
import UsarModeloTreino from "@/components/painel/UsarModeloTreino";
import type { ModeloTreinoResumo } from "@/components/painel/UsarModeloTreino";
import { buscarAlunoParaEdicao } from "@/app/painel/[slug]/alunos/actions";
import type { MensalidadeDetalhe } from "@/lib/data";
import LinhaAluno from "@/components/painel/alunos/LinhaAluno";
import FormularioAluno from "@/components/painel/alunos/FormularioAluno";
import ResumoSemanalTreinos from "@/components/painel/alunos/ResumoSemanalTreinos";
import CardFichaTreino from "@/components/painel/alunos/CardFichaTreino";
import FormularioTreino from "@/components/painel/alunos/FormularioTreino";
import DadosCadastraisCard from "@/components/painel/alunos/DadosCadastraisCard";
import SituacaoFinanceira from "@/components/painel/alunos/SituacaoFinanceira";

// ---------------------------------------------------------------------------
// Orquestrador da Gestão de Alunos: lista + filtros (coluna esquerda) e a
// ficha do aluno selecionado (coluna direita). Os painéis que antes viviam
// todos neste arquivo (81 KB) foram extraídos para components/painel/alunos/
// — cada um autocontido (props + estado próprio), sem nenhuma mudança de
// comportamento. Esta é uma decomposição mecânica, não uma reforma de UX.
// ---------------------------------------------------------------------------

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
  modelosTreino,
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
  modelosTreino: ModeloTreinoResumo[];
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
  // Dados completos (CPF, e-mail, contato de emergência etc.) do aluno em
  // edição — buscados sob demanda ao clicar em Editar, porque a listagem
  // paginada não traz mais esses campos em massa (ver getAlunosPaginado).
  // O `id` é comparado no render (não só a presença do valor) para não
  // mostrar dados de um aluno errado se o usuário trocar de edição antes da
  // busca anterior responder.
  const [alunoEmEdicao, setAlunoEmEdicao] = useState<Aluno | null>(null);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);
  const [carregandoEdicao, iniciarEdicao] = useTransition();
  // Alvo da busca em andamento, fora do ciclo de render: se o usuário trocar
  // de aluno antes da resposta anterior chegar, essa ref já aponta pro novo
  // id, e a resposta antiga (fora de ordem) é descartada em vez de
  // sobrescrever o estado do aluno certo.
  const editandoIdRef = useRef<string | null>(null);
  // Id do aluno cadastrado agora, só para destacar o envio do acesso logo
  // depois do cadastro. Comparado com a seleção atual, então trocar de aluno
  // já desfaz o destaque sem precisar limpar nada.
  const [recemCadastradoId, setRecemCadastradoId] = useState<string | null>(null);
  const financialRef = useRef<HTMLDivElement>(null);

  // Dados cadastrais completos (CPF, e-mail, nascimento, objetivo, contato de
  // emergência) do aluno SELECIONADO — buscados sob demanda para o cartão
  // só-leitura "Dados do aluno". A listagem paginada não traz esses campos em
  // massa (ver getAlunosPaginado), então carregamos só o aluno aberto, igual à
  // edição. `detalheReqRef` descarta respostas fora de ordem ao trocar de
  // aluno; `detalheNonce` força recarregar após salvar uma edição.
  const [detalheAluno, setDetalheAluno] = useState<Aluno | null>(null);
  const detalheReqRef = useRef<string | null>(null);
  const [detalheNonce, setDetalheNonce] = useState(0);

  useEffect(() => {
    if (!selecionadoId) {
      detalheReqRef.current = null;
      setDetalheAluno(null);
      return;
    }
    detalheReqRef.current = selecionadoId;
    setDetalheAluno(null);
    buscarAlunoParaEdicao(slug, selecionadoId).then((res) => {
      if (detalheReqRef.current !== selecionadoId) return;
      setDetalheAluno(res.aluno ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionadoId, detalheNonce]);

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

  /** Dispara a busca dos dados completos de um aluno para edição (clique em
   *  "Editar" ou "Tentar novamente" após um erro). */
  function buscarParaEdicao(alunoId: string) {
    editandoIdRef.current = alunoId;
    setEditandoId(alunoId);
    setAlunoEmEdicao(null);
    setErroEdicao(null);
    iniciarEdicao(async () => {
      const resultado = await buscarAlunoParaEdicao(slug, alunoId);
      // Resposta de uma busca anterior, já abandonada — descarta em vez de
      // sobrescrever o aluno que está em edição agora.
      if (editandoIdRef.current !== alunoId) return;
      if (resultado.erro) {
        setErroEdicao(resultado.erro);
        return;
      }
      setAlunoEmEdicao(resultado.aluno);
    });
  }

  function cancelarEdicao() {
    editandoIdRef.current = null;
    setEditandoId(null);
    setAlunoEmEdicao(null);
    setErroEdicao(null);
  }

  // Pré-computa total em aberto por aluno para exibir na lista.
  const totaisAberto: Record<string, number> = {};
  for (const [id, mens] of Object.entries(mensalidadesPorAluno)) {
    totaisAberto[id] = mens
      .filter((m) => m.status === "pendente")
      .reduce((s, m) => s + Number(m.valor), 0);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
      {/* Coluna esquerda: cadastro + lista de alunos */}
      <div className="min-w-0 space-y-6">
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
                    {alunoEmEdicao?.id === a.id ? (
                      <FormularioAluno
                        slug={slug}
                        planos={planos}
                        alunoExistente={alunoEmEdicao}
                        onCancelar={cancelarEdicao}
                        onSalvo={(id) => {
                          editandoIdRef.current = null;
                          setEditandoId(null);
                          setAlunoEmEdicao(null);
                          // Seleciona o aluno recém-editado para que o alerta de
                          // condições médicas (e a ficha) reflita o que foi salvo.
                          if (id) setSelecionadoId(id);
                          // Recarrega o cartão "Dados do aluno": a seleção pode
                          // não mudar (mesmo id), então o nonce força o refetch.
                          setDetalheNonce((n) => n + 1);
                        }}
                      />
                    ) : erroEdicao ? (
                      <div className="surface flex items-center justify-between gap-3 rounded-2xl p-4">
                        <p className="text-sm text-red-400">{erroEdicao}</p>
                        <div className="flex flex-none items-center gap-3 text-xs">
                          <button
                            type="button"
                            onClick={() => buscarParaEdicao(a.id)}
                            className="text-volt-300 underline underline-offset-2"
                          >
                            Tentar novamente
                          </button>
                          <button
                            type="button"
                            onClick={cancelarEdicao}
                            className="text-slate-400 underline underline-offset-2"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="surface flex items-center gap-3 rounded-2xl p-4"
                        aria-busy={carregandoEdicao}
                      >
                        <Loader2 className="h-4 w-4 flex-none animate-spin text-slate-500" />
                        <p className="text-sm text-slate-400">
                          Carregando os dados do aluno…
                        </p>
                        <button
                          type="button"
                          onClick={cancelarEdicao}
                          className="ml-auto flex-none text-xs text-slate-400 underline underline-offset-2"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
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
                    onEditar={() => buscarParaEdicao(a.id)}
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
      <div className="min-w-0 space-y-6">
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
            <DadosCadastraisCard
              alunoId={alunoSelecionado.id}
              detalhe={detalheAluno}
              onEditar={() => buscarParaEdicao(alunoSelecionado.id)}
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
          <div className="flex flex-wrap items-center justify-between gap-3">
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
            <>
              {papel !== "recepcao" && (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-ink-600 bg-ink-900/40 p-3">
                  <UsarModeloTreino
                    slug={slug}
                    alunoId={alunoSelecionado.id}
                    alunoNome={alunoSelecionado.nome}
                    modelos={modelosTreino}
                  />
                  <p className="text-xs text-slate-500">
                    ou monte uma ficha personalizada do zero abaixo
                  </p>
                </div>
              )}
              <FormularioTreino
                key={alunoSelecionado.id}
                slug={slug}
                alunoId={alunoSelecionado.id}
                proximaOrdem={treinosDoAluno.length + 1}
                catalogo={catalogo}
              />
            </>
          )}
        </div>

        {/* Fichas já montadas */}
        {alunoSelecionado && (
          <div className="surface rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-white">
                Fichas de {alunoSelecionado.nome.split(" ")[0]}
              </h3>
              {treinosDoAluno.length > 0 && (
                <a
                  href={`/imprimir/${slug}/aluno/${alunoSelecionado.id}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir versão para papel e imprimir"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-white"
                >
                  <Printer className="h-3.5 w-3.5" /> Imprimir ficha
                </a>
              )}
            </div>
            {treinosDoAluno.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Nenhuma ficha montada ainda.
              </p>
            ) : (
              <>
                <ResumoSemanalTreinos treinos={treinosDoAluno} />
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
              </>
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
