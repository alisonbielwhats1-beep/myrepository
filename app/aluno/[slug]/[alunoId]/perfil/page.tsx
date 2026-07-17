import Image from "next/image";
import { BadgeCheck, CreditCard, ShieldCheck } from "lucide-react";
import { requireFichaAluno } from "@/lib/aluno-publico";
import { badgeStatusMatricula, cn } from "@/lib/utils";

export default async function PerfilPage({
  params,
}: {
  params: { slug: string; alunoId: string };
}) {
  const ficha = await requireFichaAluno(params.slug, params.alunoId);
  const { aluno } = ficha;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-slate-400">Sua conta</p>
        <h1 className="text-2xl font-bold text-white">Perfil</h1>
      </header>

      {/* Card do aluno */}
      <div className="surface rounded-3xl p-6 text-center">
        {aluno.foto_perfil_url && (
          <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-full ring-2 ring-volt-300/50">
            <Image
              src={aluno.foto_perfil_url}
              alt={aluno.nome}
              fill
              sizes="96px"
              className="media-native object-cover"
            />
          </div>
        )}
        <h2 className="mt-4 text-xl font-bold text-white">{aluno.nome}</h2>
        <span
          className={cn(
            "chip mt-2",
            badgeStatusMatricula(aluno.status_matricula)
          )}
        >
          <BadgeCheck className="h-3.5 w-3.5" />
          Matrícula {aluno.status_matricula}
        </span>
      </div>

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

      <p className="px-1 text-center text-xs text-slate-500">
        Para atualizar seus dados de contato, fale com a recepção da
        academia.
      </p>
    </div>
  );
}
