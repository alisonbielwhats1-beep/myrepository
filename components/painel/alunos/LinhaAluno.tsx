"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  Check,
  HeartPulse,
  MoreHorizontal,
  Pencil,
  QrCode,
  UserRound,
} from "lucide-react";
import { Aluno, StatusFinanceiro } from "@/lib/types";
import {
  badgeStatusFinanceiro,
  rotuloStatusFinanceiro,
  badgeStatusMatricula,
  cn,
} from "@/lib/utils";
import { origemPublica } from "@/lib/site-url";
import ConfirmButton from "@/components/ui/ConfirmButton";
import { excluirAluno } from "@/app/painel/[slug]/alunos/actions";

// ---------------------------------------------------------------------------
// Linha da lista de alunos (com link para o app do aluno, editar e excluir)
// ---------------------------------------------------------------------------
export default function LinhaAluno({
  slug,
  aluno,
  ativo,
  statusFinanceiro,
  totalAberto,
  onSelecionar,
  onVerFinanceiro,
  onEditar,
}: {
  slug: string;
  aluno: Aluno;
  ativo: boolean;
  statusFinanceiro?: StatusFinanceiro;
  totalAberto: number;
  onSelecionar: () => void;
  onVerFinanceiro: () => void;
  onEditar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  // Posição calculada do gatilho, em coordenadas de viewport — o menu é
  // renderizado via portal em document.body (ver abaixo), então não usa
  // `position: absolute` relativo à linha.
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const copiarLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = `${origemPublica()}/aluno/${slug}/${aluno.token_acesso_publico}`;
    await navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => {
      setCopiado(false);
      setMenuAberto(false);
    }, 1200);
  };

  function alternarMenu(e: React.MouseEvent) {
    e.stopPropagation();
    const rect = menuBtnRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setMenuAberto((v) => !v);
  }

  // A lista de alunos rola dentro de um <ul overflow-auto> com altura
  // limitada — um menu `position: absolute` ficaria cortado pelo próprio
  // scroll da lista para qualquer aluno perto do fim da área visível. Por
  // isso o menu é portalizado (como o diálogo de AtribuirTreino) e some ao
  // rolar, para não flutuar sobre a linha errada.
  useEffect(() => {
    if (!menuAberto) return;
    const fechar = () => setMenuAberto(false);
    window.addEventListener("scroll", fechar, true);
    return () => window.removeEventListener("scroll", fechar, true);
  }, [menuAberto]);

  return (
    <li>
      <div
        onClick={onSelecionar}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onSelecionar()}
        className={cn(
          "flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-left transition",
          ativo ? "bg-volt-500/10" : "hover:bg-ink-700/40"
        )}
      >
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-ink-600">
          {aluno.foto_perfil_url ? (
            <Image
              src={aluno.foto_perfil_url}
              alt={aluno.nome}
              fill
              sizes="40px"
              className="media-native object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center bg-ink-700 text-slate-500">
              <UserRound className="h-4 w-4" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-white">
            <span className="truncate">{aluno.nome}</span>
            {aluno.condicoes_medicas && (
              <span
                title={`Condições médicas: ${aluno.condicoes_medicas}`}
                aria-label="Aluno com condições médicas registradas"
                className="inline-flex flex-none items-center gap-0.5 rounded-full border border-magenta-500/40 bg-magenta-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-magenta-300"
              >
                <HeartPulse className="h-3 w-3" />
                Saúde
              </span>
            )}
          </p>
          <p className="truncate text-xs text-slate-500">
            {aluno.matricula_codigo}
          </p>
        </div>
        <div className="ml-auto flex flex-none flex-col items-end gap-1">
          <span
            className={cn(
              "chip text-[10px]",
              badgeStatusMatricula(aluno.status_matricula)
            )}
          >
            {aluno.status_matricula}
          </span>
          {statusFinanceiro && statusFinanceiro !== "em_dia" && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onVerFinanceiro(); }}
              title="Ver situação financeira"
              className={cn(
                "chip text-[10px] cursor-pointer hover:opacity-80 transition-opacity",
                badgeStatusFinanceiro(statusFinanceiro)
              )}
            >
              {rotuloStatusFinanceiro(statusFinanceiro)}
            </button>
          )}
          {totalAberto > 0 && (
            <span className="text-right text-[10px] text-red-400 tabular-nums">
              {totalAberto.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 })} em aberto
            </span>
          )}
        </div>
        {/* Menu "•••": QR/editar/excluir viviam como 3 ícones sempre visíveis
            na linha — junto com os chips de status, deixava a lista pesada
            demais no celular (achado da auditoria visual). Agora só o gatilho
            fica visível; as ações aparecem ao abrir o menu. */}
        <div className="flex-none">
          <button
            ref={menuBtnRef}
            type="button"
            onClick={alternarMenu}
            aria-label="Mais ações"
            aria-expanded={menuAberto}
            title="Mais ações"
            className="grid h-8 w-8 flex-none place-items-center rounded-lg text-slate-500 transition hover:bg-ink-700 hover:text-white"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuAberto &&
            menuPos &&
            createPortal(
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setMenuAberto(false)}
                />
                <div
                  role="menu"
                  style={{ top: menuPos.top, right: menuPos.right }}
                  className="fixed z-50 w-48 overflow-hidden rounded-xl border border-ink-600 bg-ink-800 shadow-card"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={copiarLink}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-ink-700"
                  >
                    {copiado ? (
                      <Check className="h-4 w-4 text-volt-300" />
                    ) : (
                      <QrCode className="h-4 w-4" />
                    )}
                    {copiado ? "Link copiado" : "Copiar link do app"}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuAberto(false);
                      onEditar();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-ink-700"
                  >
                    <Pencil className="h-4 w-4" /> Editar aluno
                  </button>
                  <ConfirmButton
                    action={() => excluirAluno(slug, aluno.id)}
                    confirmText={`Excluir o aluno "${aluno.nome}"? Treinos e histórico serão removidos.`}
                    label="Excluir aluno"
                    variant="menu"
                  />
                </div>
              </>,
              document.body
            )}
        </div>
      </div>
    </li>
  );
}
