"use client";

import { useState, useTransition } from "react";
import { Loader2, ShieldCheck, UserRound } from "lucide-react";
import { PAPEIS, Papel, PerfilEquipe } from "@/lib/types";
import { cn } from "@/lib/utils";
import { alterarPapel } from "@/app/painel/[slug]/equipe/actions";

export default function GestaoEquipe({
  slug,
  perfis,
  meuId,
  souDono,
}: {
  slug: string;
  perfis: PerfilEquipe[];
  meuId: string;
  souDono: boolean;
}) {
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {perfis.map((p) => (
          <LinhaMembro
            key={p.id}
            slug={slug}
            perfil={p}
            euMesmo={p.id === meuId}
            souDono={souDono}
          />
        ))}
      </ul>

      <div className="surface rounded-2xl border-dashed p-5 text-sm text-slate-400">
        <p className="font-medium text-white">Adicionar um membro</p>
        <p className="mt-1">
          Novos usuários (recepção, instrutor…) são criados com o script{" "}
          <code className="rounded bg-ink-900 px-1.5 py-0.5 text-xs text-volt-300">
            npm run criar-usuario
          </code>{" "}
          ou pelo painel do Supabase (Authentication → Add user + uma linha em{" "}
          <code className="rounded bg-ink-900 px-1.5 py-0.5 text-xs text-slate-300">
            perfis_admin
          </code>
          ). Depois o papel pode ser ajustado aqui.
        </p>
      </div>
    </div>
  );
}

function LinhaMembro({
  slug,
  perfil,
  euMesmo,
  souDono,
}: {
  slug: string;
  perfil: PerfilEquipe;
  euMesmo: boolean;
  souDono: boolean;
}) {
  const [papel, setPapel] = useState<Papel>(perfil.papel);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const mudar = (novo: Papel) => {
    setErro(null);
    setPapel(novo);
    iniciar(async () => {
      const r = await alterarPapel(slug, perfil.id, novo);
      if (r.erro) {
        setErro(r.erro);
        setPapel(perfil.papel);
      }
    });
  };

  const podeEditar = souDono && !euMesmo;

  return (
    <li className="surface flex flex-wrap items-center gap-3 rounded-2xl p-4">
      <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-ink-700 text-slate-300">
        <UserRound className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">
          {perfil.nome}
          {euMesmo && <span className="ml-2 text-xs text-slate-500">(você)</span>}
        </p>
        <p className="truncate text-xs text-slate-500">{perfil.email}</p>
      </div>

      {podeEditar ? (
        <div className="flex items-center gap-2">
          <select
            value={papel}
            onChange={(e) => mudar(e.target.value as Papel)}
            disabled={pendente}
            className="inp !w-auto !py-2 text-sm"
          >
            {PAPEIS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          {pendente && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        </div>
      ) : (
        <span
          className={cn(
            "chip",
            perfil.papel === "dono"
              ? "border-volt-500/30 bg-volt-500/10 text-volt-300"
              : "border-ink-600 bg-ink-700/60 text-slate-300"
          )}
        >
          <ShieldCheck className="h-3 w-3" />
          {PAPEIS.find((x) => x.value === perfil.papel)?.label}
        </span>
      )}

      {erro && <p className="w-full text-xs text-red-400">{erro}</p>}
    </li>
  );
}
