"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { CheckCircle2, Loader2, Send, Star } from "lucide-react";
import { CATEGORIAS_FEEDBACK } from "@/lib/types";
import { cn } from "@/lib/utils";

type EstadoFeedback = { erro?: string; ok?: boolean; savedAt?: number };

export default function FeedbackForm({
  enviar,
}: {
  enviar: (
    estado: EstadoFeedback,
    formData: FormData
  ) => Promise<EstadoFeedback>;
}) {
  const [estado, formAction] = useFormState(enviar, {});
  const [nota, setNota] = useState(0);
  const [hover, setHover] = useState(0);

  if (estado.ok) {
    return (
      <div className="surface flex flex-col items-center gap-2 rounded-2xl p-8 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-volt-500/15 text-volt-300">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <p className="font-semibold text-white">Obrigado pela sua opinião!</p>
        <p className="max-w-xs text-sm text-slate-400">
          Seu feedback foi enviado para a academia e ajuda a melhorar cada vez
          mais.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="surface space-y-4 rounded-2xl p-5">
      <input type="hidden" name="nota" value={nota} />

      {/* Estrelas */}
      <div>
        <span className="mb-2 block text-sm font-medium text-white">
          Como você avalia a academia?
        </span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNota(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
              className="p-1 transition hover:scale-110"
            >
              <Star
                className={cn(
                  "h-8 w-8 transition",
                  (hover || nota) >= n
                    ? "fill-volt-300 text-volt-300"
                    : "text-slate-600"
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-400">
          Sobre o quê?
        </span>
        <select name="categoria" defaultValue="geral" className="inp">
          {CATEGORIAS_FEEDBACK.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-400">
          Comentário (opcional)
        </span>
        <textarea
          name="comentario"
          rows={4}
          placeholder="Conte o que você achou, o que pode melhorar…"
          className="inp"
        />
      </label>

      {estado.erro && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}

      <BotaoEnviar />
    </form>
  );
}

function BotaoEnviar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-volt w-full">
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4" />
      )}
      Enviar avaliação
    </button>
  );
}
