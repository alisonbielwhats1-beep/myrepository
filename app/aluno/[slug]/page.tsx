import { notFound } from "next/navigation";
import { CheckCircle2, MapPin, MessageCircle, QrCode } from "lucide-react";
import Logo from "@/components/Logo";
import { getAcademiaPublica, getPlanosPublicos } from "@/lib/data";
import { formatBRL } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MiniSiteAcademia({
  params,
}: {
  params: { slug: string };
}) {
  const academia = await getAcademiaPublica(params.slug);
  if (!academia) notFound();

  const planos = await getPlanosPublicos(params.slug);
  const whatsappDigits = academia.whatsapp?.replace(/\D/g, "");
  const linkWhatsapp = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
        `Olá! Quero saber mais sobre os planos da ${academia.nome_fantasia}.`
      )}`
    : null;

  return (
    <div className="space-y-8 py-2">
      {/* Cabeçalho */}
      <header className="text-center">
        <div className="flex justify-center">
          <Logo showText={false} />
        </div>
        <h1
          className="mt-3 text-2xl font-bold text-white"
          style={{ color: academia.cor_primaria ?? undefined }}
        >
          {academia.nome_fantasia}
        </h1>
        {academia.endereco && (
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-slate-400">
            <MapPin className="h-3.5 w-3.5" /> {academia.endereco}
          </p>
        )}
      </header>

      {/* CTA WhatsApp */}
      {linkWhatsapp && (
        <a
          href={linkWhatsapp}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3.5 font-semibold text-ink-950 shadow-lg transition hover:brightness-95"
        >
          <MessageCircle className="h-5 w-5" /> Falar no WhatsApp
        </a>
      )}

      {/* Planos */}
      {planos.length > 0 && (
        <section>
          <h2 className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-slate-400">
            Nossos planos
          </h2>
          <div className="space-y-3">
            {planos.map((p) => (
              <div key={p.id} className="surface rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{p.nome}</p>
                    {p.descricao && (
                      <p className="mt-1 text-sm text-slate-400">{p.descricao}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-volt-300">
                      {formatBRL(p.valor_mensal)}
                    </p>
                    <p className="text-xs text-slate-500">
                      / {p.recorrencia_meses === 1 ? "mês" : `${p.recorrencia_meses} meses`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {linkWhatsapp && (
            <a
              href={linkWhatsapp}
              target="_blank"
              rel="noreferrer"
              className="btn-volt mt-4 w-full"
            >
              <CheckCircle2 className="h-4 w-4" /> Quero me matricular
            </a>
          )}
        </section>
      )}

      {/* Já é aluno */}
      <div className="surface flex flex-col items-center gap-2 rounded-2xl p-6 text-center">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink-700 text-volt-300">
          <QrCode className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-white">Já é aluno?</p>
        <p className="max-w-xs text-xs text-slate-500">
          Peça à recepção o seu link pessoal de acesso — ele é único para a
          sua matrícula e dá acesso ao QR de entrada e à sua ficha de treino.
        </p>
      </div>
    </div>
  );
}
