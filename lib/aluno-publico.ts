import { cache } from "react";
import { notFound } from "next/navigation";
import { getFichaAlunoPublica } from "./data";
import { FichaAlunoPublica } from "./types";
import { fichaPertenceAoSlug } from "./aluno-classificacao";

export * from "./aluno-classificacao";

/**
 * Busca a ficha pública do aluno (cacheada por requisição) pelo token
 * pessoal de acesso (Fase 12 — nunca por aluno_id) e garante que ela pertence
 * à academia da URL — evita que um link de outra academia funcione aqui por
 * engano. A RPC já faz a junção token+slug dentro do banco; a checagem aqui
 * é defesa em profundidade. Qualquer divergência (token inexistente, token
 * de outra academia, token malformado) cai no `notFound()` genérico — nunca
 * revela qual foi o motivo.
 */
export const requireFichaAluno = cache(
  async (slug: string, token: string): Promise<FichaAlunoPublica> => {
    const ficha = await getFichaAlunoPublica(token, slug);
    if (!fichaPertenceAoSlug(ficha, slug)) notFound();
    return ficha as FichaAlunoPublica;
  }
);
