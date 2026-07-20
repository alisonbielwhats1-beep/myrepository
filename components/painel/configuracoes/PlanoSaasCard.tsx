"use client";

import { Check, Zap } from "lucide-react";
import { PlanoSaas, PLANOS_SAAS, labelPlano } from "@/lib/planos";
import { cn } from "@/lib/utils";

const FEATURES: { label: string; plano: PlanoSaas }[] = [
  { label: "Alunos, treinos e recepção", plano: "basico" },
  { label: "Mini-site público", plano: "basico" },
  { label: "Financeiro (receitas, despesas, DRE)", plano: "profissional" },
  { label: "Funcionários e folha salarial", plano: "profissional" },
  { label: "Múltiplos usuários (equipe)", plano: "profissional" },
  { label: "Retenção e frequência", plano: "profissional" },
  { label: "Loja e controle de estoque", plano: "profissional" },
  { label: "Feedback e NPS", plano: "profissional" },
  { label: "Relatórios e BI", plano: "profissional" },
  { label: "Integrações Gympass e TotalPass", plano: "premium" },
];

const ORDEM: PlanoSaas[] = ["basico", "profissional", "premium"];

function planoMaior(a: PlanoSaas, b: PlanoSaas): boolean {
  return ORDEM.indexOf(a) >= ORDEM.indexOf(b);
}

export default function PlanoSaasCard({
  slug,
  planoAtual,
}: {
  slug: string;
  planoAtual: PlanoSaas;
}) {
  return (
    <div id="plano" className="surface rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-white">Plano atual</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            Você está no plano{" "}
            <span className="font-medium text-white">{labelPlano(planoAtual)}</span>.
          </p>
        </div>
        <span
          className={cn(
            "chip text-sm font-semibold",
            planoAtual === "basico"
              ? "border-slate-600 bg-slate-800 text-slate-300"
              : planoAtual === "profissional"
              ? "border-volt-500/40 bg-volt-500/10 text-volt-300"
              : "border-amber-500/40 bg-amber-500/10 text-amber-300"
          )}
        >
          {labelPlano(planoAtual)}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {PLANOS_SAAS.map((p) => {
          const ativo = p.value === planoAtual;
          const disponivel = planoMaior(p.value, planoAtual);
          return (
            <div
              key={p.value}
              className={cn(
                "rounded-xl border p-4",
                ativo
                  ? "border-volt-500/50 bg-volt-500/10"
                  : "border-ink-600 bg-ink-800/40"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={cn("font-semibold", ativo ? "text-volt-300" : "text-white")}>
                  {p.label}
                </p>
                {ativo && (
                  <span className="chip border-volt-500/30 bg-volt-500/10 text-volt-300 text-[10px]">
                    Atual
                  </span>
                )}
              </div>
              <p className="mt-1 text-lg font-bold text-white">
                R${" "}
                <span className="tabular-nums">
                  {p.preco.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-xs font-normal text-slate-500">/mês</span>
              </p>
              <ul className="mt-3 space-y-1.5">
                {FEATURES.filter(
                  (f) => ORDEM.indexOf(f.plano) <= ORDEM.indexOf(p.value)
                ).map((f) => (
                  <li key={f.label} className="flex items-start gap-1.5 text-xs text-slate-400">
                    <Check className="mt-0.5 h-3 w-3 flex-none text-volt-400" />
                    {f.label}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {planoAtual !== "premium" && (
        <p className="mt-4 text-center text-xs text-slate-500">
          Para fazer upgrade, entre em contato pelo WhatsApp ou e-mail.{" "}
          <span className="text-volt-400">Cancele quando quiser.</span>
        </p>
      )}
    </div>
  );
}
