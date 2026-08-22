"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Cake,
  Check,
  CheckCheck,
  Clock,
  Flag,
  MessageCircle,
  MessageSquare,
  PackageX,
  UserX,
  X,
} from "lucide-react";
import {
  dispensarNotificacao,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
} from "@/app/painel/[slug]/notificacoes/actions";
import {
  CategoriaNotificacao,
  Notificacao,
  TipoNotificacao,
} from "@/lib/notificacoes";
import { linkWhats, mensagemAniversario, mensagemAusencia, mensagemPendenciaMensalidade } from "@/lib/whats";
import { formatDataHora } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Papel } from "@/lib/types";
import { podeAcessar, Secao } from "@/lib/permissoes";

/**
 * Seção que "dono" da categoria — quem não tem acesso à seção não vê o
 * alerta, mesmo que ele exista (mesma filosofia do sino antigo, que já
 * escondia "inadimplentes" de quem não via Financeiro). `null` = visível a
 * qualquer papel com acesso ao painel (aniversário não é dado sensível).
 */
const SECAO_DA_CATEGORIA: Record<CategoriaNotificacao, Secao | null> = {
  mensalidade: "financeiro",
  acesso: "recepcao",
  retencao: "retencao",
  estoque: "loja",
  sistema: null,
  comunidade: "comunidade",
};

const ICONE_POR_TIPO: Record<TipoNotificacao, typeof Bell> = {
  mensalidade_vencendo: Clock,
  mensalidade_atrasada: AlertTriangle,
  plano_vencimento: Clock,
  aluno_ausente: UserX,
  aniversario: Cake,
  estoque_baixo: PackageX,
  comunidade_denuncia: Flag,
};

const COR_POR_PRIORIDADE: Record<Notificacao["prioridade"], string> = {
  alta: "text-magenta-400",
  media: "text-amber-300",
  baixa: "text-slate-400",
};

const LABEL_CATEGORIA: Record<CategoriaNotificacao, string> = {
  mensalidade: "Mensalidade",
  acesso: "Acesso",
  retencao: "Retenção",
  estoque: "Estoque",
  sistema: "Sistema",
  comunidade: "Comunidade",
};

/** Para onde o link "abrir" da notificação leva — reaproveita telas já existentes, sem página nova. */
function hrefDaNotificacao(slug: string, n: Notificacao): string | null {
  if (n.entidade === "mensalidade" && n.metadados?.aluno_id) {
    return `/painel/${slug}/financeiro/receitas?aluno=${n.metadados.aluno_id}`;
  }
  if (n.entidade === "aluno" && n.alunoNome) {
    // Sem seleção por id na tela de alunos (de propósito, ver GestaoAlunos —
    // nunca troca a seleção sozinha); a busca já existente chega no aluno.
    return `/painel/${slug}/alunos?q=${encodeURIComponent(n.alunoNome)}`;
  }
  if (n.entidade === "produto") {
    return `/painel/${slug}/loja`;
  }
  if (n.categoria === "comunidade") {
    // Denúncia de post → tela de Moderação da comunidade.
    return `/painel/${slug}/comunidade`;
  }
  return null;
}

/** Mensagem de WhatsApp por tipo — só para os tipos com contato ao aluno; nunca inclui valor/token. */
function mensagemWhatsApp(n: Notificacao, academiaNome: string): string | null {
  if (!n.alunoNome) return null;
  switch (n.tipo) {
    case "mensalidade_vencendo":
    case "mensalidade_atrasada":
      return mensagemPendenciaMensalidade(n.alunoNome);
    case "aluno_ausente":
      return mensagemAusencia(n.alunoNome, academiaNome, n.metadados?.dias ?? 0);
    case "aniversario":
      return mensagemAniversario(n.alunoNome, academiaNome);
    default:
      return null;
  }
}

export default function NotificationBell({
  slug,
  papel,
  academiaNome,
  isDemo,
  notificacoes,
  naoLidasTotal,
  feedbackNovo,
}: {
  slug: string;
  papel: Papel;
  academiaNome: string;
  isDemo: boolean;
  notificacoes: Notificacao[];
  /** COUNT do servidor — pode ser maior que `notificacoes.length` (lista limitada). */
  naoLidasTotal: number;
  feedbackNovo: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [itensBrutos, setItensBrutos] = useState(notificacoes);
  const [filtro, setFiltro] = useState<CategoriaNotificacao | "todas">("todas");
  // Quantas o usuário tirou do "não lidas" nesta sessão (marcar lida/dispensar).
  // O badge é `naoLidasTotal - lidasLocalmente` porque o total vem do servidor
  // e não se recalcula sozinho a cada clique.
  const [lidasLocalmente, setLidasLocalmente] = useState(0);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Sincroniza com o servidor sempre que a prop mudar (nova geração diária,
  // revalidatePath de outra aba) — mesma lição do bug do QR: nunca confiar só
  // no estado local depois da primeira montagem.
  useEffect(() => setItensBrutos(notificacoes), [notificacoes]);

  // Chegou contagem nova do servidor: o ajuste local já está refletido nela.
  useEffect(() => setLidasLocalmente(0), [naoLidasTotal]);

  // Filtra por permissão ANTES de qualquer outra coisa (contagem, filtro de
  // categoria, lista) — quem não vê Financeiro nunca deve nem contar um
  // alerta de mensalidade no número do sino.
  const itens = itensBrutos.filter((n) => {
    const secao = SECAO_DA_CATEGORIA[n.categoria];
    return secao === null || podeAcessar(papel, secao);
  });

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const naoLidas =
    Math.max(naoLidasTotal - lidasLocalmente, 0) + feedbackNovo;
  // Só a lista carregada pode ser marcada como lida por "Marcar todas" — o
  // feedback novo vive em outra tabela e não é alcançado por essa ação.
  const temNaoLidasNaLista = itens.some((n) => !n.lida_em);

  const categoriasPresentes = Array.from(
    new Set(itens.map((n) => n.categoria))
  );
  const visiveis = itens.filter(
    (n) => filtro === "todas" || n.categoria === filtro
  );

  function marcarLida(id: string) {
    const estavaNaoLida = itens.some((n) => n.id === id && !n.lida_em);
    setItensBrutos((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida_em: new Date().toISOString() } : n))
    );
    if (estavaNaoLida) setLidasLocalmente((v) => v + 1);
    startTransition(() => {
      marcarNotificacaoLida(slug, id);
    });
  }

  function dispensar(id: string) {
    // Dispensar uma não lida também a remove do contador: deixa de satisfazer
    // "lida_em is null AND dispensada_em is null".
    const estavaNaoLida = itens.some((n) => n.id === id && !n.lida_em);
    setItensBrutos((prev) => prev.filter((n) => n.id !== id));
    if (estavaNaoLida) setLidasLocalmente((v) => v + 1);
    startTransition(() => {
      dispensarNotificacao(slug, id);
    });
  }

  function marcarTodas() {
    const agora = new Date().toISOString();
    // Marca como lidas só as visíveis para este papel — não "consome" o
    // alerta de mensalidade de outra seção que este usuário nem enxerga.
    const idsVisiveis = itens.filter((n) => !n.lida_em).map((n) => n.id);
    setItensBrutos((prev) =>
      prev.map((n) => (idsVisiveis.includes(n.id) ? { ...n, lida_em: agora } : n))
    );
    setLidasLocalmente((v) => v + idsVisiveis.length);
    startTransition(() => {
      marcarTodasNotificacoesLidas(slug, idsVisiveis);
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-ink-600 text-slate-300 transition hover:bg-ink-700"
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5" />
        {naoLidas > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-magenta-500 px-1 text-[11px] font-bold text-white">
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="fixed inset-x-3 top-16 z-50 mx-auto max-h-[75vh] w-auto overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 shadow-card sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
          <div className="flex items-center justify-between border-b border-ink-700 px-3 py-2.5">
            <span className="text-sm font-semibold text-white">Notificações</span>
            <div className="flex items-center gap-1">
              {temNaoLidasNaLista && (
                <button
                  onClick={marcarTodas}
                  title="Marcar todas como lidas"
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-ink-700 hover:text-white"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Marcar todas
                </button>
              )}
              <button
                onClick={() => setAberto(false)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {categoriasPresentes.length > 1 && (
            <div className="flex flex-wrap gap-1.5 border-b border-ink-700 px-3 py-2">
              <button
                onClick={() => setFiltro("todas")}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                  filtro === "todas"
                    ? "bg-volt-500/20 text-volt-300"
                    : "bg-ink-700 text-slate-400 hover:text-slate-200"
                )}
              >
                Todas
              </button>
              {categoriasPresentes.map((c) => (
                <button
                  key={c}
                  onClick={() => setFiltro(c)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                    filtro === c
                      ? "bg-volt-500/20 text-volt-300"
                      : "bg-ink-700 text-slate-400 hover:text-slate-200"
                  )}
                >
                  {LABEL_CATEGORIA[c]}
                </button>
              ))}
            </div>
          )}

          <div className="max-h-[55vh] overflow-y-auto sm:max-h-96">
            {feedbackNovo > 0 && (
              <Link
                href={`/painel/${slug}/feedback`}
                onClick={() => setAberto(false)}
                className="flex items-center gap-3 border-b border-ink-700/70 px-3 py-2.5 transition hover:bg-ink-700/50"
              >
                <MessageSquare className="h-4 w-4 flex-none text-volt-300" />
                <span className="text-sm text-slate-200">
                  {feedbackNovo} feedback(s) novo(s)
                </span>
              </Link>
            )}

            {visiveis.length === 0 && feedbackNovo === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-500">
                Tudo em dia. Nenhuma pendência. 🎉
              </p>
            ) : (
              <ul className="divide-y divide-ink-700/60">
                {visiveis.map((n) => {
                  const Icone = ICONE_POR_TIPO[n.tipo];
                  const href = hrefDaNotificacao(slug, n);
                  const naoLida = !n.lida_em;
                  const whatsTexto = mensagemWhatsApp(n, academiaNome);
                  const whatsHref = whatsTexto
                    ? linkWhats(n.alunoTelefone, whatsTexto, { isDemo })
                    : null;

                  return (
                    <li
                      key={n.id}
                      className={cn(
                        "px-3 py-3 transition",
                        naoLida && "bg-volt-500/[0.04]"
                      )}
                    >
                      <div className="flex gap-2.5">
                        <Icone
                          className={cn("mt-0.5 h-4 w-4 flex-none", COR_POR_PRIORIDADE[n.prioridade])}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn("text-sm", naoLida ? "font-semibold text-white" : "text-slate-300")}>
                              {n.titulo}
                            </p>
                            {naoLida && (
                              <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-volt-400" />
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-400">{n.mensagem}</p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {formatDataHora(n.criado_em)}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {href && (
                              <Link
                                href={href}
                                onClick={() => setAberto(false)}
                                className="text-[11px] font-medium text-volt-300 hover:underline"
                              >
                                Abrir
                              </Link>
                            )}
                            {whatsHref && (
                              <a
                                href={whatsHref}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:underline"
                              >
                                <MessageCircle className="h-3 w-3" /> WhatsApp
                              </a>
                            )}
                            {naoLida && (
                              <button
                                onClick={() => marcarLida(n.id)}
                                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300"
                              >
                                <Check className="h-3 w-3" /> Marcar lida
                              </button>
                            )}
                            <button
                              onClick={() => dispensar(n.id)}
                              className="ml-auto flex items-center gap-1 text-[11px] text-slate-500 hover:text-red-400"
                              title="Dispensar"
                            >
                              <X className="h-3 w-3" /> Dispensar
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
