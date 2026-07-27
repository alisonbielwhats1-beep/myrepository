"use client";

import { useState, useTransition } from "react";
import { Bell, Check } from "lucide-react";
import { atualizarConfiguracoesNotificacoes } from "@/app/painel/[slug]/notificacoes/actions";
import { ConfiguracoesNotificacoes } from "@/lib/notificacoes";
import { cn } from "@/lib/utils";

const CATEGORIAS: {
  campo: keyof Pick<
    ConfiguracoesNotificacoes,
    | "alerta_mensalidade_vencendo"
    | "alerta_mensalidade_atrasada"
    | "alerta_aluno_ausente"
    | "alerta_aniversario"
    | "alerta_estoque_baixo"
  >;
  label: string;
  descricao: string;
}[] = [
  {
    campo: "alerta_mensalidade_vencendo",
    label: "Mensalidade vencendo",
    descricao: "Avisa 7, 3 e 1 dia antes do vencimento.",
  },
  {
    campo: "alerta_mensalidade_atrasada",
    label: "Mensalidade atrasada",
    descricao: "Avisa 1, 3 e 7 dias após o vencimento.",
  },
  {
    campo: "alerta_aluno_ausente",
    label: "Aluno ausente",
    descricao: "Avisa quando um aluno ativo some por muito tempo.",
  },
  {
    campo: "alerta_aniversario",
    label: "Aniversariante do dia",
    descricao: "Avisa no dia do aniversário do aluno.",
  },
  {
    campo: "alerta_estoque_baixo",
    label: "Estoque baixo",
    descricao: "Avisa quando um produto atinge o estoque mínimo.",
  },
];

export default function NotificacoesConfigCard({
  slug,
  configuracoes,
}: {
  slug: string;
  configuracoes: ConfiguracoesNotificacoes;
}) {
  const [config, setConfig] = useState(configuracoes);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function salvar(proximo: ConfiguracoesNotificacoes) {
    setConfig(proximo);
    setSalvo(false);
    setErro(null);
    start(async () => {
      const formData = new FormData();
      for (const { campo } of CATEGORIAS) {
        if (proximo[campo]) formData.set(campo, "on");
      }
      formData.set("aluno_ausente_dias", String(proximo.aluno_ausente_dias));

      const r = await atualizarConfiguracoesNotificacoes(slug, formData);
      if (r.erro) {
        setErro(r.erro);
        return;
      }
      setSalvo(true);
      setTimeout(() => setSalvo(false), 1600);
    });
  }

  return (
    <div className="surface rounded-2xl p-5">
      <h2 className="flex items-center gap-2 font-semibold text-white">
        <Bell className="h-4 w-4 text-volt-300" /> Notificações
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Escolha quais alertas aparecem no sino do painel.
      </p>

      <div className="mt-4 space-y-3">
        {CATEGORIAS.map(({ campo, label, descricao }) => (
          <label
            key={campo}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-600 bg-ink-800/40 p-3 transition hover:border-ink-500"
          >
            <input
              type="checkbox"
              checked={config[campo]}
              onChange={(e) => salvar({ ...config, [campo]: e.target.checked })}
              disabled={pending}
              className="mt-0.5 h-4 w-4 rounded border-ink-500 bg-ink-900 text-volt-400 focus:ring-volt-400/40"
            />
            <div>
              <p className="text-sm font-medium text-white">{label}</p>
              <p className="text-xs text-slate-500">{descricao}</p>
            </div>
          </label>
        ))}

        {config.alerta_aluno_ausente && (
          <div className="ml-1 flex items-center gap-3 pl-3">
            <span className="text-xs text-slate-400">Avisar após</span>
            <div className="flex gap-1.5">
              {([7, 14, 30] as const).map((dias) => (
                <button
                  key={dias}
                  type="button"
                  disabled={pending}
                  onClick={() => salvar({ ...config, aluno_ausente_dias: dias })}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-medium transition disabled:opacity-50",
                    config.aluno_ausente_dias === dias
                      ? "bg-volt-500/20 text-volt-300"
                      : "bg-ink-700 text-slate-400 hover:text-slate-200"
                  )}
                >
                  {dias} dias
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs">
        {salvo && (
          <span className="flex items-center gap-1 text-volt-300">
            <Check className="h-3.5 w-3.5" /> Salvo
          </span>
        )}
        {erro && <span className="text-red-400">{erro}</span>}
      </div>
    </div>
  );
}
