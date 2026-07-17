"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Dumbbell,
  ImagePlus,
  Plus,
  Target,
  Trash2,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { Aluno, ExercicioTreino, StatusMatricula, Treino } from "@/lib/types";
import { badgeStatusMatricula, cn } from "@/lib/utils";

type NovoExercicio = {
  nome_exercicio: string;
  series: number;
  repeticoes: string;
  carga_kg: number;
  imagem_demonstracao_url: string;
};

const EX_VAZIO: NovoExercicio = {
  nome_exercicio: "",
  series: 3,
  repeticoes: "12",
  carga_kg: 0,
  imagem_demonstracao_url: "",
};

export default function GestaoAlunos({
  alunosIniciais,
  treinosIniciais,
}: {
  alunosIniciais: Aluno[];
  treinosIniciais: Treino[];
}) {
  const [alunos, setAlunos] = useState<Aluno[]>(alunosIniciais);
  const [treinos, setTreinos] = useState<Treino[]>(treinosIniciais);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(
    alunosIniciais[0]?.id ?? null
  );

  // ---- Formulário de novo aluno ----
  const [novoAluno, setNovoAluno] = useState({
    nome: "",
    cpf: "",
    status: "ativa" as StatusMatricula,
    foto_perfil_url: "",
  });

  const cadastrarAluno = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoAluno.nome.trim()) return;
    const id = `alu-${Date.now()}`;
    const aluno: Aluno = {
      id,
      academia_id: alunosIniciais[0]?.academia_id ?? "demo",
      nome: novoAluno.nome.trim(),
      cpf: novoAluno.cpf || null,
      email: null,
      telefone: null,
      foto_perfil_url: novoAluno.foto_perfil_url || null,
      data_nascimento: null,
      status_matricula: novoAluno.status,
      plano_id: null,
      matricula_codigo: `IP-${String(alunos.length + 1).padStart(4, "0")}`,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };
    setAlunos((prev) => [aluno, ...prev]);
    setSelecionadoId(id);
    setNovoAluno({ nome: "", cpf: "", status: "ativa", foto_perfil_url: "" });
  };

  const treinosDoAluno = useMemo(
    () => treinos.filter((t) => t.aluno_id === selecionadoId),
    [treinos, selecionadoId]
  );
  const alunoSelecionado = alunos.find((a) => a.id === selecionadoId) ?? null;

  // ---- Construtor de ficha de treino ----
  const [nomeTreino, setNomeTreino] = useState("");
  const [objetivo, setObjetivo] = useState("Hipertrofia");
  const [exercicios, setExercicios] = useState<NovoExercicio[]>([{ ...EX_VAZIO }]);

  const setEx = (i: number, patch: Partial<NovoExercicio>) =>
    setExercicios((prev) =>
      prev.map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex))
    );

  const addLinhaEx = () => setExercicios((p) => [...p, { ...EX_VAZIO }]);
  const rmLinhaEx = (i: number) =>
    setExercicios((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  const salvarTreino = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selecionadoId || !nomeTreino.trim()) return;
    const treinoId = `trn-${Date.now()}`;
    const exs: ExercicioTreino[] = exercicios
      .filter((ex) => ex.nome_exercicio.trim())
      .map((ex, idx) => ({
        id: `ex-${treinoId}-${idx}`,
        treino_id: treinoId,
        nome_exercicio: ex.nome_exercicio.trim(),
        series: Number(ex.series) || 0,
        repeticoes: ex.repeticoes || "0",
        carga_kg: Number(ex.carga_kg) || 0,
        descanso_segundos: 60,
        imagem_demonstracao_url: ex.imagem_demonstracao_url || null,
        observacoes: null,
        ordem: idx + 1,
        criado_em: new Date().toISOString(),
      }));

    const treino: Treino = {
      id: treinoId,
      academia_id: alunoSelecionado?.academia_id ?? "demo",
      aluno_id: selecionadoId,
      nome_treino: nomeTreino.trim(),
      objetivo,
      ordem: treinosDoAluno.length + 1,
      ativo: true,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      exercicios: exs,
    };
    setTreinos((prev) => [...prev, treino]);
    setNomeTreino("");
    setObjetivo("Hipertrofia");
    setExercicios([{ ...EX_VAZIO }]);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      {/* Coluna esquerda: cadastro + lista de alunos */}
      <div className="space-y-6">
        <form onSubmit={cadastrarAluno} className="surface rounded-2xl p-5">
          <h2 className="flex items-center gap-2 font-semibold text-white">
            <UserPlus className="h-4 w-4 text-volt-300" /> Cadastrar aluno
          </h2>

          <div className="mt-4 space-y-3">
            <Field label="Nome completo">
              <input
                value={novoAluno.nome}
                onChange={(e) =>
                  setNovoAluno({ ...novoAluno, nome: e.target.value })
                }
                placeholder="Ex: João da Silva"
                className="inp"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CPF">
                <input
                  value={novoAluno.cpf}
                  onChange={(e) =>
                    setNovoAluno({ ...novoAluno, cpf: e.target.value })
                  }
                  placeholder="000.000.000-00"
                  className="inp"
                />
              </Field>
              <Field label="Status">
                <select
                  value={novoAluno.status}
                  onChange={(e) =>
                    setNovoAluno({
                      ...novoAluno,
                      status: e.target.value as StatusMatricula,
                    })
                  }
                  className="inp"
                >
                  <option value="ativa">Ativa</option>
                  <option value="pendente">Pendente</option>
                  <option value="trancada">Trancada</option>
                  <option value="inativa">Inativa</option>
                </select>
              </Field>
            </div>
            <Field label="Foto de perfil">
              <ImageUpload
                value={novoAluno.foto_perfil_url}
                onChange={(url) =>
                  setNovoAluno({ ...novoAluno, foto_perfil_url: url })
                }
                aspect="aspect-square"
                hint="Foto do aluno (estado original)"
              />
            </Field>
          </div>

          <button type="submit" className="btn-volt mt-4 w-full">
            <Plus className="h-4 w-4" /> Adicionar aluno
          </button>
        </form>

        <div className="surface rounded-2xl">
          <div className="border-b border-ink-700 px-5 py-3">
            <h2 className="font-semibold text-white">
              Alunos{" "}
              <span className="text-sm font-normal text-slate-500">
                ({alunos.length})
              </span>
            </h2>
          </div>
          <ul className="max-h-[420px] divide-y divide-ink-700/70 overflow-auto">
            {alunos.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => setSelecionadoId(a.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition",
                    selecionadoId === a.id
                      ? "bg-volt-500/10"
                      : "hover:bg-ink-700/40"
                  )}
                >
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-ink-600">
                    {a.foto_perfil_url ? (
                      <Image
                        src={a.foto_perfil_url}
                        alt={a.nome}
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
                    <p className="truncate text-sm font-medium text-white">
                      {a.nome}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {a.matricula_codigo}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "chip text-[10px]",
                      badgeStatusMatricula(a.status_matricula)
                    )}
                  >
                    {a.status_matricula}
                  </span>
                </button>
              </li>
            ))}
          </ul>
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
            <form onSubmit={salvarTreino} className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome do treino">
                  <input
                    value={nomeTreino}
                    onChange={(e) => setNomeTreino(e.target.value)}
                    placeholder="Ex: Treino A - Peito e Tríceps"
                    className="inp"
                  />
                </Field>
                <Field label="Objetivo">
                  <div className="relative">
                    <Target className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      value={objetivo}
                      onChange={(e) => setObjetivo(e.target.value)}
                      placeholder="Ex: Hipertrofia"
                      className="inp pl-9"
                    />
                  </div>
                </Field>
              </div>

              {/* Linhas de exercício */}
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
                          onChange={(e) =>
                            setEx(i, { nome_exercicio: e.target.value })
                          }
                          placeholder="Nome do exercício"
                          className="inp"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <Field label="Séries">
                            <input
                              type="number"
                              min={0}
                              value={ex.series}
                              onChange={(e) =>
                                setEx(i, { series: Number(e.target.value) })
                              }
                              className="inp"
                            />
                          </Field>
                          <Field label="Reps">
                            <input
                              value={ex.repeticoes}
                              onChange={(e) =>
                                setEx(i, { repeticoes: e.target.value })
                              }
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
                              onChange={(e) =>
                                setEx(i, { carga_kg: Number(e.target.value) })
                              }
                              className="inp"
                            />
                          </Field>
                        </div>
                      </div>

                      {/* Upload da imagem real do equipamento/movimento */}
                      <ImageUpload
                        value={ex.imagem_demonstracao_url}
                        onChange={(url) =>
                          setEx(i, { imagem_demonstracao_url: url })
                        }
                        aspect="aspect-[4/3]"
                        hint="Imagem do equipamento"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addLinhaEx}
                className="btn-ghost w-full"
              >
                <Plus className="h-4 w-4" /> Adicionar exercício
              </button>

              <button type="submit" className="btn-volt w-full">
                <Dumbbell className="h-4 w-4" /> Salvar ficha de treino
              </button>
            </form>
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
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-white">{t.nome_treino}</p>
                      {t.objetivo && (
                        <span className="chip border-magenta-500/30 bg-magenta-500/10 text-magenta-400">
                          {t.objetivo}
                        </span>
                      )}
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
 * local (convertido para data URL apenas na demonstração — em produção, envie
 * para o Supabase Storage). A imagem é exibida em seu estado nativo (sem
 * filtros) e sem retângulos de fundo desnecessários.
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
