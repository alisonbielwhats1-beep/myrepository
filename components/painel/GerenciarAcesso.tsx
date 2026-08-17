"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import {
  Check,
  Copy,
  Download,
  Link2,
  Loader2,
  Lock,
  QrCode,
  Users,
  UserCog,
  UsersRound,
  X,
} from "lucide-react";
import type { Treino } from "@/lib/types";
import { nivelDoTreino } from "@/lib/treinos";
import { cn } from "@/lib/utils";
import { origemPublica } from "@/lib/site-url";
import {
  compartilharComInstrutores,
  definirPublicoTreino,
  definirVisibilidadeTreino,
} from "@/app/painel/[slug]/treinos/actions";

type Instrutor = { id: string; nome: string };
type VisInterna = "privado" | "selecionado" | "equipe" | "academia";

/**
 * Diálogo único de "Gerenciar acesso" — consolida, sem mudar nenhuma regra já
 * auditada, os três controles que antes ficavam expostos em botões soltos no
 * card:
 *   • Visibilidade interna (privado / instrutores selecionados / equipe /
 *     academia) — via definirVisibilidadeTreino e compartilharComInstrutores;
 *   • Compartilhamento externo (link público + QR) — via definirPublicoTreino.
 *
 * A separação dos eixos é a mesma da auditoria: "interno" é quem, dentro da
 * academia, enxerga o modelo; "externo" é o link sem login (QR). Por isso um
 * treino pode ser 🔒 privado internamente e 🔗 com link ativo ao mesmo tempo.
 */
export default function GerenciarAcesso({
  slug,
  treino,
  instrutores,
  onClose,
}: {
  slug: string;
  treino: Treino;
  instrutores: Instrutor[];
  onClose: () => void;
}) {
  return createPortal(
    <Dialog
      slug={slug}
      treino={treino}
      instrutores={instrutores}
      onClose={onClose}
    />,
    document.body
  );
}

function Dialog({
  slug,
  treino,
  instrutores,
  onClose,
}: {
  slug: string;
  treino: Treino;
  instrutores: Instrutor[];
  onClose: () => void;
}) {
  const router = useRouter();
  const nivel = nivelDoTreino(treino);
  const inicial: VisInterna =
    nivel === "academia"
      ? "academia"
      : nivel === "equipe"
        ? "equipe"
        : nivel === "selecionado"
          ? "selecionado"
          : "privado";

  const [sel, setSel] = useState<VisInterna>(inicial);
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [carregandoAcl, setCarregandoAcl] = useState(inicial === "selecionado");
  const [salvando, setSalvando] = useState(false);
  const [erroVis, setErroVis] = useState<string | null>(null);
  const [okVis, setOkVis] = useState<string | null>(null);

  // Link externo (independente da visibilidade interna).
  const [publico, setPublico] = useState(treino.publico);
  const [pendPublico, setPendPublico] = useState(false);
  const [erroLink, setErroLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${origemPublica()}/treino/${treino.share_token}`
      : "";

  // Carrega a ACL atual só quando o treino já está em "instrutores selecionados".
  const carregarAcl = useCallback(async () => {
    setCarregandoAcl(true);
    try {
      const r = await fetch(
        `/api/treinos/${encodeURIComponent(slug)}/compartilhamento?treino=${encodeURIComponent(treino.id)}`,
        { cache: "no-store" }
      );
      const corpo = (await r.json()) as { instrutorIds?: string[] };
      setIds(new Set(corpo.instrutorIds ?? []));
    } catch {
      setIds(new Set());
    } finally {
      setCarregandoAcl(false);
    }
  }, [slug, treino.id]);

  useEffect(() => {
    if (inicial === "selecionado") carregarAcl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  // Ao escolher "instrutores selecionados" pela primeira vez, busca a ACL.
  const escolher = (v: VisInterna) => {
    setSel(v);
    setErroVis(null);
    setOkVis(null);
    if (v === "selecionado" && ids.size === 0 && !carregandoAcl) carregarAcl();
  };

  const alternarInstrutor = (id: string) => {
    setIds((prev) => {
      const p = new Set(prev);
      if (p.has(id)) p.delete(id);
      else p.add(id);
      return p;
    });
    setOkVis(null);
  };

  const salvarVisibilidade = async () => {
    setErroVis(null);
    setOkVis(null);
    if (sel === "selecionado" && ids.size === 0) {
      setErroVis("Selecione ao menos um instrutor (ou escolha outra opção).");
      return;
    }
    setSalvando(true);
    const r =
      sel === "selecionado"
        ? await compartilharComInstrutores(slug, treino.id, Array.from(ids))
        : await definirVisibilidadeTreino(slug, treino.id, sel);
    if (r && "erro" in r) {
      setErroVis(r.erro);
    } else {
      setOkVis("Acesso atualizado.");
      router.refresh();
    }
    setSalvando(false);
  };

  const alternarLink = () => {
    const novo = !publico;
    setPublico(novo);
    setErroLink(null);
    setPendPublico(true);
    (async () => {
      const r = await definirPublicoTreino(slug, treino.id, novo);
      if (r && "erro" in r) {
        setPublico(!novo); // reverte: o banco não mudou
        setErroLink(r.erro);
      } else {
        router.refresh();
      }
      setPendPublico(false);
    })();
  };

  const copiar = async () => {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1600);
  };

  const baixarQR = () => {
    const canvas = document.getElementById(
      `qr-acesso-${treino.id}`
    ) as HTMLCanvasElement | null;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `treino-${treino.nome_treino.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  };

  const opcoes: {
    valor: VisInterna;
    titulo: string;
    descricao: string;
    icone: React.ReactNode;
  }[] = [
    {
      valor: "privado",
      titulo: "Somente eu",
      descricao: "Fica na sua lista. Dono e gerente também veem.",
      icone: <Lock className="h-4 w-4" />,
    },
    {
      valor: "selecionado",
      titulo: "Instrutores selecionados",
      descricao: "Só os instrutores que você escolher têm acesso.",
      icone: <UserCog className="h-4 w-4" />,
    },
    {
      valor: "equipe",
      titulo: "Equipe",
      descricao: "Equipe técnica (dono, gerente e instrutores). A recepção não.",
      icone: <UsersRound className="h-4 w-4" />,
    },
    {
      valor: "academia",
      titulo: "Academia",
      descricao: "Todo o time da academia, inclusive a recepção.",
      icone: <Users className="h-4 w-4" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-ink-950/75 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fechar"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-gerenciar-acesso"
        className="surface-strong relative my-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl p-6"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pr-9">
          <h3
            id="titulo-gerenciar-acesso"
            className="text-lg font-semibold text-white"
          >
            Gerenciar acesso
          </h3>
          <p className="mt-1 truncate text-sm text-slate-400">
            {treino.nome_treino}
          </p>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Visibilidade interna                                             */}
        {/* ---------------------------------------------------------------- */}
        <section className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Visibilidade interna
          </h4>
          <div className="mt-2 space-y-2">
            {opcoes.map((op) => {
              const ativo = sel === op.valor;
              return (
                <label
                  key={op.valor}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition",
                    ativo
                      ? "border-volt-500/50 bg-volt-500/5"
                      : "border-ink-600 bg-ink-900/50 hover:border-ink-500"
                  )}
                >
                  <input
                    type="radio"
                    name={`vis-${treino.id}`}
                    checked={ativo}
                    onChange={() => escolher(op.valor)}
                    className="mt-0.5 accent-volt-400"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                      <span className={ativo ? "text-volt-300" : "text-slate-400"}>
                        {op.icone}
                      </span>
                      {op.titulo}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {op.descricao}
                    </span>

                    {op.valor === "selecionado" && ativo && (
                      <span className="mt-3 block">
                        {carregandoAcl ? (
                          <span className="flex items-center gap-2 text-xs text-slate-500">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                            Carregando instrutores...
                          </span>
                        ) : instrutores.length === 0 ? (
                          <span className="text-xs text-slate-500">
                            Nenhum outro instrutor na equipe para selecionar.
                          </span>
                        ) : (
                          <span className="grid max-h-40 gap-1.5 overflow-y-auto pr-1">
                            {instrutores.map((ins) => {
                              const marcado = ids.has(ins.id);
                              return (
                                <span
                                  key={ins.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    alternarInstrutor(ins.id);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      alternarInstrutor(ins.id);
                                    }
                                  }}
                                  className={cn(
                                    "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition",
                                    marcado
                                      ? "border-volt-500/50 bg-volt-500/10 text-white"
                                      : "border-ink-600 bg-ink-800 text-slate-300 hover:border-ink-500"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "grid h-4 w-4 flex-none place-items-center rounded border",
                                      marcado
                                        ? "border-volt-400 bg-volt-400 text-ink-950"
                                        : "border-ink-500"
                                    )}
                                  >
                                    {marcado && <Check className="h-3 w-3" />}
                                  </span>
                                  {ins.nome}
                                </span>
                              );
                            })}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>

          {erroVis && (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {erroVis}
            </p>
          )}
          {okVis && (
            <p className="mt-3 flex items-center gap-2 rounded-lg border border-volt-500/30 bg-volt-500/10 px-3 py-2 text-xs text-volt-200">
              <Check className="h-3.5 w-3.5" /> {okVis}
            </p>
          )}

          <button
            type="button"
            onClick={salvarVisibilidade}
            disabled={salvando}
            className="btn-volt mt-3 w-full"
          >
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {salvando ? "Salvando..." : "Salvar visibilidade"}
          </button>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Compartilhamento externo (link + QR)                             */}
        {/* ---------------------------------------------------------------- */}
        <section className="mt-6 border-t border-ink-700 pt-5">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Link2 className="h-3.5 w-3.5" /> Compartilhamento externo
          </h4>

          <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-900/50 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">Link público / QR</p>
              <p className="text-xs text-slate-500">
                {publico
                  ? "Qualquer pessoa com o link vê os exercícios, sem login."
                  : "Gere um link e QR para quem não tem login ver o treino."}
              </p>
            </div>
            <button
              type="button"
              onClick={alternarLink}
              disabled={pendPublico}
              aria-pressed={publico}
              className={cn(
                "relative h-6 w-11 flex-none rounded-full transition disabled:opacity-60",
                publico ? "bg-volt-400" : "bg-ink-600"
              )}
              title={publico ? "Desativar link" : "Ativar link"}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                  publico ? "left-[22px]" : "left-0.5"
                )}
              />
            </button>
          </div>

          {erroLink && (
            <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {erroLink}
            </p>
          )}

          {publico && (
            <div className="mt-3 flex flex-col items-center gap-3 rounded-xl border border-ink-700 bg-ink-900/40 p-4 sm:flex-row sm:items-start">
              <div className="rounded-xl bg-white p-3">
                <QRCodeCanvas
                  id={`qr-acesso-${treino.id}`}
                  value={url}
                  size={132}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <div className="flex w-full flex-col gap-2">
                <div className="truncate rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-xs text-slate-400">
                  {url}
                </div>
                <div className="flex gap-2">
                  <button onClick={copiar} className="btn-ghost flex-1">
                    {copiado ? (
                      <Check className="h-4 w-4 text-volt-300" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copiado ? "Copiado!" : "Copiar link"}
                  </button>
                  <button onClick={baixarQR} className="btn-ghost flex-1">
                    <Download className="h-4 w-4" /> Baixar QR
                  </button>
                </div>
              </div>
            </div>
          )}
          {!publico && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
              <QrCode className="h-3.5 w-3.5" /> O QR aparece aqui quando o link
              estiver ativo.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
