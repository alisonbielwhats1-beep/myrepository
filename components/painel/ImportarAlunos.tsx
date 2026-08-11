"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import {
  analisarPlanilha,
  CABECALHO_MODELO,
  type ResultadoAnalise,
} from "@/lib/importar-alunos";
import { importarAlunos, type ResultadoImportacao } from "@/app/painel/[slug]/alunos/actions";

/**
 * Importação de alunos em massa (CSV). A pré-visualização usa a MESMA função
 * pura do servidor (analisarPlanilha) — o que você vê é o que vai gravar. O
 * servidor sempre revalida ao importar; o preview é só UX.
 */
export default function ImportarAlunos({
  slug,
  planos,
}: {
  slug: string;
  planos: { id: string; nome: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [previa, setPrevia] = useState<ResultadoAnalise | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const acao = importarAlunos.bind(null, slug);
  const [resultado, formAction] = useFormState<ResultadoImportacao, FormData>(acao, {});

  const baixarModelo = () => {
    const exemplo =
      "João da Silva,12345678901,11999998888,joao@email.com,Mensal,10,ativa";
    const csv = `${CABECALHO_MODELO.join(",")}\n${exemplo}\n`;
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-importar-alunos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const aoEscolherArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNomeArquivo(file.name);
    const texto = await file.text();
    setPrevia(analisarPlanilha(texto, planos));
  };

  const limpar = () => {
    setNomeArquivo(null);
    setPrevia(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const concluido = resultado.savedAt != null && resultado.criados != null;

  return (
    <div>
      {!aberto ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="btn-ghost"
        >
          <FileUp className="h-4 w-4" /> Importar planilha
        </button>
      ) : (
        <div className="surface space-y-4 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Importar alunos (planilha)</h2>
              <p className="text-sm text-slate-400">
                Baixe o modelo, preencha no Excel/Google Sheets, salve como CSV e envie.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAberto(false);
                limpar();
              }}
              className="text-slate-500 hover:text-slate-300"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <button type="button" onClick={baixarModelo} className="btn-ghost">
            <Download className="h-4 w-4" /> Baixar modelo
          </button>

          <form action={formAction} className="space-y-4">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-ink-600 bg-ink-800/50 px-4 py-3 text-sm text-slate-300 hover:border-ink-500">
              <Upload className="h-4 w-4 text-volt-300" />
              {nomeArquivo ?? "Escolher arquivo CSV"}
              <input
                ref={inputRef}
                type="file"
                name="arquivo"
                accept=".csv,text/csv"
                onChange={aoEscolherArquivo}
                className="hidden"
              />
            </label>

            {/* Pré-visualização (antes de gravar) */}
            {previa && !concluido && (
              <div className="space-y-2 rounded-xl border border-ink-600 bg-ink-800/40 p-3">
                <p className="text-sm text-white">
                  <span className="font-semibold text-volt-300">{previa.validos.length}</span> aluno(s) prontos
                  {previa.erros.length > 0 && (
                    <>
                      {" · "}
                      <span className="font-semibold text-red-300">{previa.erros.length}</span> com erro
                    </>
                  )}
                  {previa.avisos.length > 0 && (
                    <>
                      {" · "}
                      <span className="font-semibold text-amber-300">{previa.avisos.length}</span> aviso(s)
                    </>
                  )}
                </p>
                <ListaProblemas titulo="Erros (não serão importados)" itens={previa.erros} cor="red" />
                <ListaProblemas titulo="Avisos" itens={previa.avisos} cor="amber" />
              </div>
            )}

            {/* Resultado depois de importar */}
            {concluido && (
              <div className="space-y-2 rounded-xl border border-volt-500/30 bg-volt-500/[0.06] p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-volt-300">
                  <CheckCircle2 className="h-4 w-4" />
                  {resultado.criados} aluno(s) importados
                  {resultado.ignorados ? ` · ${resultado.ignorados} já existiam` : ""}
                </p>
                <ListaProblemas
                  titulo="Linhas com problema"
                  itens={resultado.errosLinha ?? []}
                  cor="red"
                />
              </div>
            )}

            {resultado.erro && !concluido && (
              <p className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                <AlertTriangle className="h-4 w-4 flex-none" />
                {resultado.erro}
              </p>
            )}

            {!concluido ? (
              <BotaoImportar habilitado={!!previa && previa.validos.length > 0} qtd={previa?.validos.length ?? 0} />
            ) : (
              <button
                type="button"
                onClick={() => {
                  limpar();
                  setAberto(false);
                }}
                className="btn-volt"
              >
                Concluir
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

function BotaoImportar({ habilitado, qtd }: { habilitado: boolean; qtd: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={!habilitado || pending} className="btn-volt disabled:opacity-50">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      {pending ? "Importando..." : habilitado ? `Importar ${qtd}` : "Importar"}
    </button>
  );
}

function ListaProblemas({
  titulo,
  itens,
  cor,
}: {
  titulo: string;
  itens: { linha: number; motivo: string }[];
  cor: "red" | "amber";
}) {
  if (itens.length === 0) return null;
  const classe = cor === "red" ? "text-red-300/90" : "text-amber-300/90";
  return (
    <details className="text-xs">
      <summary className={`cursor-pointer font-medium ${classe}`}>
        {titulo} ({itens.length})
      </summary>
      <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-slate-400">
        {itens.slice(0, 100).map((p, i) => (
          <li key={i}>
            {p.linha > 0 ? `Linha ${p.linha}: ` : ""}
            {p.motivo}
          </li>
        ))}
        {itens.length > 100 && <li>… e mais {itens.length - 100}.</li>}
      </ul>
    </details>
  );
}
