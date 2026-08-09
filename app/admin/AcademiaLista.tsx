"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { PlanoSaas } from "@/lib/types";
import PlanoSelect from "./PlanoSelect";
import RemoverAcademiaBtn from "./RemoverAcademiaBtn";
import EditarAcademiaBtn from "./EditarAcademiaBtn";
import CopiarLinkBtn from "./CopiarLinkBtn";

type Dono = { id: string; email: string; papel: string; criado_em: string };

type AcademiaRow = {
  id: string;
  nome_fantasia: string;
  slug_url: string;
  plano_saas: string | null;
  criado_em: string;
  alunos: unknown;
  perfis: unknown;
  donos?: unknown;
  /** null enquanto a migration 056 não estiver aplicada. */
  alunos_ativos?: number | null;
  /** Recomendação de leitura, nunca aplicada automaticamente (migration 056). */
  faixa_sugerida?: string | null;
};

/** Escolhe o login "principal" da academia: papel 'dono' e mais antigo. */
function emailDoDono(donos: unknown): string {
  const lista = (donos as Dono[] | null) ?? [];
  if (lista.length === 0) return "";
  const ordenada = [...lista].sort((a, b) => {
    if (a.papel !== b.papel) return a.papel === "dono" ? -1 : b.papel === "dono" ? 1 : 0;
    return (a.criado_em ?? "").localeCompare(b.criado_em ?? "");
  });
  return ordenada[0]?.email ?? "";
}

export default function AcademiaLista({ academias }: { academias: AcademiaRow[] }) {
  const [busca, setBusca] = useState("");

  // A coluna de faixa comercial só existe depois que a migration 056 é
  // aplicada. Sem ela, a tabela fica exatamente como era antes.
  const temFaixas = academias.some((a) => a.faixa_sugerida != null);

  const filtradas = busca
    ? academias.filter(
        (a) =>
          a.nome_fantasia.toLowerCase().includes(busca.toLowerCase()) ||
          a.slug_url.toLowerCase().includes(busca.toLowerCase())
      )
    : academias;

  return (
    <div className="surface overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-700 px-5 py-4">
        <h2 className="font-semibold text-white">
          Todas as academias{" "}
          <span className="ml-1 text-sm font-normal text-slate-500">
            ({filtradas.length})
          </span>
        </h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou slug..."
            className="w-56 rounded-lg border border-ink-600 bg-ink-800 py-1.5 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-volt-400"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3 font-medium">Academia</th>
              <th className="px-5 py-3 font-medium">Slug</th>
              <th className="px-5 py-3 font-medium">Alunos</th>
              <th className="px-5 py-3 font-medium">Usuários</th>
              <th className="px-5 py-3 font-medium">Cadastro</th>
              <th className="px-5 py-3 font-medium">Plano</th>
              {temFaixas && (
                <th className="px-5 py-3 font-medium">Faixa sugerida</th>
              )}
              <th className="px-5 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700/70">
            {filtradas.length === 0 && (
              <tr>
                <td
                  colSpan={temFaixas ? 8 : 7}
                  className="px-5 py-10 text-center text-slate-500"
                >
                  {busca
                    ? `Nenhuma academia encontrada para "${busca}".`
                    : "Nenhuma academia cadastrada."}
                </td>
              </tr>
            )}
            {filtradas.map((a) => {
              const plano = (a.plano_saas ?? "profissional") as PlanoSaas;
              const totalAlunos =
                (a.alunos as { count: number }[])?.[0]?.count ?? 0;
              const totalPerfis =
                (a.perfis as { count: number }[])?.[0]?.count ?? 0;
              return (
                <tr key={a.id} className="hover:bg-ink-700/30">
                  <td className="px-5 py-3 font-medium text-white">
                    {a.nome_fantasia}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-400">
                    {a.slug_url}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-slate-300">
                    {totalAlunos}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-slate-300">
                    {totalPerfis}
                  </td>
                  <td className="px-5 py-3 text-slate-400">
                    {new Date(a.criado_em).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-5 py-3">
                    <PlanoSelect academiaId={a.id} planoAtual={plano} />
                  </td>
                  {temFaixas && (
                    <td className="px-5 py-3">
                      {/* Somente leitura: sugestão para a conversa comercial.
                          Mudar de faixa é decisão humana, nunca automática. */}
                      <span className="text-xs text-slate-400">
                        {a.faixa_sugerida ?? "—"}
                      </span>
                      {a.alunos_ativos != null && (
                        <span className="mt-0.5 block text-[11px] tabular-nums text-slate-600">
                          {a.alunos_ativos} ativo
                          {a.alunos_ativos === 1 ? "" : "s"}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <CopiarLinkBtn slug={a.slug_url} />
                      <EditarAcademiaBtn
                        academiaId={a.id}
                        nome={a.nome_fantasia}
                        emailAtual={emailDoDono(a.donos)}
                      />
                      <RemoverAcademiaBtn
                        academiaId={a.id}
                        nome={a.nome_fantasia}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
