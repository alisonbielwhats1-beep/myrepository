"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, PlugZap, Unplug } from "lucide-react";
import {
  conectarTotalPass,
  desconectarTotalPass,
  definirValidacaoAutomaticaTotalPass,
  testarTotalPass,
} from "@/app/painel/[slug]/integracoes/actions";

/** O que a página (servidor) entrega sobre a conexão — nunca a chave inteira. */
export type ConexaoTotalPassInfo = {
  migracaoPendente: boolean;
  partnerKeyConfigurada: boolean;
  conectada: boolean;
  chaveMascarada: string;
  unidade: string | null;
  webhookRegistrado: boolean;
  validacaoAutomatica: boolean;
  conectadoEm: string | null;
  ultimoTesteEm: string | null;
  ultimoCheckinEm: string | null;
  ultimoErro: string | null;
};

function quando(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

/**
 * Conexão com a API oficial de check-in da TotalPass. O dono gera a "chave da
 * unidade" no Portal da TotalPass (Integrações → Configurar integrações →
 * escolhe o GestAcad) e cola aqui; o GestAcad valida com a TotalPass e
 * cadastra sozinho o endereço que recebe os check-ins.
 */
export default function ConexaoTotalPass({
  slug,
  info,
}: {
  slug: string;
  info: ConexaoTotalPassInfo;
}) {
  const [chave, setChave] = useState("");
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  function executar(acao: () => Promise<{ erro?: string; ok?: boolean; unidade?: string | null }>, msgOk: (u?: string | null) => string) {
    setErro(null);
    setSucesso(null);
    start(async () => {
      const r = await acao();
      if (r.erro) setErro(r.erro);
      else setSucesso(msgOk(r.unidade));
    });
  }

  if (info.migracaoPendente) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2.5 text-xs text-amber-200">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-400" />
        <span>A conexão com a TotalPass está sendo ativada no sistema. Volte em breve.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-ink-700 bg-ink-800/50 p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium text-white">
        <PlugZap className="h-3.5 w-3.5 text-sky-300" />
        Conexão com a TotalPass
      </p>

      {!info.partnerKeyConfigurada && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2.5 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-400" />
          <span>
            O GestAcad está em homologação como integrador oficial da TotalPass. Assim que
            a liberação sair, a conexão abaixo passa a funcionar — nada muda para você.
          </span>
        </div>
      )}

      {info.conectada ? (
        <div className="space-y-3">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Unidade na TotalPass</dt>
              <dd className="text-slate-200">{info.unidade ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Chave da unidade</dt>
              <dd className="font-mono tracking-widest text-slate-300">{info.chaveMascarada}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Recebimento de check-ins</dt>
              <dd className={info.webhookRegistrado ? "text-volt-300" : "text-red-300"}>
                {info.webhookRegistrado ? "Cadastrado na TotalPass" : "Não cadastrado"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Último check-in recebido</dt>
              <dd className="text-slate-200">{quando(info.ultimoCheckinEm)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Último teste</dt>
              <dd className="text-slate-200">{quando(info.ultimoTesteEm)}</dd>
            </div>
          </dl>

          {info.ultimoErro && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300">
              Último problema: {info.ultimoErro}
            </p>
          )}

          <label className="flex items-start gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              defaultChecked={info.validacaoAutomatica}
              disabled={pending}
              onChange={(e) => {
                const ligada = e.target.checked;
                executar(
                  () => definirValidacaoAutomaticaTotalPass(slug, ligada),
                  () => (ligada ? "Validação automática ligada." : "Validação automática desligada.")
                );
              }}
              className="mt-0.5 h-4 w-4 rounded border-ink-500 bg-ink-800"
            />
            <span>
              Validar o check-in na TotalPass automaticamente
              <span className="block text-slate-500">
                Desligado, a entrada só é registrada aqui e a recepção valida pelo Portal da
                TotalPass. Aluno bloqueado pela sua política de inadimplência nunca é validado.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                executar(
                  () => testarTotalPass(slug),
                  (u) => `Conexão funcionando${u ? ` — unidade ${u}` : ""}.`
                )
              }
              className="btn-ghost text-xs"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Testar conexão
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("Desconectar a TotalPass? Os check-ins deixam de chegar no GestAcad.")) return;
                executar(() => desconectarTotalPass(slug), () => "TotalPass desconectada.");
              }}
              className="btn-ghost text-xs text-red-300 hover:bg-red-500/10"
            >
              <Unplug className="h-3.5 w-3.5" />
              Desconectar
            </button>
          </div>
        </div>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const valor = chave;
            executar(
              () => conectarTotalPass(slug, valor),
              (u) => `Conectado${u ? ` à unidade ${u}` : ""}. Os check-ins já chegam por aqui.`
            );
          }}
        >
          <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-400">
            <li>No Portal de Parceiros da TotalPass, abra Integrações → Configurar integrações.</li>
            <li>Escolha o <strong>GestAcad</strong> na lista e gere a chave da unidade.</li>
            <li>Cole a chave abaixo e clique em Conectar.</li>
          </ol>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Chave da unidade (place_api_key)</span>
            <div className="flex gap-2">
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={chave}
                onChange={(e) => setChave(e.target.value)}
                placeholder="Cole aqui a chave gerada no Portal da TotalPass"
                disabled={pending}
                className="inp flex-1 font-mono text-xs"
              />
              <button type="submit" disabled={pending || !chave.trim()} className="btn-volt px-3 text-xs">
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                Conectar
              </button>
            </div>
          </label>
          <p className="text-[11px] text-slate-500">
            Use uma chave gerada com o GestAcad selecionado. A chave de outro sistema (ex.: o
            que você usa hoje) não funciona aqui e não deve ser compartilhada.
          </p>
        </form>
      )}

      {erro && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300">{erro}</p>
      )}
      {sucesso && (
        <p className="rounded-lg border border-volt-500/30 bg-volt-500/10 px-3 py-1.5 text-xs text-volt-300">{sucesso}</p>
      )}
    </div>
  );
}
