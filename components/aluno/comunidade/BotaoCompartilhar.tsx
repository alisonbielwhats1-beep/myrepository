"use client";

import { useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";

/**
 * Compartilhamento externo (item 5). Usa a Web Share API nativa do aparelho
 * quando disponível (abre WhatsApp, Instagram, Notas, etc. pelo próprio
 * sistema) e, quando dá, anexa a imagem da publicação. Sem Web Share, cai para
 * copiar o texto + link da imagem para a área de transferência. Nenhuma
 * integração com API do Instagram — só o compartilhamento nativo, como pedido.
 *
 * IMPORTANTE (bug corrigido): `navigator.share()` exige a "ativação transitória"
 * do usuário — o gesto do toque. Qualquer `await` ANTES do `share()` (como um
 * `fetch` da imagem) consome esse gesto e o iOS/Safari recusa com
 * `NotAllowedError`; a folha de compartilhamento nunca abria e o app caía
 * silenciosamente no "copiar", parecendo que o botão não fazia nada.
 *
 * Solução: começamos a baixar a imagem já no `pointerdown` (antes do clique) e
 * guardamos o arquivo pronto. No clique, chamamos `share()` SEM nenhum `await`
 * antes dele — usando o arquivo se já baixou, ou apenas texto + link público da
 * imagem caso contrário. Assim a folha nativa sempre abre.
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
  // Arquivo da imagem já baixado (quando disponível) e a promise em andamento,
  // para não disparar dois downloads.
  const arquivoRef = useRef<File | null>(null);
  const baixandoRef = useRef<Promise<void> | null>(null);

  const texto = [legenda?.trim(), `— ${academiaNome}`].filter(Boolean).join("\n\n");

  /**
   * Baixa a imagem em segundo plano (disparado no pointerdown). Não lança: em
   * caso de falha, o compartilhamento segue só com texto + link.
   */
  function prebaixarImagem() {
    if (!imagemUrl || arquivoRef.current || baixandoRef.current) return;
    baixandoRef.current = (async () => {
      try {
        const resp = await fetch(imagemUrl);
        const blob = await resp.blob();
        arquivoRef.current = new File([blob], "publicacao.jpg", {
          type: blob.type || "image/jpeg",
        });
      } catch {
        /* segue sem imagem anexada */
      }
    })();
  }

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

      if (typeof nav.share !== "function") {
        await copiarFallback();
        return;
      }

      // Usa a imagem só se ela JÁ terminou de baixar (iniciado no pointerdown).
      // Nunca esperamos o download aqui: um `await` antes do share invalidaria o
      // gesto do usuário e o iOS bloquearia o compartilhamento.
      const arquivo = arquivoRef.current;
      if (arquivo && nav.canShare?.({ files: [arquivo] })) {
        await nav.share({ title: academiaNome, text: texto, files: [arquivo] });
        return;
      }

      // Sem arquivo pronto: compartilha texto + link público da imagem. Abre
      // WhatsApp, Notas, etc. de forma confiável em qualquer plataforma.
      await nav.share({
        title: academiaNome,
        text: texto,
        url: imagemUrl ?? undefined,
      });
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
      onPointerDown={prebaixarImagem}
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
