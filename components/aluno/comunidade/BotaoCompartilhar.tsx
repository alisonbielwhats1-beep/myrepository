"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

/**
 * Compartilhamento externo (item 5). Usa a Web Share API nativa do aparelho
 * quando disponível (abre WhatsApp, Instagram, etc. pelo próprio sistema) e,
 * quando o navegador suporta, anexa a imagem da publicação. Sem Web Share, cai
 * para copiar o texto + link da imagem para a área de transferência. Nenhuma
 * integração com API do Instagram — só o compartilhamento nativo, como pedido.
 */
export default function BotaoCompartilhar({
  legenda,
  imagemUrl,
  academiaNome,
}: {
  legenda: string | null;
  imagemUrl: string | null;
  academiaNome: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const texto = [legenda?.trim(), `— ${academiaNome}`].filter(Boolean).join("\n\n");

  async function copiarFallback() {
    const conteudo = [texto, imagemUrl].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(conteudo);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* clipboard indisponível — nada a fazer além de silenciar */
    }
  }

  async function compartilhar() {
    if (ocupado) return;
    setOcupado(true);
    try {
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };

      // Tenta anexar a imagem como arquivo, se o navegador suportar.
      if (imagemUrl && typeof nav.share === "function") {
        try {
          const resp = await fetch(imagemUrl);
          const blob = await resp.blob();
          const arquivo = new File([blob], "publicacao.jpg", { type: blob.type });
          if (nav.canShare?.({ files: [arquivo] })) {
            await nav.share({ text: texto, files: [arquivo] });
            return;
          }
        } catch {
          /* segue para o share só-texto abaixo */
        }
      }

      if (typeof nav.share === "function") {
        await nav.share({
          title: academiaNome,
          text: texto,
          url: imagemUrl ?? undefined,
        });
        return;
      }

      await copiarFallback();
    } catch (e) {
      // AbortError = usuário cancelou o compartilhamento; não é erro.
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        await copiarFallback();
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <button
      type="button"
      onClick={compartilhar}
      disabled={ocupado}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition hover:text-slate-200 disabled:opacity-60"
      aria-label="Compartilhar publicação"
    >
      {copiado ? (
        <>
          <Check className="h-4 w-4 text-volt-300" /> Copiado!
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" /> Compartilhar
        </>
      )}
    </button>
  );
}
