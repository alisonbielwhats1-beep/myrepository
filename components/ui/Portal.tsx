"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renderiza os filhos direto em <body>, fora da árvore do componente que os
 * criou.
 *
 * POR QUE ISSO É NECESSÁRIO
 *   `position: fixed` se ancora na viewport — MENOS quando algum ancestral
 *   cria um bloco de contenção. `transform`, `filter`, `perspective`,
 *   `contain` e `backdrop-filter` fazem isso. E a classe `.surface`
 *   (app/globals.css) tem `backdrop-blur-sm`, ou seja
 *   `backdrop-filter: blur(4px)` — ela é a superfície de card padrão do
 *   painel inteiro.
 *
 *   Resultado: qualquer modal `fixed inset-0` renderizado dentro de um card
 *   deixa de cobrir a tela e passa a ficar preso ao card, cortado. Foi o que
 *   aconteceu com a câmera dentro da ficha do aluno: o overlay saía com
 *   936x118 px no canto, em vez dos 1366x768 da tela.
 *
 *   Sair para o <body> resolve na raiz e é imune a qualquer ancestral novo
 *   que venha a usar transform/filter/blur no futuro.
 *
 * SSR: o portal só monta no cliente (document não existe no servidor), por
 * isso o estado `montado` — no primeiro render devolve null.
 */
export default function Portal({ children }: { children: React.ReactNode }) {
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  if (!montado) return null;
  return createPortal(children, document.body);
}
