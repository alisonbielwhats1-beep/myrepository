"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { QRCodeCanvas } from "qrcode.react";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  KeyRound,
  Loader2,
  MessageCircle,
  QrCode,
  RefreshCw,
  Users,
  X,
  XCircle,
} from "lucide-react";
import {
  gerarConviteAluno,
  gerarConvitesEmLote,
  revogarConvite,
  type ResumoMigracao,
} from "@/lib/actions/convites";
import {
  statusDerivado,
  type SituacaoAcessoAluno,
} from "@/lib/acesso-alunos-tipos";
import { linkWhats, mensagemConviteAtivacao } from "@/lib/whats";
import { cn } from "@/lib/utils";

type Filtro = "todos" | "apto" | "convidado" | "ativado";

/** Data curta pt-BR para "expira em". */
function dataCurta(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

export default function GestaoConvites({
  slug,
  academiaNome,
  isDemo,
  alunos,
  resumo,
}: {
  slug: string;
  academiaNome: string;
  isDemo: boolean;
  alunos: SituacaoAcessoAluno[];
  resumo: ResumoMigracao;
}) {
  // Links brutos gerados NESTA sessão (nunca persistidos): aluno_id -> link.
  const [links, setLinks] = useState<Record<string, string>>({});
  // Convites revogados nesta sessão (para atualizar o badge sem recarregar).
  const [revogados, setRevogados] = useState<Set<string>>(new Set());
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [qr, setQr] = useState<{ nome: string; url: string } | null>(null);
  const [erroLote, setErroLote] = useState<string | null>(null);
  const [pendingLote, startLote] = useTransition();

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return alunos.filter((a) => {
      if (q && !a.nome.toLowerCase().includes(q)) return false;
      if (filtro === "todos") return true;
      const s = revogados.has(a.id) && !a.ativado ? "apto" : statusDerivado(a);
      return s === filtro;
    });
  }, [alunos, busca, filtro, revogados]);

  // Aptos SEM link gerado ainda (alvo do lote): não ativados e sem convite vivo.
  const aptosParaLote = useMemo(
    () =>
      alunos.filter(
        (a) =>
          !a.ativado &&
          (!a.convite || revogados.has(a.id)) &&
          !links[a.id]
      ),
    [alunos, revogados, links]
  );

  const gerarLote = () => {
    setErroLote(null);
    const ids = aptosParaLote.map((a) => a.id);
    if (ids.length === 0) return;
    startLote(async () => {
      const r = await gerarConvitesEmLote(ids);
      const novos: Record<string, string> = {};
      let falhas = 0;
      for (const item of r) {
        if (item.ok && item.link) novos[item.alunoId] = item.link;
        else falhas++;
      }
      setLinks((prev) => ({ ...prev, ...novos }));
      if (falhas > 0) setErroLote(`${falhas} convite(s) não puderam ser gerados.`);
    });
  };

  const exportarCsv = () => {
    const linhas = alunos
      .filter((a) => links[a.id])
      .map((a) => {
        const nome = `"${a.nome.replace(/"/g, '""')}"`;
        return `${nome},${links[a.id]}`;
      });
    if (linhas.length === 0) return;
    const csv = "nome,link_de_ativacao\n" + linhas.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `convites-${slug}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const totalLinksGerados = Object.keys(links).length;

  return (
    <div className="space-y-5">
      {/* Resumo da migração */}
      {resumo && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Kpi label="Alunos" valor={resumo.total} icon={Users} />
          <Kpi label="Aptos a convidar" valor={resumo.aptos_a_convidar} destaque />
          <Kpi label="Já ativados" valor={resumo.ja_vinculados} />
          <Kpi label="Dados pendentes" valor={resumo.com_dados_pendentes} alerta={resumo.com_dados_pendentes > 0} />
          <Kpi label="Conflitos" valor={resumo.conflitos_conta_duplicada} alerta={resumo.conflitos_conta_duplicada > 0} />
        </div>
      )}

      {/* Ações em lote */}
      <div className="surface flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">Gerar convites em lote</p>
          <p className="text-xs text-slate-500">
            Cria um convite para cada aluno apto ({aptosParaLote.length}). Só gera
            convites — nunca contas ou senhas. Os links aparecem para copiar/enviar.
          </p>
        </div>
        <div className="flex flex-none gap-2">
          {totalLinksGerados > 0 && (
            <button type="button" onClick={exportarCsv} className="btn-ghost">
              <Download className="h-4 w-4" /> Exportar CSV ({totalLinksGerados})
            </button>
          )}
          <button
            type="button"
            onClick={gerarLote}
            disabled={pendingLote || aptosParaLote.length === 0}
            className="btn-volt disabled:opacity-50"
          >
            {pendingLote ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {pendingLote ? "Gerando..." : `Gerar ${aptosParaLote.length} convites`}
          </button>
        </div>
      </div>
      {erroLote && <p className="text-xs text-amber-300">{erroLote}</p>}

      {/* Filtros + busca */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(["todos", "apto", "convidado", "ativado"] as Filtro[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium capitalize transition",
                filtro === f
                  ? "border-volt-500/50 bg-volt-500/10 text-volt-200"
                  : "border-ink-600 text-slate-400 hover:text-slate-200"
              )}
            >
              {f === "todos" ? "Todos" : f === "apto" ? "Aptos" : f === "convidado" ? "Convidados" : "Ativados"}
            </button>
          ))}
        </div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome..."
          className="inp max-w-xs"
        />
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtrados.length === 0 && (
          <p className="rounded-2xl border border-ink-600 bg-ink-900/40 px-4 py-8 text-center text-sm text-slate-500">
            Nenhum aluno neste filtro.
          </p>
        )}
        {filtrados.map((a) => (
          <LinhaAluno
            key={a.id}
            slug={slug}
            aluno={a}
            academiaNome={academiaNome}
            isDemo={isDemo}
            link={links[a.id] ?? null}
            revogadoAgora={revogados.has(a.id)}
            onLink={(link) => setLinks((p) => ({ ...p, [a.id]: link }))}
            onRevogado={() => setRevogados((p) => new Set(p).add(a.id))}
            onMostrarQr={(nome, url) => setQr({ nome, url })}
          />
        ))}
      </div>

      {qr &&
        createPortal(
          <DialogQR key={qr.url} url={qr.url} nome={qr.nome} onClose={() => setQr(null)} />,
          document.body
        )}
    </div>
  );
}

function Kpi({
  label,
  valor,
  icon: Icon,
  destaque,
  alerta,
}: {
  label: string;
  valor: number | undefined;
  icon?: typeof Users;
  destaque?: boolean;
  alerta?: boolean;
}) {
  return (
    <div
      className={cn(
        "surface rounded-2xl p-3",
        destaque && "border-volt-500/40 ring-1 ring-volt-500/15",
        alerta && (valor ?? 0) > 0 && "border-amber-500/40"
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-500">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}
      </div>
      <p className={cn("mt-1 text-2xl font-bold", destaque ? "text-volt-300" : "text-white")}>
        {valor ?? "—"}
      </p>
    </div>
  );
}

function LinhaAluno({
  slug,
  aluno,
  academiaNome,
  isDemo,
  link,
  revogadoAgora,
  onLink,
  onRevogado,
  onMostrarQr,
}: {
  slug: string;
  aluno: SituacaoAcessoAluno;
  academiaNome: string;
  isDemo: boolean;
  link: string | null;
  revogadoAgora: boolean;
  onLink: (link: string) => void;
  onRevogado: () => void;
  onMostrarQr: (nome: string, url: string) => void;
}) {
  const [pending, start] = useTransition();
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const conviteVivo = aluno.convite && !revogadoAgora;
  const status: "ativado" | "convidado" | "apto" = aluno.ativado
    ? "ativado"
    : conviteVivo
    ? "convidado"
    : "apto";

  const gerar = () => {
    setErro(null);
    start(async () => {
      const r = await gerarConviteAluno(aluno.id);
      if (r.ok) onLink(r.link);
      else setErro(r.erro);
    });
  };

  const revogar = () => {
    if (!aluno.convite) return;
    setErro(null);
    start(async () => {
      const r = await revogarConvite(aluno.convite!.id);
      if (r.ok) onRevogado();
      else setErro(r.erro ?? "Falha ao revogar.");
    });
  };

  const copiar = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  };

  const whatsHref = link
    ? linkWhats(aluno.telefone, mensagemConviteAtivacao({ nome: aluno.nome, academia: academiaNome, url: link }), { isDemo })
    : null;

  return (
    <div className="surface flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-white">{aluno.nome}</span>
          <BadgeStatus status={status} expiraEm={aluno.convite?.expiraEm} />
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {aluno.telefone ? aluno.telefone : "Sem WhatsApp cadastrado"}
        </p>
        {erro && <p className="mt-1 text-xs text-red-400">{erro}</p>}
      </div>

      <div className="flex flex-none flex-wrap gap-2">
        {status === "ativado" ? (
          <span className="text-xs text-slate-500">Acesso já ativado</span>
        ) : link ? (
          <>
            {whatsHref && (
              <a href={whatsHref} target="_blank" rel="noopener noreferrer" className="btn-ghost !py-1.5 text-xs">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            )}
            <button type="button" onClick={copiar} className="btn-ghost !py-1.5 text-xs">
              {copiado ? <Check className="h-3.5 w-3.5 text-volt-300" /> : <Copy className="h-3.5 w-3.5" />}
              {copiado ? "Copiado" : "Copiar"}
            </button>
            <button type="button" onClick={() => onMostrarQr(aluno.nome, link)} className="btn-ghost !py-1.5 text-xs">
              <QrCode className="h-3.5 w-3.5" /> QR
            </button>
          </>
        ) : conviteVivo ? (
          <>
            <button type="button" onClick={gerar} disabled={pending} className="btn-ghost !py-1.5 text-xs disabled:opacity-50">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Gerar novo link
            </button>
            <button type="button" onClick={revogar} disabled={pending} className="btn-ghost !py-1.5 text-xs text-red-300 disabled:opacity-50">
              <XCircle className="h-3.5 w-3.5" /> Revogar
            </button>
          </>
        ) : (
          <button type="button" onClick={gerar} disabled={pending} className="btn-volt !py-1.5 text-xs disabled:opacity-50">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
            Gerar convite
          </button>
        )}
      </div>
    </div>
  );
}

function BadgeStatus({
  status,
  expiraEm,
}: {
  status: "ativado" | "convidado" | "apto";
  expiraEm?: string;
}) {
  if (status === "ativado")
    return <span className="rounded-full bg-volt-500/15 px-2 py-0.5 text-[10px] font-medium text-volt-200">Ativado</span>;
  if (status === "convidado")
    return (
      <span className="rounded-full border border-cyanx-500/40 px-2 py-0.5 text-[10px] font-medium text-cyanx-400">
        Convidado{expiraEm ? ` · expira ${dataCurta(expiraEm)}` : ""}
      </span>
    );
  return <span className="rounded-full border border-ink-600 px-2 py-0.5 text-[10px] font-medium text-slate-400">Sem convite</span>;
}

function DialogQR({ url, nome, onClose }: { url: string; nome: string; onClose: () => void }) {
  const canvasId = "qr-convite-ativacao";
  const baixar = () => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `convite-${nome.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="surface-strong relative my-auto max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-3xl p-6 text-center">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center justify-center gap-2 text-volt-300">
          <QrCode className="h-5 w-5" />
          <h3 className="font-semibold">QR do convite</h3>
        </div>
        <p className="mt-1 text-sm text-slate-400">{nome}</p>
        <div className="mx-auto mt-5 w-fit rounded-2xl bg-white p-4">
          <QRCodeCanvas id={canvasId} value={url} size={200} level="M" includeMargin={false} />
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-left text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
          Convite pessoal e de uso único. Entregue só ao aluno certo — se cair na
          pessoa errada, revogue e gere outro.
        </div>
        <button onClick={baixar} className="btn-ghost mt-4 w-full">
          <Download className="h-4 w-4" /> Baixar QR
        </button>
      </div>
    </div>
  );
}
