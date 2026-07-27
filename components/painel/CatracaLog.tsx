"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Image from "next/image";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Plus,
  Search,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { Aluno, DecisaoAcesso, Plano, StatusFinanceiro } from "@/lib/types";
import {
  badgeStatusFinanceiro,
  badgeStatusMatricula,
  cn,
  formatBRL,
  timeAgo,
} from "@/lib/utils";
import { registrarAcesso } from "@/app/painel/[slug]/recepcao/actions";

/** Cartão de registro de entrada da Recepção: busca o aluno e mostra o resultado. */
export default function CatracaLog({
  alunos,
  planos,
  statusFinanceiroMap,
  ultimosAcessos,
  slug,
}: {
  alunos: Aluno[];
  planos: Plano[];
  statusFinanceiroMap: Record<string, StatusFinanceiro>;
  ultimosAcessos: Record<string, string>;
  slug: string;
}) {
  const [mostrarForm, setMostrarForm] = useState(false);

  return (
    <div className="surface rounded-2xl">
      <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-volt-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-volt-300" />
          </span>
          <h2 className="font-semibold text-white">Registrar entrada</h2>
        </div>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className={mostrarForm ? "btn-ghost" : "btn-volt"}
          disabled={alunos.length === 0}
          title={alunos.length === 0 ? "Cadastre um aluno primeiro" : undefined}
        >
          {mostrarForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {mostrarForm ? "Fechar" : "Registrar entrada"}
        </button>
      </div>

      {mostrarForm ? (
        <FormularioAcesso
          slug={slug}
          alunos={alunos}
          planos={planos}
          statusFinanceiroMap={statusFinanceiroMap}
          ultimosAcessos={ultimosAcessos}
          onSalvo={() => setMostrarForm(false)}
        />
      ) : (
        <p className="px-5 py-4 text-sm text-slate-400">
          Busque o aluno por nome, matrícula ou telefone para liberar a entrada.
        </p>
      )}
    </div>
  );
}

/** Normaliza para comparação: minúsculas, sem acento, só dígitos p/ telefone. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "");
}
function apenasDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

function FormularioAcesso({
  slug,
  alunos,
  planos,
  statusFinanceiroMap,
  ultimosAcessos,
  onSalvo,
}: {
  slug: string;
  alunos: Aluno[];
  planos: Plano[];
  statusFinanceiroMap: Record<string, StatusFinanceiro>;
  ultimosAcessos: Record<string, string>;
  onSalvo: () => void;
}) {
  const acao = registrarAcesso.bind(null, slug);
  const [estado, formAction] = useFormState(acao, {});
  const [busca, setBusca] = useState("");
  const [alunoId, setAlunoId] = useState<string>("");
  // Uma chave por tentativa de envio — não por aluno. Duplo clique/reenvio
  // reaproveita a mesma chave e é barrado pelo índice único no servidor; uma
  // nova tentativa legítima (após o envio anterior terminar) ganha chave nova.
  const [chave, setChave] = useState(() => gerarChave());

  // Só fecha o formulário quando a entrada foi liberada sem ressalva. Com alerta
  // ou bloqueio, o painel permanece aberto para a recepção ler o motivo.
  useEffect(() => {
    if (!estado.savedAt) return;
    setChave(gerarChave());
    if (estado.ok && estado.decisao?.resultado === "liberado") onSalvo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  const alunoSelecionado = alunos.find((a) => a.id === alunoId) ?? null;

  const resultados = useMemo(() => {
    const termo = busca.trim();
    if (!termo) return [];
    const termoNorm = normalizar(termo);
    const termoDigitos = apenasDigitos(termo);
    return alunos
      .filter((a) => {
        if (normalizar(a.nome).includes(termoNorm)) return true;
        if (a.matricula_codigo && normalizar(a.matricula_codigo).includes(termoNorm)) return true;
        if (termoDigitos && a.telefone && apenasDigitos(a.telefone).includes(termoDigitos)) return true;
        return false;
      })
      .slice(0, 8);
  }, [alunos, busca]);

  const selecionar = (id: string) => {
    setAlunoId(id);
    setBusca("");
  };

  return (
    <form
      action={formAction}
      className="space-y-3 border-b border-ink-700 bg-ink-900/40 px-5 py-4"
    >
      {estado.erro && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}

      {estado.decisao && <PainelDecisao decisao={estado.decisao} />}

      <input type="hidden" name="aluno_id" value={alunoId} />
      <input type="hidden" name="chave_idempotencia" value={chave} />

      {alunoSelecionado ? (
        <CartaoAlunoSelecionado
          aluno={alunoSelecionado}
          plano={planos.find((p) => p.id === alunoSelecionado.plano_id) ?? null}
          statusFinanceiro={statusFinanceiroMap[alunoSelecionado.id]}
          ultimoAcesso={ultimosAcessos[alunoSelecionado.id]}
          onTrocar={() => setAlunoId("")}
        />
      ) : (
        <div className="relative">
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Buscar aluno por nome, matrícula ou telefone
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Ex: Maria, 0231 ou 11999999999"
              className="inp pl-9"
              autoComplete="off"
            />
          </div>
          {busca.trim() && (
            <ul className="absolute z-10 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-ink-600 bg-ink-800 shadow-xl">
              {resultados.length === 0 && (
                <li className="px-4 py-3 text-sm text-slate-500">Nenhum aluno encontrado.</li>
              )}
              {resultados.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => selecionar(a.id)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-ink-700/50"
                  >
                    <FotoAluno aluno={a} tamanho={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{a.nome}</p>
                      <p className="truncate text-xs text-slate-500">
                        {a.matricula_codigo ?? "sem matrícula"}
                        {a.telefone ? ` · ${a.telefone}` : ""}
                      </p>
                    </div>
                    <span className={cn("chip text-[10px]", badgeStatusMatricula(a.status_matricula))}>
                      {a.status_matricula}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label>
          <span className="mb-1 block text-xs font-medium text-slate-400">Origem</span>
          <select name="origem" className="inp" defaultValue="Direto">
            <option value="Direto">Direto</option>
            <option value="Gympass">Gympass</option>
            <option value="TotalPass">TotalPass</option>
          </select>
        </label>
        <BotaoRegistrar disabled={!alunoId} />
      </div>
    </form>
  );
}

function gerarChave(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function FotoAluno({ aluno, tamanho }: { aluno: Aluno; tamanho: number }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full ring-1 ring-ink-600"
      style={{ height: tamanho, width: tamanho }}
    >
      {aluno.foto_perfil_url ? (
        <Image
          src={aluno.foto_perfil_url}
          alt={aluno.nome}
          fill
          sizes={`${tamanho}px`}
          className="media-native object-cover"
        />
      ) : (
        <div className="grid h-full place-items-center bg-ink-700 text-slate-500">
          <UserRound className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

/** Resumo do aluno escolhido: foto, plano, status da matrícula, financeiro e último acesso. */
function CartaoAlunoSelecionado({
  aluno,
  plano,
  statusFinanceiro,
  ultimoAcesso,
  onTrocar,
}: {
  aluno: Aluno;
  plano: Plano | null;
  statusFinanceiro?: StatusFinanceiro;
  ultimoAcesso?: string;
  onTrocar: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-600 bg-ink-800/60 px-4 py-3">
      <FotoAluno aluno={aluno} tamanho={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">{aluno.nome}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
          <span>{plano?.nome ?? "sem plano"}</span>
          <span className="text-slate-600">·</span>
          <span className={cn("chip text-[10px]", badgeStatusMatricula(aluno.status_matricula))}>
            {aluno.status_matricula}
          </span>
          {statusFinanceiro && (
            <span className={cn("chip text-[10px]", badgeStatusFinanceiro(statusFinanceiro))}>
              {statusFinanceiro === "inadimplente"
                ? "inadimplente"
                : statusFinanceiro === "pendente"
                ? "vence hoje"
                : "em dia"}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-slate-500">
            <Clock3 className="h-3 w-3" />
            {ultimoAcesso ? `último acesso ${timeAgo(ultimoAcesso)}` : "nunca acessou"}
          </span>
        </div>
      </div>
      <button type="button" onClick={onTrocar} className="btn-ghost !py-1.5 text-xs">
        Trocar
      </button>
    </div>
  );
}

/**
 * Resultado da tentativa de entrada. Verde = liberado, amarelo = liberado com
 * pendência financeira, vermelho = bloqueado pela política da academia.
 */
function PainelDecisao({ decisao }: { decisao: DecisaoAcesso }) {
  const { resultado } = decisao;

  const estilo =
    resultado === "liberado"
      ? "border-volt-500/30 bg-volt-500/10 text-volt-300"
      : resultado === "alerta"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
      : "border-red-500/40 bg-red-500/10 text-red-300";

  const Icone =
    resultado === "liberado"
      ? CheckCircle2
      : resultado === "alerta"
      ? AlertTriangle
      : XCircle;

  const titulo =
    resultado === "liberado"
      ? "Acesso permitido"
      : resultado === "alerta"
      ? "Acesso permitido — aluno com mensalidade vencida"
      : "Acesso bloqueado";

  // Só há detalhamento financeiro quando a decisão passou pela política.
  const temFinanceiro = decisao.quantidadeVencida > 0;

  return (
    <div className={cn("w-full rounded-xl border px-4 py-3", estilo)}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Icone className="h-4 w-4 flex-none" />
        {titulo}
      </p>

      {resultado === "bloqueado" && decisao.politicaAplicada === null && decisao.motivo && (
        <p className="mt-1 text-xs opacity-90">{decisao.motivo}</p>
      )}

      {temFinanceiro && (
        <>
          <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
            <div>
              <span className="block opacity-70">Total vencido</span>
              <span className="font-semibold tabular-nums">
                {formatBRL(decisao.totalVencido)}
              </span>
            </div>
            <div>
              <span className="block opacity-70">Mensalidades</span>
              <span className="font-semibold tabular-nums">
                {decisao.quantidadeVencida}
              </span>
            </div>
            <div>
              <span className="block opacity-70">Competência mais antiga</span>
              <span className="font-semibold">
                {decisao.competencia
                  ? new Date(decisao.competencia + "T00:00:00").toLocaleDateString(
                      "pt-BR",
                      { month: "2-digit", year: "numeric" }
                    )
                  : "—"}
              </span>
            </div>
            <div>
              <span className="block opacity-70">Vencimento</span>
              <span className="font-semibold">
                {decisao.vencimento
                  ? new Date(decisao.vencimento + "T00:00:00").toLocaleDateString("pt-BR")
                  : "—"}
                {decisao.diasAtraso > 0 && ` · ${decisao.diasAtraso} dia(s)`}
              </span>
            </div>
          </div>

          {resultado === "bloqueado" && (
            <p className="mt-2.5 text-xs opacity-90">
              O bloqueio ocorreu pela política de inadimplência configurada nas
              Configurações da academia. A tentativa ficou registrada no histórico.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function BotaoRegistrar({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className="btn-volt disabled:opacity-50">
      {pending ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <Plus className="h-4 w-4" />
      )}
      {pending ? "Registrando..." : "Registrar"}
    </button>
  );
}
