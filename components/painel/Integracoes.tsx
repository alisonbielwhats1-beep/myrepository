"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, Dumbbell, RefreshCw, AlertTriangle } from "lucide-react";
import { origemPublica } from "@/lib/site-url";
import {
  rotarSecretIntegracao,
  atualizarStatusIntegracao,
} from "@/app/painel/[slug]/integracoes/actions";
import {
  type StatusIntegracao,
  LABELS_STATUS_INTEGRACAO,
} from "@/lib/types";

const STATUS_OPTIONS: StatusIntegracao[] = [
  "nao_configurada",
  "aguardando_configuracao",
  "aguardando_homologacao",
  "em_testes",
  "ativa",
  "com_erro",
  "desativada",
];

function badgeStatus(status: StatusIntegracao): string {
  switch (status) {
    case "ativa":
      return "bg-volt-500/15 text-volt-300 border-volt-500/30";
    case "em_testes":
      return "bg-sky-500/15 text-sky-300 border-sky-500/30";
    case "com_erro":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    case "aguardando_homologacao":
    case "aguardando_configuracao":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    default:
      return "bg-ink-600/60 text-slate-400 border-ink-500";
  }
}

const DISCLAIMER =
  "Estrutura preparada para integração, sujeita à liberação e homologação da plataforma parceira.";

function CampoCopiavel({ label, valor }: { label: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* clipboard indisponível */
    }
  }

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-xs text-slate-200">
          {valor}
        </code>
        <button
          onClick={copiar}
          className="flex flex-none items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-3 text-xs font-medium text-slate-300 transition hover:bg-ink-700"
          title="Copiar"
        >
          {copiado ? (
            <>
              <Check className="h-4 w-4 text-emerald-400" /> Copiado
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" /> Copiar
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function BlocoParceiro({
  nome,
  cor,
  slug,
  secretMascarado,
  status,
  rota,
  plataforma,
  isDemo = false,
}: {
  nome: string;
  cor: string;
  slug: string;
  secretMascarado: string;
  status: StatusIntegracao;
  rota: string;
  plataforma: "gympass" | "totalpass";
  isDemo?: boolean;
}) {
  const [origem, setOrigem] = useState("");
  const [pendingRotar, startRotar] = useTransition();
  const [pendingStatus, startStatus] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [statusLocal, setStatusLocal] = useState<StatusIntegracao>(status);

  useEffect(() => {
    setOrigem(origemPublica());
  }, []);

  const url = `${origem || "https://SEU-DOMINIO"}/api/webhook/${rota}/${slug}`;

  function rotacionar() {
    if (
      !window.confirm(
        `Gerar novo segredo para ${nome}?\n\nO segredo atual deixará de funcionar imediatamente. Você precisará atualizar o segredo no painel da ${nome} após isso.`
      )
    )
      return;

    setErro(null);
    startRotar(async () => {
      const res = await rotarSecretIntegracao(slug, plataforma);
      if (res.erro) setErro(res.erro);
    });
  }

  function salvarStatus(novoStatus: StatusIntegracao) {
    setStatusLocal(novoStatus);
    setErro(null);
    startStatus(async () => {
      const res = await atualizarStatusIntegracao(slug, plataforma, novoStatus);
      if (res.erro) {
        setErro(res.erro);
        setStatusLocal(status);
      }
    });
  }

  const naoAtiva = statusLocal !== "ativa";

  if (isDemo) {
    return (
      <div className="surface relative space-y-4 rounded-2xl p-5 opacity-60">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${cor}`} />
            <h2 className="text-lg font-semibold text-white">{nome}</h2>
          </div>
          <span className="rounded-full border border-ink-500 bg-ink-600/60 px-2.5 py-0.5 text-[11px] font-medium text-slate-400">
            {LABELS_STATUS_INTEGRACAO[statusLocal]}
          </span>
        </div>
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-ink-900/70">
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300">
            Ação indisponível no ambiente de demonstração.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="surface space-y-4 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${cor}`} />
          <h2 className="text-lg font-semibold text-white">{nome}</h2>
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${badgeStatus(statusLocal)}`}
        >
          {LABELS_STATUS_INTEGRACAO[statusLocal]}
        </span>
      </div>

      {naoAtiva && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2.5 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-400" />
          <span>{DISCLAIMER}</span>
        </div>
      )}

      <CampoCopiavel label="URL do webhook (endpoint)" valor={url} />

      {/* Segredo mascarado — nunca o valor completo */}
      <div>
        <span className="mb-1 block text-xs font-medium text-slate-400">
          Segredo (Bearer token)
        </span>
        {secretMascarado ? (
          <div className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2">
            <code className="flex-1 text-xs tracking-widest text-slate-400">
              {secretMascarado}
            </code>
            <span className="text-[10px] text-slate-500">
              últimos 4 dígitos visíveis
            </span>
          </div>
        ) : (
          <div className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-xs text-slate-500">
            Nenhum segredo configurado — clique em &quot;Gerar novo segredo&quot; para criar.
          </div>
        )}
      </div>

      {/* Status da integração */}
      <div>
        <span className="mb-1 block text-xs font-medium text-slate-400">
          Status da integração
        </span>
        <select
          value={statusLocal}
          onChange={(e) => salvarStatus(e.target.value as StatusIntegracao)}
          disabled={pendingStatus}
          className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-volt-500"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {LABELS_STATUS_INTEGRACAO[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-ink-700 bg-ink-800/50 p-4 text-sm text-slate-300">
        <p className="mb-2 font-medium text-white">Como conectar</p>
        <ol className="list-decimal space-y-1.5 pl-5 text-slate-400">
          <li>
            Confirme que sua academia já tem <strong>contrato ativo</strong> com o {nome}.
          </li>
          <li>
            Entregue ao contato técnico do {nome} a <strong>URL do webhook</strong> acima
            e o <strong>segredo</strong> gerado nesta página.
          </li>
          <li>
            O {nome} deve enviar cada check-in para essa URL com o cabeçalho{" "}
            <code className="rounded bg-ink-900 px-1 py-0.5 text-xs">
              Authorization: Bearer &lt;segredo&gt;
            </code>
            .
          </li>
          <li>
            Cadastre seus alunos com o <strong>mesmo CPF</strong> usado no {nome} — é
            assim que o check-in é vinculado ao aluno automaticamente.
          </li>
        </ol>
      </div>

      {erro && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300">
          {erro}
        </p>
      )}

      <button
        onClick={rotacionar}
        disabled={pendingRotar}
        className="btn-ghost text-xs"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${pendingRotar ? "animate-spin" : ""}`} />
        {pendingRotar ? "Gerando..." : "Gerar novo segredo"}
      </button>
    </div>
  );
}

export default function Integracoes({
  slug,
  gympassSecretMascarado,
  gympassStatus,
  totalpassSecretMascarado,
  totalpassStatus,
  isDemo = false,
}: {
  slug: string;
  gympassSecretMascarado: string;
  gympassStatus: StatusIntegracao;
  totalpassSecretMascarado: string;
  totalpassStatus: StatusIntegracao;
  isDemo?: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-volt-500/20 bg-volt-500/5 p-4 text-sm text-slate-300">
        <div className="flex items-start gap-3">
          <Dumbbell className="mt-0.5 h-5 w-5 flex-none text-volt-300" />
          <div>
            <p className="font-medium text-white">
              Check-in automático de plataformas parceiras
            </p>
            <p className="mt-1 text-slate-400">
              Quando um aluno faz check-in pelo app do Gympass ou TotalPass, o acesso é
              registrado aqui automaticamente. Cada academia tem uma URL e um segredo
              exclusivos — mantenha o segredo em local seguro e não compartilhe publicamente.
            </p>
          </div>
        </div>
      </div>

      <BlocoParceiro
        nome="Gympass"
        cor="bg-orange-400"
        slug={slug}
        secretMascarado={gympassSecretMascarado}
        status={gympassStatus}
        rota="gympass"
        plataforma="gympass"
        isDemo={isDemo}
      />
      <BlocoParceiro
        nome="TotalPass"
        cor="bg-sky-400"
        slug={slug}
        secretMascarado={totalpassSecretMascarado}
        status={totalpassStatus}
        rota="totalpass"
        plataforma="totalpass"
        isDemo={isDemo}
      />
    </div>
  );
}
