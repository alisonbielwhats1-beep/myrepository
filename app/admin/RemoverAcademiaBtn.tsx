"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { removerAcademia } from "./actions";

/**
 * Exclusão de academia com duas travas, porque é irreversível e apaga tudo
 * (alunos, financeiro, logins da equipe):
 *   1. digitar o NOME EXATO da academia — obriga a conferir o alvo;
 *   2. digitar a SENHA de login do admin — conferida no servidor.
 * Só com as duas o botão final libera.
 */
export default function RemoverAcademiaBtn({
  academiaId,
  nome,
}: {
  academiaId: string;
  nome: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [nomeDigitado, setNomeDigitado] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const nomeConfere = nomeDigitado.trim() === nome.trim();
  const podeExcluir = nomeConfere && senha.length > 0 && !pending;

  function fechar() {
    setAberto(false);
    setNomeDigitado("");
    setSenha("");
    setErro(null);
  }

  function handleExcluir() {
    setErro(null);
    start(async () => {
      const r = await removerAcademia(academiaId, nomeDigitado, senha);
      if (r.erro) {
        setErro(r.erro);
        setSenha(""); // senha errada não fica na tela
      }
      // Em sucesso a lista revalida e a linha some — não precisa fechar à mão.
    });
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="rounded p-1.5 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
        title="Excluir academia"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-ink-900 p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </span>
            <h3 className="font-bold text-white">Excluir academia</h3>
          </div>
          <button
            onClick={fechar}
            disabled={pending}
            className="text-slate-500 hover:text-white disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-sm text-slate-300">
          Isto apaga <strong className="text-white">{nome}</strong> e{" "}
          <strong className="text-red-300">tudo dela</strong> — alunos, financeiro,
          treinos e os acessos da equipe. <strong>Não tem como desfazer.</strong>
        </p>

        {erro && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {erro}
          </div>
        )}

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Digite o nome da academia para confirmar
          </span>
          <input
            value={nomeDigitado}
            onChange={(e) => setNomeDigitado(e.target.value)}
            placeholder={nome}
            autoComplete="off"
            className="inp"
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Sua senha de login
          </span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            className="inp"
          />
        </label>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={fechar}
            disabled={pending}
            className="btn-ghost"
          >
            Cancelar
          </button>
          <button
            onClick={handleExcluir}
            disabled={!podeExcluir}
            className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Excluir definitivamente
          </button>
        </div>
      </div>
    </div>
  );
}
