import { cache } from "react";
import { notFound } from "next/navigation";
import { getFichaAlunoPublica } from "./data";
import { FichaAlunoPublica } from "./types";

/**
 * Busca a ficha pública do aluno (cacheada por requisição) e garante que ela
 * pertence à academia da URL — evita que um link de outra academia funcione
 * aqui por engano.
 */
export const requireFichaAluno = cache(
  async (slug: string, alunoId: string): Promise<FichaAlunoPublica> => {
    const ficha = await getFichaAlunoPublica(alunoId);
    if (!ficha || ficha.academia.slug_url !== slug) notFound();
    return ficha;
  }
);
