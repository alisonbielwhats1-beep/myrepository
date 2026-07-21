"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Dumbbell } from "lucide-react";

function CampoCopiavel({ label, valor }: { label: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* clipboard indisponível — usuário pode selecionar manualmente */
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
  segredo,
  rota,
}: {
  nome: string;
  cor: string;
  slug: string;
  segredo: string;
  rota: string;
}) {
  const [origem, setOrigem] = useState("");

  useEffect(() => {
    setOrigem(window.location.origin);
  }, []);

  const url = `${origem || "https://SEU-DOMINIO"}/api/webhook/${rota}/${slug}`;

  return (
    <div className="surface space-y-4 rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${cor}`} />
        <h2 className="text-lg font-semibold text-white">{nome}</h2>
      </div>

      <CampoCopiavel label="URL do webhook (endpoint)" valor={url} />
      <CampoCopiavel label="Segredo (token de autenticação)" valor={segredo} />

      <div className="rounded-lg border border-ink-700 bg-ink-800/50 p-4 text-sm text-slate-300">
        <p className="mb-2 font-medium text-white">Como conectar</p>
        <ol className="list-decimal space-y-1.5 pl-5 text-slate-400">
          <li>
            Confirme que sua academia já tem <strong>contrato ativo</strong> com o {nome}.
          </li>
          <li>
            Entregue ao contato técnico do {nome} a <strong>URL do webhook</strong> e o{" "}
            <strong>segredo</strong> acima.
          </li>
          <li>
            O {nome} deve enviar cada check-in para essa URL com o cabeçalho{" "}
            <code className="rounded bg-ink-900 px-1 py-0.5 text-xs">
              Authorization: Bearer &lt;segredo&gt;
            </code>
            .
          </li>
          <li>
            Cadastre seus alunos com o <strong>mesmo CPF</strong> usado no {nome} — é assim que
            o check-in é vinculado ao aluno automaticamente.
          </li>
        </ol>
      </div>
    </div>
  );
}

export default function Integracoes({
  slug,
  gympassSecret,
  totalpassSecret,
}: {
  slug: string;
  gympassSecret: string;
  totalpassSecret: string;
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
        segredo={gympassSecret}
        rota="gympass"
      />
      <BlocoParceiro
        nome="TotalPass"
        cor="bg-sky-400"
        slug={slug}
        segredo={totalpassSecret}
        rota="totalpass"
      />
    </div>
  );
}
