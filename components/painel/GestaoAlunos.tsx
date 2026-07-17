"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import Image from "next/image";
import {
  Check,
  Dumbbell,
  ImagePlus,
  Pencil,
  Plus,
  QrCode,
  Target,
  Trash2,
  UserPlus,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { Aluno, ExercicioTreino, Plano, StatusMatricula, Treino } from "@/lib/types";
import { badgeStatusMatricula, cn } from "@/lib/utils";
import FormActions from "@/components/ui/FormActions";
import ConfirmButton from "@/components/ui/ConfirmButton";
import {
  atualizarAluno,
  criarAluno,
  criarTreino,
  excluirAluno,
  excluirTreino,
} from "@/app/painel/[slug]/alunos/actions";

type NovoExercicio = {
  nome_exercicio: string;
  series: number;
  repeticoes: string;
  carga_kg: number;
  imagem_demonstracao_url: string;
  video_demonstracao_url: string;
};

const EX_VAZIO: NovoExercicio = {
  nome_exercicio: "",
  series: 3,
  repeticoes: "12",
  carga_kg: 0,
  imagem_demonstracao_url: "",
  video_demonstracao_url: "",
};

export default function GestaoAlunos({
  slug,
  alunosIniciais,
  treinosIniciais,
  planos,
}: {
  slug: string;
  alunosIniciais: Aluno[];
  treinosIniciais: Treino[];
  planos: Plano[];
}) {
  const alunos = alunosIniciais;
  const treinos = treinosIniciais;

  const [selecionadoId, setSelecionadoId] = useState<string | null>(
    alunosIniciais[0]?.id ?? null
  );
  const [mostrarNovoAluno, setMostrarNovoAluno] = useState(alunos.length === 0);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const treinosDoAluno = treinos.filter((t) => t.aluno_id === selecionadoId);
  const alunoSelecionado = alunos.find((a) => a.id === selecionadoId) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
      {/* Coluna esquerda: cadastro + lista de alunos */}
      <div className="space-y-6">
        {mostrarNovoAluno ? (
          <FormularioAluno
            slug={slug}
            planos={planos}
            onCancelar={alunos.length > 0 ? () => setMostrarNovoAluno(false) : undefined}
            onSalvo={(id) => {
              setMostrarNovoAluno(false);
              setSelecionadoId(id);
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
                ({alunos.length})
              </span>
            </h2>
          </div>
          {alunos.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">
              Nenhum aluno cadastrado ainda.
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
                      onSalvo={() => setEditandoId(null)}
                    />
                  </li>
                ) : (
                  <LinhaAluno
                    key={a.id}
                    slug={slug}
                    aluno={a}
                    ativo={selecionadoId === a.id}
                    onSelecionar={() => setSelecionadoId(a.id)}
                    onEditar={() => setEditandoId(a.id)}
                  />
                )
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Coluna direita: montagem da ficha de treino */}
      <div className="space-y-6">
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
                  <div
                    key={t.id}
                    className="rounded-xl border border-ink-600 bg-ink-900/40 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-white">{t.nome_treino}</p>
                      <div className="flex items-center gap-2">
                        {t.objetivo && (
                          <span className="chip border-magenta-500/30 bg-magenta-500/10 text-magenta-400">
                            {t.objetivo}
                          </span>
                        )}
                        <ConfirmButton
                          action={() => excluirTreino(slug, t.id)}
                          confirmText={`Excluir a ficha "${t.nome_treino}"?`}
                          label="Excluir ficha"
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {t.exercicios?.length ?? 0} exercícios
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(t.exercicios ?? []).map((ex) => (
                        <span
                          key={ex.id}
                          className="chip border-ink-600 bg-ink-700/60 text-slate-300"
                        >
                          {ex.nome_exercicio} · {ex.series}x{ex.repeticoes}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
  onSelecionar,
  onEditar,
}: {
  slug: string;
  aluno: Aluno;
  ativo: boolean;
  onSelecionar: () => void;
  onEditar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  const copiarLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = `${window.location.origin}/aluno/${slug}/${aluno.id}`;
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
          <p className="truncate text-sm font-medium text-white">{aluno.nome}</p>
          <p className="truncate text-xs text-slate-500">
            {aluno.matricula_codigo}
          </p>
        </div>
        <span
          className={cn(
            "chip text-[10px]",
            badgeStatusMatricula(aluno.status_matricula)
          )}
        >
          {aluno.status_matricula}
        </span>
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
  const acao = alunoExistente
    ? atualizarAluno.bind(null, slug, alunoExistente.id)
    : criarAluno.bind(null, slug);
  const [estado, formAction] = useFormState(acao, {});
  const [fotoUrl, setFotoUrl] = useState(alunoExistente?.foto_perfil_url ?? "");

  useEffect(() => {
    if (estado.ok) onSalvo(alunoExistente?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  return (
    <form action={formAction} className="surface rounded-2xl p-5">
      <h2 className="flex items-center gap-2 font-semibold text-white">
        <UserPlus className="h-4 w-4 text-volt-300" />
        {alunoExistente ? "Editar aluno" : "Cadastrar aluno"}
      </h2>

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
        <Field label="Plano">
          <select
            name="plano_id"
            defaultValue={alunoExistente?.plano_id ?? ""}
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
        <Field label="Foto de perfil">
          <input type="hidden" name="foto_perfil_url" value={fotoUrl} />
          <ImageUpload
            value={fotoUrl}
            onChange={setFotoUrl}
            aspect="aspect-square"
            hint="Foto do aluno (estado original)"
          />
        </Field>
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
function FormularioTreino({
  slug,
  alunoId,
  proximaOrdem,
}: {
  slug: string;
  alunoId: string;
  proximaOrdem: number;
}) {
  const acao = criarTreino.bind(null, slug, alunoId);
  const [estado, formAction] = useFormState(acao, {});
  const [nomeTreino, setNomeTreino] = useState("");
  const [objetivo, setObjetivo] = useState("Hipertrofia");
  const [exercicios, setExercicios] = useState<NovoExercicio[]>([{ ...EX_VAZIO }]);

  useEffect(() => {
    if (estado.ok) {
      setNomeTreino("");
      setObjetivo("Hipertrofia");
      setExercicios([{ ...EX_VAZIO }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  const setEx = (i: number, patch: Partial<NovoExercicio>) =>
    setExercicios((prev) =>
      prev.map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex))
    );

  const addLinhaEx = () => setExercicios((p) => [...p, { ...EX_VAZIO }]);
  const rmLinhaEx = (i: number) =>
    setExercicios((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <input type="hidden" name="exercicios_json" value={JSON.stringify(exercicios)} />

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

      <div className="space-y-4">
        {exercicios.map((ex, i) => (
          <div
            key={i}
            className="rounded-xl border border-ink-600 bg-ink-900/50 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Exercício {i + 1}
              </span>
              <button
                type="button"
                onClick={() => rmLinhaEx(i)}
                className="text-slate-500 transition hover:text-red-400"
                aria-label="Remover exercício"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_minmax(0,180px)]">
              <div className="space-y-3">
                <input
                  value={ex.nome_exercicio}
                  onChange={(e) => setEx(i, { nome_exercicio: e.target.value })}
                  placeholder="Nome do exercício"
                  className="inp"
                />
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Séries">
                    <input
                      type="number"
                      min={0}
                      value={ex.series}
                      onChange={(e) => setEx(i, { series: Number(e.target.value) })}
                      className="inp"
                    />
                  </Field>
                  <Field label="Reps">
                    <input
                      value={ex.repeticoes}
                      onChange={(e) => setEx(i, { repeticoes: e.target.value })}
                      placeholder="10-12"
                      className="inp"
                    />
                  </Field>
                  <Field label="Carga (kg)">
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={ex.carga_kg}
                      onChange={(e) => setEx(i, { carga_kg: Number(e.target.value) })}
                      className="inp"
                    />
                  </Field>
                </div>
              </div>

              <ImageUpload
                value={ex.imagem_demonstracao_url}
                onChange={(url) => setEx(i, { imagem_demonstracao_url: url })}
                aspect="aspect-[4/3]"
                hint="Imagem do equipamento"
              />

              <Field label="Vídeo de demonstração (≤ 10s)">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 flex-none text-volt-300" />
                  <input
                    type="url"
                    value={ex.video_demonstracao_url}
                    onChange={(e) =>
                      setEx(i, { video_demonstracao_url: e.target.value })
                    }
                    placeholder="URL do clipe (mp4/webm) — Supabase Storage"
                    className="inp"
                  />
                </div>
              </Field>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addLinhaEx} className="btn-ghost w-full">
        <Plus className="h-4 w-4" /> Adicionar exercício
      </button>

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

/**
 * Upload de imagem com preview. Aceita colar uma URL OU selecionar um arquivo
 * local (convertido para data URL — em produção, envie para o Supabase
 * Storage e cole a URL pública). A imagem é exibida em seu estado nativo
 * (sem filtros) e sem retângulos de fundo desnecessários.
 */
function ImageUpload({
  value,
  onChange,
  aspect,
  hint,
}: {
  value: string;
  onChange: (url: string) => void;
  aspect: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-dashed border-ink-500 bg-ink-900/50",
          aspect
        )}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Pré-visualização"
              className="media-native h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md bg-ink-950/70 text-slate-200 hover:bg-ink-950"
              aria-label="Remover imagem"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="grid h-full w-full place-items-center text-slate-500 transition hover:text-volt-300"
          >
            <span className="flex flex-col items-center gap-1">
              <ImagePlus className="h-6 w-6" />
              <span className="text-[11px]">{hint ?? "Enviar imagem"}</span>
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <input
        value={value.startsWith("data:") ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ou cole uma URL de imagem"
        className="inp mt-2 text-xs"
      />
    </div>
  );
}
