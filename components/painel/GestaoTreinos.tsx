"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";
import {
  BookPlus,
  Check,
  ChevronDown,
  Copy,
  Dumbbell,
  Link2,
  Loader2,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import {
  CatalogoExercicio,
  GRUPOS_MUSCULARES,
  Papel,
  Treino,
} from "@/lib/types";
import { nivelDoTreino, type NivelTreino } from "@/lib/treinos";
import { cn } from "@/lib/utils";
import FormActions from "@/components/ui/FormActions";
import ImageUpload from "@/components/ui/ImageUpload";
import ExercicioBuilder, {
  type LinhaExercicio,
} from "@/components/painel/ExercicioBuilder";
import AtribuirTreino from "@/components/painel/AtribuirTreino";
import AtribuirEmMassa from "@/components/painel/AtribuirEmMassa";
import ImportarTreinos from "@/components/painel/ImportarTreinos";
import GerenciarAcesso from "@/components/painel/GerenciarAcesso";
import {
  criarTreinoBiblioteca,
  criarExercicioCatalogo,
  duplicarTreino,
  editarTreinoBiblioteca,
  excluirTreinoBiblioteca,
} from "@/app/painel/[slug]/treinos/actions";

const MODALIDADES_SUGERIDAS = [
  "Musculação",
  "Funcional",
  "Crossfit",
  "Hipertrofia",
  "Emagrecimento",
  "Iniciante",
];

/** Abas principais (ORIGEM): partição — Meus + Academia + GestAcad = Todos. */
type AbaOrigem = "todos" | "meus" | "academia" | "gestacad";

/** Ordenação da lista. */
type Ordenacao = "modalidade" | "nome" | "exercicios";

type Instrutor = { id: string; nome: string };

export default function GestaoTreinos({
  slug,
  treinosIniciais,
  catalogo,
  instrutores,
  podeAtribuir,
  userId,
  papel,
}: {
  slug: string;
  treinosIniciais: Treino[];
  catalogo: CatalogoExercicio[];
  instrutores: Instrutor[];
  podeAtribuir: boolean;
  userId: string;
  papel: Papel;
}) {
  const treinos = treinosIniciais;
  const ehGestor = papel === "dono" || papel === "gerente";

  const [mostrarForm, setMostrarForm] = useState(treinos.length === 0);
  const [mostrarCatalogoForm, setMostrarCatalogoForm] = useState(false);
  const [aba, setAba] = useState<AbaOrigem>("todos");
  const [busca, setBusca] = useState("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  // Filtros avançados (dentro do painel "Filtros").
  const [fModalidade, setFModalidade] = useState("");
  const [fObjetivo, setFObjetivo] = useState("");
  const [fNivel, setFNivel] = useState("");
  const [fVisibilidade, setFVisibilidade] = useState("");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("modalidade");

  const [avisoDuplicado, setAvisoDuplicado] = useState<string | null>(null);

  // Após duplicar, a cópia nasce PRIVADA (vai para "Meus"). Se houver filtro/aba
  // ativo, o card novo ficaria escondido — limpamos os filtros e avisamos onde a
  // cópia ficou, para o card aparecer sempre. (Correção B2 da auditoria.)
  const aoDuplicar = (nomeBase: string) => {
    setAba("todos");
    setBusca("");
    setFModalidade("");
    setFObjetivo("");
    setFNivel("");
    setFVisibilidade("");
    setAvisoDuplicado(`Cópia criada: "${nomeBase} (cópia)" — em Meus treinos.`);
  };

  useEffect(() => {
    if (!avisoDuplicado) return;
    const t = window.setTimeout(() => setAvisoDuplicado(null), 6000);
    return () => window.clearTimeout(t);
  }, [avisoDuplicado]);

  // Classifica a ORIGEM de cada treino para as abas (partição estável).
  const origemDe = (t: Treino): Exclude<AbaOrigem, "todos"> => {
    if (nivelDoTreino(t) === "plataforma") return "gestacad";
    return t.criado_por === userId ? "meus" : "academia";
  };

  const contagem = useMemo(() => {
    const c = { todos: treinos.length, meus: 0, academia: 0, gestacad: 0 };
    for (const t of treinos) c[origemDe(t)]++;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treinos, userId]);

  // Opções dinâmicas dos filtros (só o que existe na biblioteca).
  const modalidades = useMemo(
    () =>
      Array.from(
        new Set(treinos.map((t) => t.modalidade?.trim()).filter(Boolean))
      ).sort() as string[],
    [treinos]
  );
  const objetivos = useMemo(
    () =>
      Array.from(
        new Set(treinos.map((t) => t.objetivo?.trim()).filter(Boolean))
      ).sort() as string[],
    [treinos]
  );
  const niveis = useMemo(
    () =>
      Array.from(
        new Set(treinos.map((t) => t.nivel?.trim()).filter(Boolean))
      ).sort() as string[],
    [treinos]
  );

  const filtros = [fModalidade, fObjetivo, fNivel, fVisibilidade].filter(
    Boolean
  ).length;
  const temFiltro =
    aba !== "todos" || busca.trim() !== "" || filtros > 0;

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = treinos.filter((t) => {
      if (aba !== "todos" && origemDe(t) !== aba) return false;
      if (fModalidade && (t.modalidade?.trim() || "") !== fModalidade)
        return false;
      if (fObjetivo && (t.objetivo?.trim() || "") !== fObjetivo) return false;
      if (fNivel && (t.nivel?.trim() || "") !== fNivel) return false;
      if (fVisibilidade && nivelDoTreino(t) !== fVisibilidade) return false;
      if (!termo) return true;
      const alvo = [
        t.nome_treino,
        t.objetivo ?? "",
        t.nivel ?? "",
        t.publico_alvo ?? "",
        t.modalidade ?? "",
        t.profissional_nome ?? "",
        ...(t.exercicios ?? []).map((e) => e.nome_exercicio),
      ]
        .join(" ")
        .toLowerCase();
      return alvo.includes(termo);
    });

    const ordenado = lista.slice();
    if (ordenacao === "nome") {
      ordenado.sort((a, b) => a.nome_treino.localeCompare(b.nome_treino, "pt"));
    } else if (ordenacao === "exercicios") {
      ordenado.sort(
        (a, b) => (b.exercicios?.length ?? 0) - (a.exercicios?.length ?? 0)
      );
    } else {
      ordenado.sort(
        (a, b) =>
          (a.modalidade ?? "").localeCompare(b.modalidade ?? "", "pt") ||
          a.ordem - b.ordem
      );
    }
    return ordenado;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    treinos,
    aba,
    busca,
    fModalidade,
    fObjetivo,
    fNivel,
    fVisibilidade,
    ordenacao,
    userId,
  ]);

  const limparTudo = () => {
    setAba("todos");
    setBusca("");
    setFModalidade("");
    setFObjetivo("");
    setFNivel("");
    setFVisibilidade("");
  };

  const abas: { valor: AbaOrigem; label: string; qtd: number }[] = [
    { valor: "todos", label: "Todos", qtd: contagem.todos },
    { valor: "meus", label: "Meus", qtd: contagem.meus },
    { valor: "academia", label: "Academia", qtd: contagem.academia },
    { valor: "gestacad", label: "GestAcad", qtd: contagem.gestacad },
  ];

  return (
    <div className="space-y-5">
      {/* Ações do topo: CTA verde único + secundárias neutras. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setMostrarForm((v) => !v);
            setMostrarCatalogoForm(false);
          }}
          className={mostrarForm ? "btn-ghost" : "btn-volt"}
        >
          {mostrarForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {mostrarForm ? "Fechar" : "Novo treino"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMostrarCatalogoForm((v) => !v);
            setMostrarForm(false);
          }}
          className="btn-ghost"
        >
          <BookPlus className="h-4 w-4" />
          Biblioteca de exercícios
        </button>
        {podeAtribuir && <ImportarTreinos slug={slug} />}
        {podeAtribuir && <AtribuirEmMassa slug={slug} treinos={treinos} />}
      </div>

      {avisoDuplicado && (
        <p className="flex items-start gap-2 rounded-xl border border-volt-500/30 bg-volt-500/10 px-3 py-2 text-sm text-volt-200">
          <Check className="mt-0.5 h-4 w-4 flex-none" /> {avisoDuplicado}
        </p>
      )}

      {mostrarForm && (
        <FormularioTreino
          slug={slug}
          catalogo={catalogo}
          onSalvo={() => setMostrarForm(false)}
        />
      )}
      {mostrarCatalogoForm && (
        <FormularioExercicioCatalogo
          slug={slug}
          onSalvo={() => setMostrarCatalogoForm(false)}
        />
      )}

      {treinos.length > 0 && (
        <>
          {/* Abas de ORIGEM (Todos | Meus | Academia | GestAcad). */}
          <div className="flex flex-wrap gap-1 border-b border-ink-700">
            {abas.map((a) => (
              <button
                key={a.valor}
                onClick={() => setAba(a.valor)}
                className={cn(
                  "relative -mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition",
                  aba === a.valor
                    ? "border-volt-300 text-white"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                )}
              >
                {a.valor === "gestacad" && <Sparkles className="h-3.5 w-3.5" />}
                {a.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    aba === a.valor
                      ? "bg-ink-700 text-slate-300"
                      : "text-slate-600"
                  )}
                >
                  {a.qtd}
                </span>
              </button>
            ))}
          </div>

          {/* Busca única + botão Filtros. */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar treino por nome, objetivo ou exercício..."
                className="inp pl-9"
              />
              {busca && (
                <button
                  onClick={() => setBusca("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  aria-label="Limpar busca"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setFiltrosAbertos((v) => !v)}
              className={cn(
                "btn-ghost sm:w-auto",
                (filtrosAbertos || filtros > 0) &&
                  "border-volt-500/40 text-volt-200"
              )}
              aria-expanded={filtrosAbertos}
            >
              <SlidersHorizontal className="h-4 w-4" /> Filtros
              {filtros > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-volt-300 px-1 text-xs font-semibold text-ink-950">
                  {filtros}
                </span>
              )}
            </button>
          </div>

          {filtrosAbertos && (
            <div className="grid gap-3 rounded-xl border border-ink-700 bg-ink-900/40 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <FiltroSelect
                label="Modalidade"
                value={fModalidade}
                onChange={setFModalidade}
                options={modalidades}
              />
              <FiltroSelect
                label="Objetivo"
                value={fObjetivo}
                onChange={setFObjetivo}
                options={objetivos}
              />
              <FiltroSelect
                label="Dificuldade"
                value={fNivel}
                onChange={setFNivel}
                options={niveis}
              />
              <FiltroSelect
                label="Visibilidade"
                value={fVisibilidade}
                onChange={setFVisibilidade}
                options={[
                  { valor: "privado", rotulo: "Privado" },
                  { valor: "selecionado", rotulo: "Instrutores" },
                  { valor: "equipe", rotulo: "Equipe" },
                  { valor: "academia", rotulo: "Academia" },
                  { valor: "plataforma", rotulo: "Modelo GestAcad" },
                ]}
              />
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">
                  Ordenar por
                </span>
                <select
                  value={ordenacao}
                  onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
                  className="inp"
                >
                  <option value="modalidade">Modalidade</option>
                  <option value="nome">Nome (A–Z)</option>
                  <option value="exercicios">Mais exercícios</option>
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setFModalidade("");
                    setFObjetivo("");
                    setFNivel("");
                    setFVisibilidade("");
                    setOrdenacao("modalidade");
                  }}
                  className="btn-ghost w-full"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Lista */}
      {treinos.length === 0 && !mostrarForm ? (
        <div className="surface rounded-2xl p-8 text-center text-slate-400">
          Nenhum treino na biblioteca ainda. Crie o primeiro (ex: “Treino A —
          Peito e Tríceps”).
        </div>
      ) : filtrados.length === 0 && temFiltro ? (
        <div className="surface rounded-2xl p-8 text-center text-slate-400">
          Nenhum treino encontrado para o filtro atual.
          <button
            onClick={limparTudo}
            className="ml-1 text-volt-300 underline-offset-2 hover:underline"
          >
            Limpar
          </button>
        </div>
      ) : (
        <div className="divide-y divide-ink-700/70 overflow-hidden rounded-2xl border border-ink-700 bg-ink-800/40">
          {filtrados.map((t) => (
            <LinhaTreino
              key={t.id}
              slug={slug}
              treino={t}
              catalogo={catalogo}
              instrutores={instrutores}
              podeAtribuir={podeAtribuir}
              userId={userId}
              ehGestor={ehGestor}
              onDuplicado={aoDuplicar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Select de filtro reutilizável: aceita lista de strings ou {valor,rotulo}. */
function FiltroSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: (string | { valor: string; rotulo: string })[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="inp"
        disabled={options.length === 0}
      >
        <option value="">Todos</option>
        {options.map((o) => {
          const valor = typeof o === "string" ? o : o.valor;
          const rotulo = typeof o === "string" ? o : o.rotulo;
          return (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          );
        })}
      </select>
    </label>
  );
}

/**
 * Selo ÚNICO de acesso interno. Paleta neutra (grafite) para todos os níveis do
 * tenant — diferenciados por ícone + rótulo, não por cor — mantendo a tela
 * sóbria. O verde fica reservado ao modelo GestAcad (marca) e ao "Link ativo".
 */
function SeloAcesso({ nivel }: { nivel: NivelTreino }) {
  if (nivel === "plataforma")
    return (
      <span className="chip border-volt-500/25 bg-volt-500/10 text-volt-300">
        <Sparkles className="h-3.5 w-3.5" /> Modelo GestAcad
      </span>
    );

  const neutro = "chip border-ink-500 bg-ink-700/60 text-slate-300";
  if (nivel === "academia")
    return (
      <span className={neutro}>
        <Users className="h-3.5 w-3.5" /> Academia
      </span>
    );
  if (nivel === "equipe")
    return (
      <span className={neutro}>
        <UsersRound className="h-3.5 w-3.5" /> Equipe
      </span>
    );
  if (nivel === "selecionado")
    return (
      <span className={neutro}>
        <UserCog className="h-3.5 w-3.5" /> Instrutores
      </span>
    );
  return (
    <span className={neutro}>
      <Lock className="h-3.5 w-3.5" /> Privado
    </span>
  );
}

/**
 * Linha horizontal de um treino-modelo (desktop full-width; empilha no mobile).
 * Mostra só o essencial e concentra as ações secundárias no menu "•••".
 */
function LinhaTreino({
  slug,
  treino,
  catalogo,
  instrutores,
  podeAtribuir,
  userId,
  ehGestor,
  onDuplicado,
}: {
  slug: string;
  treino: Treino;
  catalogo: CatalogoExercicio[];
  instrutores: Instrutor[];
  podeAtribuir: boolean;
  userId: string;
  ehGestor: boolean;
  onDuplicado: (nomeBase: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [acessoAberto, setAcessoAberto] = useState(false);
  const [atribuirAberto, setAtribuirAberto] = useState(false);

  const exercicios = treino.exercicios ?? [];
  const nivel = nivelDoTreino(treino);
  const souDono = treino.criado_por === userId;
  const ehPlataforma = nivel === "plataforma";
  // Só o autor do treino ou dono/gerente gerenciam acesso/edição.
  const podeAlternar = !ehPlataforma && (souDono || ehGestor);

  const nomesExercicios = exercicios.map((e) => e.nome_exercicio);
  const preview = nomesExercicios.slice(0, 3);
  const restantes = nomesExercicios.length - preview.length;

  return (
    <div className="group flex flex-col flex-wrap gap-3 p-4 transition hover:bg-ink-800/60 sm:flex-row sm:items-center sm:gap-4">
      {/* Bloco clicável: abre/fecha os exercícios */}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-center gap-2">
          <h3 className="truncate font-semibold text-white">
            {treino.nome_treino}
          </h3>
          {treino.modalidade && (
            <span className="hidden truncate text-sm text-slate-500 sm:inline">
              — {treino.modalidade}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 flex-none text-slate-600 transition-transform",
              aberto && "rotate-180"
            )}
          />
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <SeloAcesso nivel={nivel} />
          {treino.publico && (
            <span className="chip border-volt-500/25 bg-volt-500/10 text-volt-300">
              <Link2 className="h-3.5 w-3.5" /> Link ativo
            </span>
          )}
          {treino.objetivo && (
            <span className="text-slate-500">· {treino.objetivo}</span>
          )}
        </div>

        <p className="mt-1.5 truncate text-xs text-slate-500">
          {exercicios.length}{" "}
          {exercicios.length === 1 ? "exercício" : "exercícios"}
          {preview.length > 0 && (
            <span className="text-slate-600">
              {" · "}
              {preview.join(" · ")}
              {restantes > 0 && ` · +${restantes}`}
            </span>
          )}
        </p>
      </button>

      {/* Ações: primária neutra + menu ••• */}
      <div className="flex flex-none items-center gap-2">
        {ehPlataforma
          ? podeAtribuir && (
              <UsarModeloBotao
                slug={slug}
                treino={treino}
                onDuplicado={onDuplicado}
              />
            )
          : podeAtribuir && (
              <AtribuirTreino
                slug={slug}
                treino={treino}
                variant="outline"
                label="Atribuir aluno"
              />
            )}

        <MenuAcoes
          slug={slug}
          treino={treino}
          ehPlataforma={ehPlataforma}
          podeAlternar={podeAlternar}
          podeAtribuir={podeAtribuir}
          onEditar={() => {
            setEditando((v) => !v);
            setAberto(true);
          }}
          onGerenciarAcesso={() => setAcessoAberto(true)}
          onAtribuir={() => setAtribuirAberto(true)}
          onDuplicado={onDuplicado}
        />
      </div>

      {/* Diálogo de atribuir controlado no nível da linha (para o modelo de
          plataforma via menu "•••"), fora do menu que fecha ao clicar. */}
      {ehPlataforma && podeAtribuir && (
        <AtribuirTreino
          slug={slug}
          treino={treino}
          controlado
          aberto={atribuirAberto}
          onClose={() => setAtribuirAberto(false)}
        />
      )}

      {/* Detalhes expandidos (exercícios) — ocupam a linha inteira */}
      {aberto && (
        <div className="w-full basis-full sm:order-last">
          <ul className="mt-1 space-y-2">
            {exercicios.length === 0 && (
              <li className="text-sm text-slate-500">
                Este treino ainda não tem exercícios.
              </li>
            )}
            {exercicios.map((ex, i) => (
              <li
                key={ex.id}
                className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900/40 p-2"
              >
                <div className="h-11 w-11 flex-none overflow-hidden rounded-lg bg-ink-700">
                  {ex.imagem_demonstracao_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ex.imagem_demonstracao_url}
                      alt={ex.nome_exercicio}
                      className="media-native h-full w-full object-cover"
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-slate-500">
                      <Dumbbell className="h-4 w-4" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {i + 1}. {ex.nome_exercicio}
                  </p>
                  <p className="text-xs text-slate-400">
                    {ex.series}x {ex.repeticoes}
                    {!!ex.carga_kg && ex.carga_kg > 0 && ` · ${ex.carga_kg} kg`}
                    {!!ex.descanso_segundos &&
                      ` · ${ex.descanso_segundos}s descanso`}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {editando && !ehPlataforma && (
            <FormularioEdicaoTreinoModelo
              slug={slug}
              treino={treino}
              catalogo={catalogo}
              onSalvo={() => setEditando(false)}
            />
          )}
        </div>
      )}

      {acessoAberto && podeAlternar && (
        <GerenciarAcesso
          slug={slug}
          treino={treino}
          instrutores={instrutores}
          onClose={() => setAcessoAberto(false)}
        />
      )}
    </div>
  );
}

/**
 * "Usar modelo" — ação principal do Modelo GestAcad: cria uma cópia editável na
 * academia (duplicarTreino, com a fidelidade e o refresh já validados na
 * auditoria). O template original nunca é alterado.
 */
function UsarModeloBotao({
  slug,
  treino,
  onDuplicado,
}: {
  slug: string;
  treino: Treino;
  onDuplicado: (nomeBase: string) => void;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const usar = async () => {
    setEnviando(true);
    setErro(null);
    const r = await duplicarTreino(slug, treino.id);
    if ("erro" in r) {
      setErro(r.erro);
    } else {
      onDuplicado(treino.nome_treino);
      router.refresh();
    }
    setEnviando(false);
  };

  return (
    <button
      type="button"
      onClick={usar}
      disabled={enviando}
      title={erro ?? "Criar uma cópia editável deste modelo na sua academia"}
      className={cn("btn-outline", erro && "border-red-500/40 text-red-300")}
    >
      {enviando ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      Usar modelo
    </button>
  );
}

/** Menu "•••" com as ações secundárias; Excluir separado das demais. */
function MenuAcoes({
  slug,
  treino,
  ehPlataforma,
  podeAlternar,
  podeAtribuir,
  onEditar,
  onGerenciarAcesso,
  onAtribuir,
  onDuplicado,
}: {
  slug: string;
  treino: Treino;
  ehPlataforma: boolean;
  podeAlternar: boolean;
  podeAtribuir: boolean;
  onEditar: () => void;
  onGerenciarAcesso: () => void;
  onAtribuir: () => void;
  onDuplicado: (nomeBase: string) => void;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState<null | "duplicar" | "excluir">(null);
  const [erro, setErro] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const duplicar = async () => {
    setOcupado("duplicar");
    setErro(null);
    const r = await duplicarTreino(slug, treino.id);
    if ("erro" in r) {
      setErro(r.erro);
    } else {
      setAberto(false);
      onDuplicado(treino.nome_treino);
      router.refresh();
    }
    setOcupado(null);
  };

  const excluir = async () => {
    if (
      !window.confirm(`Excluir o treino "${treino.nome_treino}"? Não dá para desfazer.`)
    )
      return;
    setOcupado("excluir");
    setErro(null);
    const r = await excluirTreinoBiblioteca(slug, treino.id);
    if (r && "erro" in r) {
      setErro(r.erro);
    } else {
      setAberto(false);
      router.refresh();
    }
    setOcupado(null);
  };

  // Sem nenhuma ação disponível (ex.: recepção num modelo de plataforma): oculta.
  const temAlgumaAcao = podeAlternar || podeAtribuir;
  if (!temAlgumaAcao) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        title="Mais ações"
        className="grid h-9 w-9 place-items-center rounded-lg border border-ink-600 text-slate-400 transition hover:border-ink-500 hover:text-white"
      >
        {ocupado ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MoreHorizontal className="h-5 w-5" />
        )}
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-xl border border-ink-600 bg-ink-900 py-1 shadow-xl"
        >
          {podeAlternar && (
            <ItemMenu icone={<Pencil className="h-4 w-4" />} onClick={() => { setAberto(false); onEditar(); }}>
              Editar
            </ItemMenu>
          )}
          {podeAtribuir && (
            <ItemMenu
              icone={<Copy className="h-4 w-4" />}
              onClick={duplicar}
              carregando={ocupado === "duplicar"}
            >
              Duplicar
            </ItemMenu>
          )}
          {podeAlternar && (
            <ItemMenu
              icone={<UserCog className="h-4 w-4" />}
              onClick={() => { setAberto(false); onGerenciarAcesso(); }}
            >
              Gerenciar acesso
            </ItemMenu>
          )}
          {/* No modelo de plataforma, a opção extra é atribuir direto a um aluno. */}
          {ehPlataforma && podeAtribuir && (
            <ItemMenu
              icone={<UserPlus className="h-4 w-4" />}
              onClick={() => {
                setAberto(false);
                onAtribuir();
              }}
            >
              Atribuir a aluno
            </ItemMenu>
          )}

          {podeAlternar && (
            <>
              <div className="my-1 border-t border-ink-700" />
              <ItemMenu
                icone={<Trash2 className="h-4 w-4" />}
                onClick={excluir}
                carregando={ocupado === "excluir"}
                perigo
              >
                Excluir
              </ItemMenu>
            </>
          )}

          {erro && (
            <p className="px-3 py-2 text-xs text-red-300">{erro}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ItemMenu({
  icone,
  children,
  onClick,
  carregando,
  perigo,
}: {
  icone: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  carregando?: boolean;
  perigo?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={carregando}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition disabled:opacity-60",
        perigo
          ? "text-red-300 hover:bg-red-500/10"
          : "text-slate-200 hover:bg-ink-700"
      )}
    >
      <span className="flex-none">
        {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : icone}
      </span>
      {children}
    </button>
  );
}

/** Formulário inline de edição de um treino-modelo (dados + exercícios). */
function FormularioEdicaoTreinoModelo({
  slug,
  treino,
  catalogo,
  onSalvo,
}: {
  slug: string;
  treino: Treino;
  catalogo: CatalogoExercicio[];
  onSalvo: () => void;
}) {
  const acao = editarTreinoBiblioteca.bind(null, slug, treino.id);
  const [estado, formAction] = useFormState(acao, {});

  useEffect(() => {
    if (estado.ok) onSalvo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  const iniciais: LinhaExercicio[] = (treino.exercicios ?? []).map((ex) => ({
    nome_exercicio: ex.nome_exercicio,
    series: ex.series,
    repeticoes: ex.repeticoes,
    carga_kg: ex.carga_kg ?? 0,
    descanso_segundos: ex.descanso_segundos ?? 0,
    observacoes: ex.observacoes ?? "",
    imagem_demonstracao_url: ex.imagem_demonstracao_url ?? "",
    video_demonstracao_url: ex.video_demonstracao_url ?? "",
    // Preserva o vínculo com a biblioteca ao editar. Sem isto, salvar uma
    // edição apagaria a ligação e o exercício perderia a imagem herdada.
    catalogo_exercicio_id: ex.catalogo_exercicio_id ?? "",
  }));

  return (
    <form
      action={formAction}
      className="mt-3 space-y-4 rounded-xl border border-ink-700 bg-ink-900/40 p-4"
    >
      <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
        <Pencil className="h-4 w-4 text-volt-300" /> Editar treino
      </h4>

      {estado.erro && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Nome do treino
          </span>
          <input
            name="nome_treino"
            defaultValue={treino.nome_treino}
            className="inp"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Modalidade
          </span>
          <input
            name="modalidade"
            defaultValue={treino.modalidade ?? ""}
            className="inp"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Objetivo
          </span>
          <input
            name="objetivo"
            defaultValue={treino.objetivo ?? ""}
            className="inp"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Nível
          </span>
          <input name="nivel" defaultValue={treino.nivel ?? ""} className="inp" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Público-alvo
          </span>
          <input
            name="publico_alvo"
            defaultValue={treino.publico_alvo ?? ""}
            className="inp"
          />
        </label>
      </div>

      <ExercicioBuilder slug={slug} catalogo={catalogo} iniciais={iniciais} />
      <FormActions salvarLabel="Salvar alterações" />
    </form>
  );
}

function FormularioTreino({
  slug,
  catalogo,
  onSalvo,
}: {
  slug: string;
  catalogo: CatalogoExercicio[];
  onSalvo: () => void;
}) {
  const acao = criarTreinoBiblioteca.bind(null, slug);
  const [estado, formAction] = useFormState(acao, {});
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (estado.ok) {
      setResetKey((k) => k + 1);
      onSalvo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  return (
    <form action={formAction} className="surface rounded-2xl p-5">
      <h2 className="flex items-center gap-2 font-semibold text-white">
        <Dumbbell className="h-4 w-4 text-volt-300" /> Novo treino
      </h2>

      {estado.erro && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Nome do treino
          </span>
          <input
            name="nome_treino"
            placeholder="Ex: Treino A - Peito e Tríceps"
            className="inp"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Modalidade
          </span>
          <input
            name="modalidade"
            list="modalidades-sugeridas"
            placeholder="Ex: Musculação"
            className="inp"
          />
          <datalist id="modalidades-sugeridas">
            {MODALIDADES_SUGERIDAS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Objetivo
          </span>
          <input name="objetivo" placeholder="Ex: Hipertrofia" className="inp" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Nível
          </span>
          <input
            name="nivel"
            list="niveis-sugeridos"
            placeholder="Ex: Intermediário"
            className="inp"
          />
          <datalist id="niveis-sugeridos">
            <option value="Iniciante" />
            <option value="Intermediário" />
            <option value="Avançado" />
          </datalist>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Público-alvo
          </span>
          <input
            name="publico_alvo"
            placeholder="Ex: Mulheres, idosos, corrida"
            className="inp"
          />
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="mb-1.5 text-xs font-medium text-slate-400">
          Quem pode ver este treino?
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-ink-600 bg-ink-900/50 p-3 has-[:checked]:border-volt-500/50 has-[:checked]:bg-volt-500/5">
            <input
              type="radio"
              name="visibilidade"
              value="privado"
              defaultChecked
              className="mt-0.5 accent-volt-400"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                <Lock className="h-3.5 w-3.5 text-slate-300" /> Só eu (privado)
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Fica na sua lista. Dono/gerente também veem. Dá para liberar
                depois em “Gerenciar acesso”.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-ink-600 bg-ink-900/50 p-3 has-[:checked]:border-volt-500/50 has-[:checked]:bg-volt-500/5">
            <input
              type="radio"
              name="visibilidade"
              value="equipe"
              className="mt-0.5 accent-volt-400"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                <UsersRound className="h-3.5 w-3.5 text-indigo-300" /> A equipe
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                A equipe técnica (dono, gerente e instrutores) vê. A recepção
                não.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-ink-600 bg-ink-900/50 p-3 has-[:checked]:border-volt-500/50 has-[:checked]:bg-volt-500/5">
            <input
              type="radio"
              name="visibilidade"
              value="academia"
              className="mt-0.5 accent-volt-400"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                <Users className="h-3.5 w-3.5 text-sky-300" /> Toda a academia
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Todo o time da academia vê, inclusive a recepção.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <div className="mt-4">
        <ExercicioBuilder key={resetKey} slug={slug} catalogo={catalogo} />
      </div>

      {estado.erro && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Para salvar, adicione pelo menos um exercício com nome.
      </p>

      <FormActions salvarLabel="Salvar treino" className="mt-4" />
    </form>
  );
}

function FormularioExercicioCatalogo({
  slug,
  onSalvo,
}: {
  slug: string;
  onSalvo: () => void;
}) {
  const acao = criarExercicioCatalogo.bind(null, slug);
  const [estado, formAction] = useFormState(acao, {});
  // Sem este campo, todo exercício criado pela academia nascia SEM imagem —
  // e como o treino herda a foto da biblioteca (migração 098), a academia que
  // montasse o próprio catálogo ficava com todos os treinos no placeholder.
  // Era a segunda causa do problema das imagens.
  const [imagem, setImagem] = useState("");

  useEffect(() => {
    if (estado.ok) onSalvo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  return (
    <form action={formAction} className="surface rounded-2xl p-5">
      <div>
        <h2 className="flex items-center gap-2 font-semibold text-white">
          <BookPlus className="h-4 w-4 text-volt-300" /> Exercício da academia
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Fica disponível apenas para esta academia e pode ser reutilizado em
          qualquer ficha.
        </p>
      </div>

      {estado.erro && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Nome
          </span>
          <input
            name="nome"
            className="inp"
            placeholder="Ex: Remada baixa unilateral"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Grupo
          </span>
          <select name="grupo_muscular" className="inp" required defaultValue="">
            <option value="" disabled>
              Selecione
            </option>
            {GRUPOS_MUSCULARES.map((grupo) => (
              <option key={grupo.value} value={grupo.value}>
                {grupo.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">
              Séries
            </span>
            <input
              name="series_padrao"
              type="number"
              min={1}
              max={20}
              defaultValue={3}
              className="inp"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">
              Repetições
            </span>
            <input name="repeticoes_padrao" defaultValue="12" className="inp" />
          </label>
        </div>
      </div>

      <div className="mt-3 max-w-xs">
        <input type="hidden" name="imagem_demonstracao_url" value={imagem} />
        <ImageUpload
          value={imagem}
          onChange={setImagem}
          aspect="aspect-[4/3]"
          hint="Imagem do movimento (opcional) — aparece em todo treino que usar este exercício"
        />
      </div>

      <FormActions salvarLabel="Salvar no catálogo" className="mt-4" />
    </form>
  );
}
