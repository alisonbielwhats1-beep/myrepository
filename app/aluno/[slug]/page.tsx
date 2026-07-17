import Image from "next/image";
import Link from "next/link";
import { CalendarDays, ChevronRight, Dumbbell, Flame } from "lucide-react";
import QRCodeCard from "@/components/aluno/QRCodeCard";
import { getAcademia, getAlunos, getTreinosDoAluno } from "@/lib/data";

export default async function AlunoHome({
  params,
}: {
  params: { slug: string };
}) {
  const academia = await getAcademia(params.slug);
  const alunos = await getAlunos(academia?.id ?? "");
  // No modo demo, o "aluno logado" é o primeiro aluno ativo.
  const aluno = alunos.find((a) => a.status_matricula === "ativa") ?? alunos[0];
  const treinos = aluno ? await getTreinosDoAluno(aluno.id) : [];

  const primeiroNome = aluno?.nome.split(" ")[0] ?? "Atleta";
  const totalExercicios = treinos.reduce(
    (acc, t) => acc + (t.exercicios?.length ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho / saudação */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">
            {academia?.nome_fantasia ?? "Sua academia"}
          </p>
          <h1 className="text-2xl font-bold text-white">Olá, {primeiroNome} 👋</h1>
        </div>
        {aluno?.foto_perfil_url && (
          <div className="relative h-12 w-12 overflow-hidden rounded-full ring-2 ring-volt-300/40">
            <Image
              src={aluno.foto_perfil_url}
              alt={aluno.nome}
              fill
              sizes="48px"
              className="media-native object-cover"
            />
          </div>
        )}
      </header>

      {/* QR de acesso */}
      {aluno && (
        <QRCodeCard
          alunoId={aluno.id}
          academiaSlug={params.slug}
          matriculaCodigo={aluno.matricula_codigo}
        />
      )}

      {/* Resumo rápido */}
      <div className="grid grid-cols-3 gap-3">
        <div className="surface rounded-2xl p-4">
          <Flame className="h-5 w-5 text-magenta-400" />
          <div className="mt-3 stat-value text-2xl">7</div>
          <div className="label-muted">dias seguidos</div>
        </div>
        <div className="surface rounded-2xl p-4">
          <Dumbbell className="h-5 w-5 text-volt-300" />
          <div className="mt-3 stat-value text-2xl">{treinos.length}</div>
          <div className="label-muted">treinos</div>
        </div>
        <div className="surface rounded-2xl p-4">
          <CalendarDays className="h-5 w-5 text-cyanx-400" />
          <div className="mt-3 stat-value text-2xl">{totalExercicios}</div>
          <div className="label-muted">exercícios</div>
        </div>
      </div>

      {/* Atalho para treinos */}
      <Link
        href={`/aluno/${params.slug}/treinos`}
        className="surface flex items-center justify-between rounded-2xl p-4 transition hover:border-ink-500"
      >
        <div>
          <p className="font-semibold text-white">Treino de hoje</p>
          <p className="text-sm text-slate-400">
            {treinos[0]?.nome_treino ?? "Nenhum treino atribuído"}
          </p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-volt-300 text-ink-950">
          <ChevronRight className="h-5 w-5" />
        </span>
      </Link>
    </div>
  );
}
