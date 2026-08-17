import { Star } from "lucide-react";
import FeedbackForm from "@/components/aluno/FeedbackForm";
import { requireFichaAluno } from "@/lib/aluno-publico";
import { getFeedbacksDoAluno } from "@/lib/data";
import { FeedbackDoAluno } from "@/lib/types";
import { formatDataDeInstante } from "@/lib/utils";
import { enviarFeedback } from "@/app/aluno/[slug]/[token]/actions";

export const dynamic = "force-dynamic";

export default async function AlunoFeedbackPage({
  params,
}: {
  params: { slug: string; token: string };
}) {
  await requireFichaAluno(params.slug, params.token);

  // A RPC só existe depois da migration 057. Enquanto não for aplicada, a
  // página segue funcionando como antes (só o formulário de envio).
  let enviados: FeedbackDoAluno[] = [];
  try {
    enviados = await getFeedbacksDoAluno(params.token, params.slug);
  } catch {
    enviados = [];
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-slate-400">Sua opinião importa</p>
        <h1 className="text-2xl font-bold text-white">Feedback</h1>
      </header>

      <FeedbackForm enviar={enviarFeedback.bind(null, params.slug, params.token)} />

      {enviados.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white">
            O que você já enviou
          </h2>
          <ul className="space-y-3">
            {enviados.map((f) => (
              <li key={f.id} className="surface rounded-2xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={
                          f.nota >= n
                            ? "h-3.5 w-3.5 fill-volt-300 text-volt-300"
                            : "h-3.5 w-3.5 text-slate-600"
                        }
                        aria-hidden="true"
                      />
                    ))}
                    <span className="sr-only">{f.nota} de 5</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {formatDataDeInstante(f.criado_em)}
                  </span>
                </div>

                {f.comentario && (
                  <p className="mt-2 text-sm text-slate-300">“{f.comentario}”</p>
                )}

                {f.resposta ? (
                  <div className="mt-3 rounded-xl border border-volt-500/30 bg-volt-500/5 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-volt-400">
                      Resposta da academia
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
                      {f.resposta}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">
                    Ainda sem resposta da academia.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
