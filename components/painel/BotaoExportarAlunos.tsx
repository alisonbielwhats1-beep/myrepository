"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { baixarCSV } from "@/lib/csv";
import { exportarAlunosCsv } from "@/app/painel/[slug]/alunos/actions";

/**
 * Botão "Exportar CSV" da lista de alunos. A base é buscada inteira no servidor
 * (a listagem da tela é paginada), e o download é disparado no navegador com o
 * mesmo utilitário do Financeiro (baixarCSV). Sem base carregada, nada a fazer.
 */
export default function BotaoExportarAlunos({
  slug,
  totalAlunos,
}: {
  slug: string;
  totalAlunos: number;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  if (totalAlunos === 0) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErro(null);
            const r = await exportarAlunosCsv(slug);
            if ("erro" in r) {
              setErro(r.erro);
              return;
            }
            baixarCSV(r.nomeArquivo, r.cabecalho, r.linhas);
          })
        }
        className="btn-ghost"
        title="Baixar todos os alunos em CSV (abre no Excel)"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Exportar alunos
      </button>
      {erro && <p className="text-xs text-red-400">{erro}</p>}
    </div>
  );
}
