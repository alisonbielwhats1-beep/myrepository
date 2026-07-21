"use client";

import { useState, useTransition } from "react";
import { Pencil, Loader2, X, Check } from "lucide-react";
import { editarLoginAcademia } from "./actions";

export default function EditarAcademiaBtn({
  academiaId,
  nome,
  emailAtual,
}: {
  academiaId: string;
  nome: string;
  emailAtual: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState(emailAtual);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  function abrir() {
    setEmail(emailAtual);
    setSenha("");
    setErro(null);
    setOk(false);
    setAberto(true);
  }

  function salvar() {
    setErro(null);
    setOk(false);
    const fd = new FormData();
    fd.set("email", email);
    fd.set("senha", senha);
    start(async () => {
      const res = await editarLoginAcademia(academiaId, fd);
      if (res.erro) {
        setErro(res.erro);
      } else {
        setOk(true);
        setSenha("");
        setTimeout(() => setAberto(false), 1200);
      }
    });
  }

  return (
    <>
      <button
        onClick={abrir}
        className="rounded p-1.5 text-slate-500 transition-colors hover:bg-volt-500/10 hover:text-volt-300"
        title="Editar login (e-mail e senha)"
      >
        <Pencil className="h-4 w-4" />
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
            onClick={() => !pending && setAberto(false)}
          />
          <div className="surface-strong relative z-10 w-full max-w-md rounded-2xl border p-6">
            <button
              onClick={() => !pending && setAberto(false)}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-semibold text-white">Editar login</h3>
            <p className="mt-1 text-sm text-slate-400">
              Academia <span className="font-medium text-slate-200">{nome}</span>
            </p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">
                  E-mail de acesso
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={pending}
                  className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-volt-400"
                  placeholder="email@academia.com"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">
                  Nova senha{" "}
                  <span className="text-slate-500">
                    (deixe em branco para manter a atual)
                  </span>
                </span>
                <input
                  type="text"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  disabled={pending}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-volt-400"
                  placeholder="mínimo 8 caracteres"
                />
              </label>

              {erro && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {erro}
                </p>
              )}
              {ok && (
                <p className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                  <Check className="h-4 w-4" /> Login atualizado com sucesso.
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setAberto(false)}
                disabled={pending}
                className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={pending}
                className="btn-volt flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
