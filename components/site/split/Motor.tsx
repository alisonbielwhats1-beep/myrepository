"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";
import { iniciarPalco } from "./palco";

type ScrollCraftGlobal = { mount: (root: Element) => unknown };

/**
 * Carrega o engine do scrollcraft (arquivo intacto em /public/scrollcraft) e
 * monta sobre o markup já renderizado no servidor. O engine não gera DOM:
 * lê os atributos data-sc-* da página. Depois dele entra a coreografia
 * própria da landing (palco.ts).
 */
export default function Motor() {
  const montado = useRef(false);

  const montar = useCallback(() => {
    if (montado.current) return;
    const sc = (window as unknown as { ScrollCraft?: ScrollCraftGlobal }).ScrollCraft;
    const root = document.getElementById("ls-root");
    if (!sc || !root) return;
    montado.current = true;
    sc.mount(root);
    iniciarPalco(root);
  }, []);

  useEffect(() => {
    montar();
  }, [montar]);

  return <Script src="/scrollcraft/scrollcraft.js" strategy="afterInteractive" onReady={montar} />;
}
