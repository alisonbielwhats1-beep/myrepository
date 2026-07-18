import { notFound } from "next/navigation";
import Logo from "@/components/Logo";
import FeedbackForm from "@/components/aluno/FeedbackForm";
import { getAcademiaPublica } from "@/lib/data";
import { enviarFeedbackPublico } from "@/app/aluno/[slug]/feedback/actions";

export const dynamic = "force-dynamic";

export default async function FeedbackPublicoPage({
  params,
}: {
  params: { slug: string };
}) {
  const academia = await getAcademiaPublica(params.slug);
  if (!academia) notFound();

  return (
    <div className="space-y-6 py-2">
      <header className="text-center">
        <div className="flex justify-center">
          <Logo showText={false} />
        </div>
        <h1
          className="mt-3 text-xl font-bold text-white"
          style={{ color: academia.cor_primaria ?? undefined }}
        >
          {academia.nome_fantasia}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Conte pra gente como está sendo a sua experiência.
        </p>
      </header>

      <FeedbackForm enviar={enviarFeedbackPublico.bind(null, params.slug)} />
    </div>
  );
}
