"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { PlanoSaas } from "@/lib/types";
import { alterarPlano } from "./actions";

export default function PlanoSelect({
  academiaId,
  planoAtual,
  token,
}: {
  academiaId: string;
  planoAtual: PlanoSaas;
  token: string;
}) {
  const [pending, start] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const novoPlano = e.target.value as PlanoSaas;
    start(async () => {
      await alterarPlano(academiaId, novoPlano, token);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        defaultValue={planoAtual}
        onChange={onChange}
        disabled={pending}
        className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-volt-400 disabled:opacity-50"
      >
        <option value="basico">Básico — R$ 29,90</option>
        <option value="profissional">Profissional — R$ 59,90</option>
        <option value="premium">Premium — R$ 99,90</option>
      </select>
      {pending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
    </div>
  );
}
