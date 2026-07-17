"use client";

import { useState } from "react";
import Image from "next/image";
import {
  CheckCircle2,
  DoorOpen,
  Plus,
  UserRound,
  XCircle,
  Zap,
} from "lucide-react";
import { AcessoCatraca, Aluno, OrigemAcesso } from "@/lib/types";
import { CORES_ORIGEM, cn, formatHora, timeAgo } from "@/lib/utils";

/**
 * Log de acessos da catraca em "tempo real". No modo demonstração, o botão
 * "Simular acesso" injeta uma nova entrada no topo (efeito de porteiro ao vivo).
 */
export default function CatracaLog({
  acessosIniciais,
  alunos,
}: {
  acessosIniciais: AcessoCatraca[];
  alunos: Aluno[];
}) {
  const [acessos, setAcessos] = useState<AcessoCatraca[]>(acessosIniciais);

  const origens: OrigemAcesso[] = ["Direto", "Gympass", "TotalPass"];
  const repassePorOrigem: Record<OrigemAcesso, number> = {
    Direto: 0,
    Gympass: 12.5,
    TotalPass: 10,
  };

  const simularAcesso = () => {
    if (alunos.length === 0) return;
    const aluno = alunos[Math.floor(Math.random() * alunos.length)];
    const origem = origens[Math.floor(Math.random() * origens.length)];
    const liberado = aluno.status_matricula === "ativa";
    const novo: AcessoCatraca = {
      id: `acc-${Date.now()}`,
      academia_id: aluno.academia_id,
      aluno_id: aluno.id,
      origem,
      valor_repasse: repassePorOrigem[origem],
      data_hora_entrada: new Date().toISOString(),
      status_liberacao: liberado ? "liberado" : "negado",
      observacao: liberado ? null : "Matrícula pendente",
      aluno: {
        id: aluno.id,
        nome: aluno.nome,
        foto_perfil_url: aluno.foto_perfil_url,
      },
    };
    setAcessos((prev) => [novo, ...prev]);
  };

  return (
    <div className="surface rounded-2xl">
      <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-volt-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-volt-300" />
          </span>
          <h2 className="font-semibold text-white">Acessos ao vivo</h2>
        </div>
        <button onClick={simularAcesso} className="btn-volt">
          <Plus className="h-4 w-4" /> Simular acesso
        </button>
      </div>

      <ul className="divide-y divide-ink-700/70">
        {acessos.map((a) => {
          const liberado = a.status_liberacao === "liberado";
          return (
            <li
              key={a.id}
              className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-ink-700/30"
            >
              {/* Foto do aluno — sem retângulo de fundo poluindo a mídia */}
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-ink-600">
                {a.aluno?.foto_perfil_url ? (
                  <Image
                    src={a.aluno.foto_perfil_url}
                    alt={a.aluno?.nome ?? "Aluno"}
                    fill
                    sizes="48px"
                    className="media-native object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center bg-ink-700 text-slate-500">
                    <UserRound className="h-5 w-5" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">
                  {a.aluno?.nome ?? "Visitante"}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                    style={{
                      color: CORES_ORIGEM[a.origem],
                      backgroundColor: `${CORES_ORIGEM[a.origem]}1f`,
                    }}
                  >
                    <Zap className="h-3 w-3" />
                    {a.origem}
                  </span>
                  <span>{formatHora(a.data_hora_entrada)}</span>
                  <span className="text-slate-600">·</span>
                  <span>{timeAgo(a.data_hora_entrada)}</span>
                </div>
              </div>

              <span
                className={cn(
                  "chip",
                  liberado
                    ? "border-volt-500/30 bg-volt-500/10 text-volt-300"
                    : "border-red-500/30 bg-red-500/10 text-red-400"
                )}
              >
                {liberado ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Liberado
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5" /> Negado
                  </>
                )}
              </span>
            </li>
          );
        })}

        {acessos.length === 0 && (
          <li className="flex flex-col items-center gap-2 px-5 py-12 text-slate-500">
            <DoorOpen className="h-8 w-8" />
            Nenhum acesso registrado ainda.
          </li>
        )}
      </ul>
    </div>
  );
}
