"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import {
  ChevronDown,
  BookPlus,
  Dumbbell,
  Layers,
  Lock,
  Plus,
  Repeat,
  Search,
  Share2,
  Sparkles,
  Target,
  Timer,
  Users,
  UserRound,
  Weight,
  X,
} from "lucide-react";
import {
  CatalogoExercicio,
  GRUPOS_MUSCULARES,
  Papel,
  Treino,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import FormActions from "@/components/ui/FormActions";
import ConfirmButton from "@/components/ui/ConfirmButton";
import ExercicioBuilder from "@/components/painel/ExercicioBuilder";
import CompartilharTreino from "@/components/painel/CompartilharTreino";
import AtribuirTreino from "@/components/painel/AtribuirTreino";
import {
  criarTreinoBiblioteca,
  criarExercicioCatalogo,
  definirVisibilidadeTreino,
  excluirTreinoBiblioteca,
} from "@/app/painel/[slug]/treinos/actions";

/** Nível de visibilidade efetivo de um treino-modelo, para exibição e filtro. */
type NivelTreino = "plataforma" | "academia" | "instrutor";

function nivelDoTreino(t: Treino): NivelTreino {
  if (t.visibilidade === "plataforma" || !t.academia_id) return "plataforma";
  if (t.visibilidade === "instrutor") return "instrutor";
  return "academia";
}

const MODALIDADES_SUGERIDAS = [
  "Musculação",
  "Funcional",
  "Crossfit",
  "Hipertrofia",
  "Emagrecimento",
  "Iniciante",
];

/** Filtro por nível de visibilidade (segmento no topo da tela). */
type NivelFiltro = "todos" | "plataforma" | "academia" | "meus" | "equipe";

export default function GestaoTreinos({
  slug,
  treinosIniciais,
  catalogo,
  podeAtribuir,
  userId,
  papel,
}: {
  slug: string;
  treinosIniciais: Treino[];
  catalogo: CatalogoExercicio[];
  podeAtribuir: boolean;
  userId: string;
  papel: Papel;
}) {
  const treinos = treinosIniciais;
  const ehGestor = papel === "dono" || papel === "gerente";
  const [mostrarForm, setMostrarForm] = useState(treinos.length === 0);
  const [mostrarCatalogoForm, setMostrarCatalogoForm] = useState(false);
  const [busca, setBusca] = useState("");
  const [modalidadeFiltro, setModalidadeFiltro] = useState<string>("");
  const [nivelFiltro, setNivelFiltro] = useState<NivelFiltro>("todos");

  // Quantos treinos existem em cada nível — define quais abas mostrar.
  const contagemNivel = useMemo(() => {
    const c = { plataforma: 0, academia: 0, meus: 0, equipe: 0 };
    for (const t of treinos) {
      const nv = nivelDoTreino(t);
      if (nv === "plataforma") c.plataforma++;
      else if (nv === "academia") c.academia++;
      else if (t.criado_por === userId) c.meus++;
      else c.equipe++;
    }
    return c;
  }, [treinos, userId]);

  const passaNivel = (t: Treino): boolean => {
    if (nivelFiltro === "todos") return true;
    const nv = nivelDoTreino(t);
    if (nivelFiltro === "plataforma") return nv === "plataforma";
    if (nivelFiltro === "academia") return nv === "academia";
    if (nivelFiltro === "meus") return nv === "instrutor" && t.criado_por === userId;
    if (nivelFiltro === "equipe") return nv === "instrutor" && t.criado_por !== userId;
    return true;
  };

  // Lista de modalidades existentes (para os botões de filtro rápido).
  const modalidades = useMemo(() => {
    const set = new Set<string>();
    for (const t of treinos) set.add(t.modalidade?.trim() || "Sem modalidade");
    return Array.from(set).sort();
  }, [treinos]);

  // Aplica nível + busca por texto (nome/objetivo/modalidade) + modalidade.
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return treinos.filter((t) => {
      if (!passaNivel(t)) return false;
      const mod = t.modalidade?.trim() || "Sem modalidade";
      if (modalidadeFiltro && mod !== modalidadeFiltro) return false;
      if (!termo) return true;
      const alvo = [
        t.nome_treino,
        t.objetivo ?? "",
        t.nivel ?? "",
        t.publico_alvo ?? "",
        t.profissional_nome ?? "",
        mod,
        ...(t.exercicios ?? []).map((e) => e.nome_exercicio),
      ]
        .join(" ")
        .toLowerCase();
      return alvo.includes(termo);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treinos, busca, modalidadeFiltro, nivelFiltro, userId]);

  // Agrupa os treinos filtrados por modalidade.
  const grupos = useMemo(() => {
    const map = new Map<string, Treino[]>();
    for (const t of filtrados) {
      const k = t.modalidade?.trim() || "Sem modalidade";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    return Array.from(map.entries());
  }, [filtrados]);

  const temFiltro =
    busca.trim() !== "" || modalidadeFiltro !== "" || nivelFiltro !== "todos";

  // Abas de nível: só aparecem as que têm treino (evita aba vazia confundindo).
  const abasNivel: { valor: NivelFiltro; label: string; qtd: number }[] = [
    { valor: "meus" as NivelFiltro, label: "Meus treinos", qtd: contagemNivel.meus },
    { valor: "academia" as NivelFiltro, label: "Da academia", qtd: contagemNivel.academia },
    { valor: "plataforma" as NivelFiltro, label: "Padrão GestAcad", qtd: contagemNivel.plataforma },
    ...(ehGestor
      ? [{ valor: "equipe" as NivelFiltro, label: "Privados da equipe", qtd: contagemNivel.equipe }]
      : []),
  ].filter((a) => a.qtd > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMostrarForm((v) => !v)}
          className={mostrarForm ? "btn-ghost" : "btn-volt"}
        >
          <Plus className="h-4 w-4" />
          {mostrarForm ? "Fechar formulário" : "Novo treino"}
        </button>
        <button
          type="button"
          onClick={() => setMostrarCatalogoForm((v) => !v)}
          className="btn-ghost"
        >
          <BookPlus className="h-4 w-4" />
          {mostrarCatalogoForm
            ? "Fechar catálogo"
            : "Novo exercício do catálogo"}
        </button>
      </div>

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

      {/* Segmento por nível: Meus treinos / Da academia / Padrão GestAcad */}
      {treinos.length > 0 && abasNivel.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-ink-700 bg-ink-900/40 p-1.5">
          <button
            onClick={() => setNivelFiltro("todos")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              nivelFiltro === "todos"
                ? "bg-volt-300 text-ink-950"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            Todos
          </button>
          {abasNivel.map((aba) => (
            <button
              key={aba.valor}
              onClick={() => setNivelFiltro(aba.valor)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                nivelFiltro === aba.valor
                  ? "bg-volt-300 text-ink-950"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              {aba.valor === "plataforma" && <Sparkles className="h-3.5 w-3.5" />}
              {aba.valor === "academia" && <Users className="h-3.5 w-3.5" />}
              {(aba.valor === "meus" || aba.valor === "equipe") && (
                <Lock className="h-3.5 w-3.5" />
              )}
              {aba.label}
              <span
                className={cn(
                  nivelFiltro === aba.valor ? "text-ink-950/60" : "text-slate-600"
                )}
              >
                {aba.qtd}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Busca + filtro por modalidade */}
      {treinos.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
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
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setModalidadeFiltro("")}
              className={cn(
                "rounded-lg border px-3 py-1 text-xs font-medium transition",
                modalidadeFiltro === ""
                  ? "border-volt-500/40 bg-volt-500/10 text-volt-300"
                  : "border-ink-600 bg-ink-800 text-slate-400 hover:text-slate-200"
              )}
            >
              Todas
            </button>
            {modalidades.map((m) => (
              <button
                key={m}
                onClick={() => setModalidadeFiltro(m)}
                className={cn(
                  "rounded-lg border px-3 py-1 text-xs font-medium transition",
                  modalidadeFiltro === m
                    ? "border-volt-500/40 bg-volt-500/10 text-volt-300"
                    : "border-ink-600 bg-ink-800 text-slate-400 hover:text-slate-200"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {treinos.length === 0 && !mostrarForm ? (
        <div className="surface rounded-2xl p-8 text-center text-slate-400">
          Nenhum treino na biblioteca ainda. Crie o primeiro (ex: “Treino A -
          Peito e Tríceps”) e compartilhe por QR.
        </div>
      ) : filtrados.length === 0 && temFiltro ? (
        <div className="surface rounded-2xl p-8 text-center text-slate-400">
          Nenhum treino encontrado para o filtro atual.
          <button
            onClick={() => {
              setBusca("");
              setModalidadeFiltro("");
              setNivelFiltro("todos");
            }}
            className="ml-1 text-volt-300 underline-offset-2 hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {grupos.map(([modalidade, lista]) => (
            <section key={modalidade} className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                <Layers className="h-4 w-4 text-volt-300" /> {modalidade}
                <span className="text-slate-600">({lista.length})</span>
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {lista.map((t) => (
                  <CardTreino
                    key={t.id}
                    slug={slug}
                    treino={t}
                    podeAtribuir={podeAtribuir}
                    userId={userId}
                    ehGestor={ehGestor}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function CardTreino({
  slug,
  treino,
  podeAtribuir,
  userId,
  ehGestor,
}: {
  slug: string;
  treino: Treino;
  podeAtribuir: boolean;
  userId: string;
  ehGestor: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const exercicios = treino.exercicios ?? [];

  const nivel = nivelDoTreino(treino);
  const souDono = treino.criado_por === userId;
  const ehPlataforma = nivel === "plataforma";
  // Só o autor do treino ou dono/gerente podem alternar a visibilidade.
  // Treino da plataforma (GestAcad) é gerenciado fora da academia: a academia
  // não compartilha nem exclui o modelo global — só atribui a um aluno (que
  // gera uma cópia própria, essa sim compartilhável).
  const podeAlternar = !ehPlataforma && (souDono || ehGestor);

  return (
    <div className="surface flex flex-col rounded-2xl p-5">
      {/* Cabeçalho clicável: abre/fecha os detalhes do treino */}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex items-start justify-between gap-2 text-left"
      >
        <div className="min-w-0">
          <h3 className="font-semibold text-white">{treino.nome_treino}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SeloNivel nivel={nivel} souDono={souDono} treino={treino} />
            {treino.objetivo && (
              <span className="chip border-magenta-500/30 bg-magenta-500/10 text-magenta-400">
                <Target className="h-3.5 w-3.5" /> {treino.objetivo}
              </span>
            )}
            {treino.nivel && (
              <span className="chip border-sky-500/30 bg-sky-500/10 text-sky-300">
                {treino.nivel}
              </span>
            )}
            {treino.publico_alvo && (
              <span className="chip border-ink-500 bg-ink-700/60 text-slate-300">
                {treino.publico_alvo}
              </span>
            )}
            <span className="text-xs text-slate-500">
              {exercicios.length} exercícios
            </span>
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          {treino.publico && (
            <span className="chip border-volt-500/30 bg-volt-500/10 text-volt-300">
              <Share2 className="h-3 w-3" /> público
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-5 w-5 text-slate-500 transition-transform",
              aberto && "rotate-180"
            )}
          />
        </div>
      </button>

      {treino.profissional_nome && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <UserRound className="h-3.5 w-3.5" />
          Profissional: {treino.profissional_nome}
        </p>
      )}

      {aberto ? (
        <ul className="mt-4 space-y-2">
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
              <div className="h-12 w-12 flex-none overflow-hidden rounded-lg bg-ink-700">
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
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Repeat className="h-3 w-3" /> {ex.series}x {ex.repeticoes}
                  </span>
                  {!!ex.carga_kg && ex.carga_kg > 0 && (
                    <span className="flex items-center gap-1">
                      <Weight className="h-3 w-3" /> {ex.carga_kg} kg
                    </span>
                  )}
                  {!!ex.descanso_segundos && (
                    <span className="flex items-center gap-1">
                      <Timer className="h-3 w-3" /> {ex.descanso_segundos}s
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {exercicios.slice(0, 6).map((ex) => (
            <span
              key={ex.id}
              className="chip border-ink-600 bg-ink-700/60 text-slate-300"
            >
              {ex.nome_exercicio}
            </span>
          ))}
          {exercicios.length > 6 && (
            <span className="chip border-ink-600 bg-ink-700/60 text-slate-400">
              +{exercicios.length - 6}
            </span>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-700 pt-4">
        {podeAtribuir && <AtribuirTreino slug={slug} treino={treino} />}
        {/* Modelo da plataforma é global: a academia não compartilha nem
            exclui — só atribui a um aluno. */}
        {!ehPlataforma && <CompartilharTreino slug={slug} treino={treino} />}
        {podeAlternar && (
          <VisibilidadeToggle slug={slug} treino={treino} nivel={nivel} />
        )}
        {ehPlataforma ? (
          <span className="ml-auto text-xs text-slate-500">
            Modelo GestAcad — atribua a um aluno para usar
          </span>
        ) : (
          <div className="ml-auto">
            <ConfirmButton
              action={() => excluirTreinoBiblioteca(slug, treino.id)}
              confirmText={`Excluir o treino "${treino.nome_treino}"?`}
              label="Excluir treino"
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** Selo do nível de visibilidade exibido no card do treino. */
function SeloNivel({
  nivel,
  souDono,
  treino,
}: {
  nivel: NivelTreino;
  souDono: boolean;
  treino: Treino;
}) {
  if (nivel === "plataforma") {
    return (
      <span className="chip border-volt-500/30 bg-volt-500/10 text-volt-300">
        <Sparkles className="h-3.5 w-3.5" /> Padrão GestAcad
      </span>
    );
  }
  if (nivel === "academia") {
    return (
      <span className="chip border-sky-500/30 bg-sky-500/10 text-sky-300">
        <Users className="h-3.5 w-3.5" /> Da academia
      </span>
    );
  }
  // instrutor (privado)
  return (
    <span className="chip border-amber-500/30 bg-amber-500/10 text-amber-300">
      <Lock className="h-3.5 w-3.5" />
      {souDono
        ? "Meu treino (privado)"
        : `Privado · ${treino.profissional_nome ?? "instrutor"}`}
    </span>
  );
}

/** Botão que alterna o treino entre privado do instrutor e da academia. */
function VisibilidadeToggle({
  slug,
  treino,
  nivel,
}: {
  slug: string;
  treino: Treino;
  nivel: NivelTreino;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const alvo = nivel === "instrutor" ? "academia" : "instrutor";

  const alternar = async () => {
    setEnviando(true);
    setErro(null);
    const r = await definirVisibilidadeTreino(slug, treino.id, alvo);
    if (r && "erro" in r) {
      setErro(r.erro);
      setEnviando(false);
    }
    // Em caso de sucesso o revalidatePath recarrega a lista e o card some/atualiza.
  };

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={enviando}
      title={erro ?? undefined}
      className={cn(
        "chip border-ink-600 bg-ink-800 text-slate-300 transition hover:border-volt-500/50 hover:text-white disabled:opacity-60",
        erro && "border-red-500/40 text-red-300"
      )}
    >
      {alvo === "academia" ? (
        <>
          <Users className="h-3.5 w-3.5" /> Compartilhar com a academia
        </>
      ) : (
        <>
          <Lock className="h-3.5 w-3.5" /> Tornar privado
        </>
      )}
    </button>
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
          <input
            name="objetivo"
            placeholder="Ex: Hipertrofia"
            className="inp"
          />
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
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-ink-600 bg-ink-900/50 p-3 has-[:checked]:border-amber-500/50 has-[:checked]:bg-amber-500/5">
            <input
              type="radio"
              name="visibilidade"
              value="instrutor"
              defaultChecked
              className="mt-0.5 accent-amber-400"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                <Lock className="h-3.5 w-3.5 text-amber-300" /> Só eu (privado)
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Fica na sua lista. Dono/gerente também veem. Você pode
                compartilhar com a academia depois.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-ink-600 bg-ink-900/50 p-3 has-[:checked]:border-sky-500/50 has-[:checked]:bg-sky-500/5">
            <input
              type="radio"
              name="visibilidade"
              value="academia"
              className="mt-0.5 accent-sky-400"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                <Users className="h-3.5 w-3.5 text-sky-300" /> Toda a academia
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Toda a equipe da academia vê e pode usar em qualquer aluno.
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
            <input
              name="repeticoes_padrao"
              defaultValue="12"
              className="inp"
            />
          </label>
        </div>
      </div>

      <FormActions salvarLabel="Salvar no catálogo" className="mt-4" />
    </form>
  );
}
