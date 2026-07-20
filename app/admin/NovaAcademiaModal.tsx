"use client";

import { useRef, useState, useTransition } from "react";
import { X, Loader2, Plus, Eye, EyeOff } from "lucide-react";
import { criarAcademia } from "./actions";

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function NovaAcademiaModal() {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [slug, setSlug] = useState("");
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function abrir() {
    setOpen(true);
    setErro(null);
    setSucesso(null);
    setSlug("");
  }

  function fechar() {
    if (pending) return;
    setOpen(false);
  }

  function handleNome(e: React.ChangeEvent<HTMLInputElement>) {
    setSlug(slugify(e.target.value));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setErro(null);
    setSucesso(null);
    start(async () => {
      const result = await criarAcademia(formData);
      if (result.erro) {
        setErro(result.erro);
      } else {
        setSucesso(`Academia "${formData.get("nome")}" criada com sucesso!`);
        formRef.current?.reset();
        setSlug("");
        setTimeout(() => {
          setOpen(false);
          setSucesso(null);
        }, 2000);
      }
    });
  }

  return (
    <>
      <button onClick={abrir} className="btn-volt flex items-center gap-2 px-4 py-2 text-sm">
        <Plus className="h-4 w-4" />
        Nova Academia
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={fechar}
          />
          <div className="relative w-full max-w-md surface rounded-2xl p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Nova Academia</h2>
              <button onClick={fechar} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              {erro && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {erro}
                </div>
              )}
              {sucesso && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-300">
                  {sucesso}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Nome da academia *
                </label>
                <input
                  name="nome"
                  required
                  onChange={handleNome}
                  placeholder="Academia Exemplo"
                  className="inp w-full"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Slug (URL) *
                </label>
                <input
                  name="slug"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="academia-exemplo"
                  className="inp w-full font-mono text-sm"
                />
                <p className="mt-1 text-xs text-slate-500">
                  /painel/<span className="text-slate-300">{slug || "slug"}</span>
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Nome do responsável
                </label>
                <input
                  name="adminNome"
                  placeholder="João Silva"
                  className="inp w-full"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  E-mail do admin *
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="admin@academia.com"
                  className="inp w-full"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Senha inicial *
                </label>
                <div className="relative">
                  <input
                    name="senha"
                    type={mostrarSenha ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="inp w-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {mostrarSenha ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Telefone
                </label>
                <input
                  name="telefone"
                  type="tel"
                  placeholder="(11) 99999-0000"
                  className="inp w-full"
                />
              </div>

              <button
                type="submit"
                disabled={pending}
                className="btn-volt mt-2 flex w-full items-center justify-center gap-2"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {pending ? "Criando..." : "Criar Academia"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
