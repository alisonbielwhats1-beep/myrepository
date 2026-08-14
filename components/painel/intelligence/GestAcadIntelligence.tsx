"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  Loader2,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  IntelligenceAnswer,
  IntelligenceDelta,
} from "@/lib/intelligence/types";
import { cn } from "@/lib/utils";

type Message =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; answer: IntelligenceAnswer }
  | { id: number; role: "error"; text: string };

const DEFAULT_SUGGESTIONS = [
  "Quem está sumido?",
  "Como está meu financeiro?",
  "Quem está devendo?",
  "Movimento de hoje",
];

function suggestionsForPath(pathname: string): string[] {
  if (pathname.includes("/financeiro")) {
    return [
      "Quanto faturei este mês?",
      "Quem está devendo?",
      "Compare este mês com o mês passado",
    ];
  }
  if (pathname.includes("/alunos") || pathname.includes("/retencao")) {
    return [
      "Quem está sumido?",
      "Quantos novos alunos entraram este mês?",
      "Quais planos vencem nos próximos 7 dias?",
    ];
  }
  if (pathname.includes("/recepcao")) {
    return [
      "Quantos check-ins tivemos hoje?",
      "Qual foi o horário de pico hoje?",
      "Quantos check-ins tivemos ontem?",
    ];
  }
  return DEFAULT_SUGGESTIONS;
}

function deltaClass(delta: IntelligenceDelta): string {
  if (delta.sentiment === "positive") return "text-volt-300";
  if (delta.sentiment === "negative") return "text-red-400";
  return "text-slate-400";
}

function AnswerCard({ answer }: { answer: IntelligenceAnswer }) {
  return (
    <article className="surface overflow-hidden rounded-2xl">
      <div className="border-b border-ink-700/70 px-4 py-3.5">
        <p className="text-sm font-semibold leading-snug text-white">
          {answer.title}
        </p>
        {answer.description && (
          <p className="mt-1 text-sm leading-relaxed text-slate-400">
            {answer.description}
          </p>
        )}
      </div>

      {answer.metrics && answer.metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-px bg-ink-700/70">
          {answer.metrics.map((metric, index) => (
            <div
              key={`${metric.label}-${index}`}
              className={cn(
                "min-w-0 bg-ink-800 px-4 py-3",
                answer.metrics?.length === 1 && "col-span-2"
              )}
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {metric.label}
              </p>
              <p className="mt-1 break-words text-xl font-bold tabular-nums text-white">
                {metric.value}
              </p>
              {(metric.detail || metric.delta) && (
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                  {metric.detail && (
                    <span className="text-slate-500">{metric.detail}</span>
                  )}
                  {metric.delta && (
                    <span className={cn("font-semibold", deltaClass(metric.delta))}>
                      {metric.delta.label}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {answer.items && answer.items.length > 0 && (
        <ul className="divide-y divide-ink-700/70 px-4">
          {answer.items.map((item) => (
            <li key={item.id} className="py-3">
              {item.href ? (
                <Link
                  href={item.href}
                  className="group block rounded-lg focus-visible:outline-none"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white group-hover:text-volt-300">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                        {item.description}
                      </span>
                    </span>
                    <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 flex-none text-slate-600 group-hover:text-volt-300" />
                  </span>
                </Link>
              ) : (
                <>
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {answer.totalItems !== undefined &&
        answer.items &&
        answer.totalItems > answer.items.length && (
          <p className="border-t border-ink-700/70 px-4 py-2 text-[11px] text-slate-500">
            Mostrando {answer.items.length} de {answer.totalItems}
          </p>
        )}

      {answer.notice && (
        <p className="border-t border-ink-700/70 bg-ink-900/40 px-4 py-2.5 text-[11px] leading-relaxed text-slate-500">
          {answer.notice}
        </p>
      )}

      {answer.action && (
        <div className="border-t border-ink-700/70 p-3">
          <Link
            href={answer.action.href}
            className="btn-ghost w-full justify-between px-3 py-2 text-xs"
          >
            {answer.action.label}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </article>
  );
}

export default function GestAcadIntelligence({
  slug,
  academiaName,
  userName,
}: {
  slug: string;
  academiaName: string;
  userName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const sequence = useRef(0);
  const routeSuggestions = useMemo(() => suggestionsForPath(pathname), [pathname]);
  const firstName = userName.trim().split(/\s+/)[0] || userName;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => inputRef.current?.focus(), 60);
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  async function sendQuestion(value: string) {
    const clean = value.trim();
    if (!clean || loading) return;

    const userMessage: Message = {
      id: ++sequence.current,
      role: "user",
      text: clean,
    };
    setMessages((current) => [...current.slice(-18), userMessage]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch(`/api/intelligence/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: clean }),
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        answer?: IntelligenceAnswer;
        error?: string;
      };
      if (!response.ok || !payload.answer) {
        throw new Error(payload.error || "Não foi possível consultar os dados.");
      }
      setMessages((current) => [
        ...current,
        { id: ++sequence.current, role: "assistant", answer: payload.answer! },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: ++sequence.current,
          role: "error",
          text:
            error instanceof Error
              ? error.message
              : "Não foi possível consultar os dados agora.",
        },
      ]);
    } finally {
      setLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendQuestion(question);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendQuestion(question);
    }
  }

  const latestSuggestions = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.answer.suggestions);
  const suggestions =
    latestSuggestions?.role === "assistant"
      ? latestSuggestions.answer.suggestions ?? routeSuggestions
      : routeSuggestions;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-volt-500/30 bg-volt-500/10 px-3 text-xs font-semibold text-volt-300 transition hover:border-volt-500/50 hover:bg-volt-500/15"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Pergunte ao GestAcad</span>
        <span className="sm:hidden">Pergunte</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70]" role="presentation">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-ink-950/45 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-label="Fechar GestAcad Intelligence"
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="gestacad-intelligence-title"
            className="surface-strong absolute inset-y-0 right-0 flex w-full flex-col border-y-0 border-r-0 shadow-2xl sm:w-[420px]"
          >
            <header className="flex-none border-b border-ink-700/80 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2
                    id="gestacad-intelligence-title"
                    className="flex items-center gap-2 text-base font-semibold text-white"
                  >
                    <Sparkles className="h-4 w-4 text-volt-300" /> GestAcad
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Assistente da {academiaName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-ink-700 hover:text-white"
                  aria-label="Fechar assistente"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
              {messages.length === 0 && (
                <div className="space-y-5">
                  <div>
                    <p className="text-lg font-semibold text-white">
                      Olá, {firstName}.
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      O que você gostaria de saber?
                    </p>
                  </div>
                  <div className="space-y-2">
                    {suggestions.slice(0, 4).map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => void sendQuestion(suggestion)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink-700 bg-ink-900/40 px-3.5 py-3 text-left text-sm text-slate-300 transition hover:border-volt-500/30 hover:bg-volt-500/5 hover:text-white"
                      >
                        {suggestion}
                        <ArrowUpRight className="h-3.5 w-3.5 flex-none text-slate-600" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.length > 0 && (
                <div className="space-y-4">
                  {messages.map((message) => {
                    if (message.role === "user") {
                      return (
                        <div key={message.id} className="flex justify-end">
                          <p className="max-w-[86%] rounded-2xl rounded-br-md bg-volt-300 px-3.5 py-2.5 text-sm leading-relaxed text-ink-950">
                            {message.text}
                          </p>
                        </div>
                      );
                    }
                    if (message.role === "error") {
                      return (
                        <p
                          key={message.id}
                          className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
                        >
                          {message.text}
                        </p>
                      );
                    }
                    return <AnswerCard key={message.id} answer={message.answer} />;
                  })}

                  {!loading && suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {suggestions.slice(0, 3).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => void sendQuestion(suggestion)}
                          className="rounded-full border border-ink-600 px-2.5 py-1.5 text-[11px] text-slate-400 transition hover:border-volt-500/40 hover:text-volt-300"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {loading && (
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500" aria-live="polite">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-volt-300" />
                  Consultando dados...
                </div>
              )}
              <div ref={endRef} />
            </div>

            <form
              onSubmit={submit}
              className="flex-none border-t border-ink-700/80 bg-ink-900/80 p-3.5"
            >
              <div className="flex items-end gap-2 rounded-2xl border border-ink-600 bg-ink-950/70 p-2 transition focus-within:border-volt-500/50 focus-within:ring-2 focus-within:ring-volt-500/10">
                <textarea
                  ref={inputRef}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value.slice(0, 300))}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Pergunte ao GestAcad..."
                  className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-slate-600"
                  disabled={loading}
                  aria-label="Pergunte ao GestAcad"
                />
                <button
                  type="submit"
                  disabled={loading || !question.trim()}
                  className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-volt-300 text-ink-950 transition hover:bg-volt-200 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Enviar pergunta"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-slate-600">
                Respostas calculadas a partir dos dados do GestAcad.
              </p>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}

