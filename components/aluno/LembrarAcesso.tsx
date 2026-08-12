"use client";

import { useEffect } from "react";
import { lembrarAcesso } from "@/lib/aluno-dispositivo";

/**
 * Guarda, neste aparelho, o acesso do aluno (slug + token do link pessoal).
 * Assim, quando ele abrir o app instalado pelo ícone, a tela inicial (/inicio)
 * o leva direto para a área dele — sem login e sem e-mail. Não renderiza nada.
 *
 * Roda em toda página da área do aluno, então um token regenerado passa a ser
 * lembrado automaticamente na próxima visita pelo link novo.
 */
export default function LembrarAcesso({
  slug,
  token,
}: {
  slug: string;
  token: string;
}) {
  useEffect(() => {
    lembrarAcesso({ slug, token });
  }, [slug, token]);

  return null;
}
