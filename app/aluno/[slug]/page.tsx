import { QrCode } from "lucide-react";
import { getAcademiaPublica } from "@/lib/data";

export default async function AlunoSemLink({
  params,
}: {
  params: { slug: string };
}) {
  const academia = await getAcademiaPublica(params.slug);

  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink-800 text-volt-300">
        <QrCode className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-xl font-bold text-white">
        {academia?.nome_fantasia ?? "Academia"}
      </h1>
      <p className="mt-2 max-w-xs text-sm text-slate-400">
        Este link não identifica um aluno. Peça à recepção o seu link pessoal
        de acesso — ele é único para a sua matrícula.
      </p>
    </div>
  );
}
