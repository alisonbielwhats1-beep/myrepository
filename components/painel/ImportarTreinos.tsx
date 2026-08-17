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
  analisarLinhasTreino,
  gerarModeloTreinoCsv,
  gerarModeloTreinoXlsx,
  linhasDoArquivo,
  type ResultadoAnaliseTreino,
} from "@/lib/importar-treinos";
import {
  importarTreinosBiblioteca,
  type ResultadoImportacaoTreino,
} from "@/app/painel/[slug]/treinos/actions";

/**
 * Importação de treinos-modelo por planilha (.xlsx/.csv). Uma linha por
 * exercício, agrupada por nome de treino. A pré-visualização usa a MESMA função
 * pura do servidor (analisarLinhasTreino) — o que você vê é o que vai gravar.
 */
export default function ImportarTreinos({ slug }: { slug: string }) {
  const [aberto, setAberto] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [previa, setPrevia] = useState<ResultadoAnaliseTreino | null>(null);
  const [erroLeitura, setErroLeitura] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const acao = importarTreinosBiblioteca.bind(null, slug);
  const [resultado, formAction] = useFormState<ResultadoImportacaoTreino, FormData>(acao, {});

  const baixar = (dados: BlobPart, tipo: string, nome: string) => {
    const url = URL.createObjectURL(new Blob([dados], { type: tipo }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  };

  const baixarModeloExcel = () =>
    baixar(
      gerarModeloTreinoXlsx() as unknown as BlobPart,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "modelo-importar-treinos.xlsx"
    );

  const baixarModeloCsv = () =>
    baixar(gerarModeloTreinoCsv(), "text/csv;charset=utf-8", "modelo-importar-treinos.csv");

  const aoEscolherArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNomeArquivo(file.name);
    setErroLeitura(null);
    setPrevia(null);
    try {
      setPrevia(analisarLinhasTreino(await linhasDoArquivo(file)));
    } catch {
      setErroLeitura("Não consegui ler este arquivo. Baixe o modelo em Excel e preencha nele.");
    }
  };

  const limpar = () => {
    setNomeArquivo(null);
    setPrevia(null);
    setErroLeitura(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const concluido = resultado.savedAt != null && resultado.criados != null;
  const totalExercicios = (previa?.treinos ?? []).reduce((s, t) => s + t.exercicios.length, 0);

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="btn-ghost">
        <FileUp className="h-4 w-4" /> Importar planilha
      </button>
    );
  }

  return (
    <div className="surface w-full space-y-4 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-white">Importar treinos (planilha)</h2>
          <p className="text-sm text-slate-400">
            Uma linha por exercício, agrupada por nome de treino. Baixe o modelo,
            preencha no Excel/Google Sheets e envie.
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

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={baixarModeloExcel} className="btn-ghost">
            <Download className="h-4 w-4" /> Baixar modelo (Excel)
          </button>
          <button
            type="button"
            onClick={baixarModeloCsv}
            className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-300"
          >
            ou baixar em CSV
          </button>
        </div>
        <p className="text-xs text-slate-500">
          As colunas <span className="text-slate-400">treino</span> e{" "}
          <span className="text-slate-400">exercicio</span> são obrigatórias.
          Repita o nome do treino em cada linha, ou preencha só na primeira do
          bloco. Cada treino importado nasce <span className="text-slate-400">privado</span>{" "}
          — você compartilha depois.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-ink-600 bg-ink-800/50 px-4 py-3 text-sm text-slate-300 hover:border-ink-500">
          <Upload className="h-4 w-4 text-volt-300" />
          {nomeArquivo ?? "Escolher arquivo (.xlsx ou .csv)"}
          <input
            ref={inputRef}
            type="file"
            name="arquivo"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={aoEscolherArquivo}
            className="hidden"
          />
        </label>

        {erroLeitura && (
          <p className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            <AlertTriangle className="h-4 w-4 flex-none" />
            {erroLeitura}
          </p>
        )}

        {previa && !concluido && (
          <div className="space-y-2 rounded-xl border border-ink-600 bg-ink-800/40 p-3">
            <p className="text-sm text-white">
              <span className="font-semibold text-volt-300">{previa.treinos.length}</span>{" "}
              treino(s) · {totalExercicios} exercício(s)
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
            {previa.treinos.length > 0 && (
              <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs text-slate-400">
                {previa.treinos.slice(0, 50).map((t, i) => (
                  <li key={i} className="truncate">
                    • {t.nome_treino}{" "}
                    <span className="text-slate-600">({t.exercicios.length} ex.)</span>
                  </li>
                ))}
                {previa.treinos.length > 50 && <li>… e mais {previa.treinos.length - 50}.</li>}
              </ul>
            )}
            <ListaProblemas titulo="Erros (não serão importados)" itens={previa.erros} cor="red" />
            <ListaProblemas titulo="Avisos" itens={previa.avisos} cor="amber" />
          </div>
        )}

        {concluido && (
          <div className="space-y-2 rounded-xl border border-volt-500/30 bg-volt-500/[0.06] p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-volt-300">
              <CheckCircle2 className="h-4 w-4" />
              {resultado.criados} treino(s) importados
            </p>
            <ListaProblemas titulo="Linhas com problema" itens={resultado.errosLinha ?? []} cor="red" />
          </div>
        )}

        {resultado.erro && !concluido && (
          <p className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            <AlertTriangle className="h-4 w-4 flex-none" />
            {resultado.erro}
          </p>
        )}

        {!concluido ? (
          <BotaoImportar
            habilitado={!!previa && previa.treinos.length > 0}
            qtd={previa?.treinos.length ?? 0}
          />
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
