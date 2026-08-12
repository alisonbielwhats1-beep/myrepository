"use client";

import { useState, useTransition } from "react";
import {
  Archive,
  CalendarPlus,
  KeyRound,
  Loader2,
  PauseCircle,
  PlayCircle,
  RotateCcw,
} from "lucide-react";
import {
  suspenderAcessoAluno,
  reativarAcessoAluno,
  arquivarAluno,
  reativarCadastroAluno,
  iniciarMatricula,
  encerrarMatricula,
} from "@/lib/actions/ciclo-aluno";
import type { DetalheAcessoAluno } from "@/lib/acesso-aluno-detalhe";
import { cn } from "@/lib/utils";

function dataBR(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

const ROTULO_MATRICULA: Record<string, string> = {
  pendente: "Pendente",
  ativa: "Ativa",
  trancada: "Trancada",
  encerrada: "Encerrada",
  cancelada: "Cancelada",
};

export default function CicloAlunoPainel({
  slug,
  detalhe,
}: {
  slug: string;
  detalhe: DetalheAcessoAluno;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Estado de formulários inline.
  const [motivoSuspender, setMotivoSuspender] = useState("");
  const [confirmarArquivar, setConfirmarArquivar] = useState(false);
  const [motivoArquivar, setMotivoArquivar] = useState("");
  const [planoNova, setPlanoNova] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; erro?: string }>) => {
    setErro(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setErro(r.erro ?? "Não foi possível concluir a ação.");
    });
  };

  const acessoAtivo = detalhe.statusAcesso === "ativo";
  const arquivado = detalhe.statusCadastro === "arquivado";
  const matriculaAtiva = detalhe.matriculas.find((m) => m.status === "ativa");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-white">
          <KeyRound className="h-5 w-5 text-volt-300" /> {detalhe.nome}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <Badge
            texto={`Cadastro: ${arquivado ? "Arquivado" : detalhe.statusCadastro}`}
            tom={arquivado ? "amber" : "ok"}
          />
          <Badge
            texto={`Acesso: ${detalhe.statusAcesso ?? "sem vínculo"}`}
            tom={acessoAtivo ? "ok" : detalhe.statusAcesso ? "amber" : "neutro"}
          />
          <Badge
            texto={detalhe.ativado ? "Conta vinculada" : "Sem conta"}
            tom={detalhe.ativado ? "ok" : "neutro"}
          />
        </div>
      </div>

      {erro && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}

      {/* ACESSO */}
      <section className="surface rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-white">Acesso à academia</h2>
        <p className="mt-1 text-xs text-slate-500">
          Bloqueia ou libera o acesso do aluno a esta academia. Não exclui a conta
          nem afeta outras academias do mesmo aluno.
        </p>
        {!detalhe.statusAcesso ? (
          <p className="mt-3 text-xs text-slate-500">
            O aluno ainda não ativou o acesso. Gere um convite na tela anterior.
          </p>
        ) : acessoAtivo ? (
          <div className="mt-3 space-y-2">
            <input
              value={motivoSuspender}
              onChange={(e) => setMotivoSuspender(e.target.value)}
              placeholder="Motivo (opcional)"
              className="inp"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => suspenderAcessoAluno(slug, detalhe.id, motivoSuspender))}
              className="btn-ghost text-amber-300 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PauseCircle className="h-4 w-4" />}
              Suspender acesso
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => reativarAcessoAluno(slug, detalhe.id))}
            className="btn-volt mt-3 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Reativar acesso
          </button>
        )}
      </section>

      {/* CADASTRO */}
      <section className="surface rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-white">Cadastro do aluno</h2>
        <p className="mt-1 text-xs text-slate-500">
          Arquivar preserva o cadastro e todo o histórico (treinos, avaliações,
          pagamentos) — nada é apagado. É o correto no lugar de excluir.
        </p>
        {!arquivado ? (
          !confirmarArquivar ? (
            <button
              type="button"
              onClick={() => setConfirmarArquivar(true)}
              className="btn-ghost mt-3 text-amber-300"
            >
              <Archive className="h-4 w-4" /> Arquivar aluno
            </button>
          ) : (
            <div className="mt-3 space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-xs text-amber-200">
                Arquivar suspende o acesso, revoga convites pendentes e encerra a
                matrícula ativa. O cadastro e o histórico são preservados.
              </p>
              <input
                value={motivoArquivar}
                onChange={(e) => setMotivoArquivar(e.target.value)}
                placeholder="Motivo (opcional)"
                className="inp"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const r = await arquivarAluno(slug, detalhe.id, motivoArquivar);
                      if (r.ok) setConfirmarArquivar(false);
                      return r;
                    })
                  }
                  className="btn-volt !py-1.5 text-xs disabled:opacity-50"
                >
                  {pending ? "Arquivando..." : "Confirmar arquivamento"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmarArquivar(false)}
                  className="btn-ghost !py-1.5 text-xs"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => reativarCadastroAluno(slug, detalhe.id))}
            className="btn-volt mt-3 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Reativar cadastro
          </button>
        )}
      </section>

      {/* MATRÍCULAS */}
      <section className="surface rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-white">Matrículas (períodos)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Histórico temporal de acesso. Cada retorno é um NOVO período — o passado
          não é reescrito. (Separado da cobrança/mensalidade do aluno.)
        </p>

        {detalhe.matriculas.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">Nenhum período registrado.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {detalhe.matriculas.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-ink-600 bg-ink-900/40 px-3 py-2"
              >
                <div className="min-w-0 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge texto={ROTULO_MATRICULA[m.status] ?? m.status} tom={m.status === "ativa" ? "ok" : "neutro"} />
                    <span className="text-slate-300">
                      {dataBR(m.dataInicio)} → {dataBR(m.dataFim)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-slate-500">
                    {m.planoNome ? `Plano: ${m.planoNome}` : "Sem plano"}
                    {m.motivo ? ` · ${m.motivo}` : ""}
                  </p>
                </div>
                {m.status === "ativa" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => encerrarMatricula(slug, m.id, "encerrada"))}
                    className="btn-ghost !py-1.5 text-xs text-amber-300 disabled:opacity-50"
                  >
                    Encerrar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!matriculaAtiva && !arquivado && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={planoNova}
              onChange={(e) => setPlanoNova(e.target.value)}
              className="inp max-w-[220px]"
            >
              <option value="">Sem plano</option>
              {detalhe.planos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => iniciarMatricula(slug, detalhe.id, planoNova || null))}
              className="btn-volt disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
              Iniciar nova matrícula
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Badge({
  texto,
  tom,
}: {
  texto: string;
  tom: "ok" | "amber" | "neutro";
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
        tom === "ok" && "bg-volt-500/15 text-volt-200",
        tom === "amber" && "border border-amber-500/40 text-amber-300",
        tom === "neutro" && "border border-ink-600 text-slate-400"
      )}
    >
      {texto}
    </span>
  );
}
