/**
 * Crédito da licença CC BY-SA 4.0 dos clipes de demonstração vindos do
 * catálogo padrão (ver migration 054) — originais de wger.de, autor Goulart.
 * Só aparece quando a lista realmente tem algum vídeo dessa origem; clipes
 * gravados pelo próprio professor (VideoUpload, Storage do Supabase) não
 * precisam de crédito e não acionam este aviso.
 */
export default function CreditoVideosExercicios({
  exercicios,
}: {
  exercicios: Array<{ video_demonstracao_url: string | null }>;
}) {
  const usaCatalogo = exercicios.some((ex) =>
    ex.video_demonstracao_url?.startsWith("/videos/catalogo/")
  );
  if (!usaCatalogo) return null;

  return (
    <p className="text-center text-[11px] text-slate-600">
      Vídeos de demonstração: Goulart, via{" "}
      <a
        href="https://wger.de"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-slate-400"
      >
        wger.de
      </a>
      , licença{" "}
      <a
        href="https://creativecommons.org/licenses/by-sa/4.0/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-slate-400"
      >
        CC BY-SA 4.0
      </a>
      .
    </p>
  );
}
