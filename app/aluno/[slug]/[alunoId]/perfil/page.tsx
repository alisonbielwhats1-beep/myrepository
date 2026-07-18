import Image from "next/image";
import { BadgeCheck, CreditCard, Ruler, ShieldCheck } from "lucide-react";
import { GraficoProgressoPeso } from "@/components/painel/DashboardCharts";
import { requireFichaAluno } from "@/lib/aluno-publico";
import { badgeStatusMatricula, cn } from "@/lib/utils";

export default async function PerfilPage({
  params,
}: {
  params: { slug: string; alunoId: string };
}) {
  const ficha = await requireFichaAluno(params.slug, params.alunoId);
  const { aluno, progresso } = ficha;

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

      {/* Evolução */}
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

      <p className="px-1 text-center text-xs text-slate-500">
        Para atualizar seus dados de contato, fale com a recepção da
        academia.
      </p>
    </div>
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
