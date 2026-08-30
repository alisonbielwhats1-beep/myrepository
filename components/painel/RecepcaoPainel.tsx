"use client";

import { useEffect, useState } from "react";
import CatracaLog from "./CatracaLog";
import HistoricoAcessos from "./HistoricoAcessos";
import { AcessoCatraca, Aluno, Papel, Plano, StatusFinanceiro } from "@/lib/types";

/**
 * Junta "Registrar entrada" e o Histórico num client component pra poder
 * prependar otimisticamente o acesso recém-registrado no log, sem esperar o
 * próximo round-trip do servidor (o `revalidatePath` de registrarAcesso
 * continua acontecendo — só o primeiro paint fica instantâneo; quando a
 * página revalida de verdade, a entrada otimista é descartada em favor da
 * real, que chega pelo mesmo `id`).
 */
export default function RecepcaoPainel({
  slug,
  papel,
  alunos,
  planos,
  statusFinanceiroMap,
  ultimosAcessos,
  historicoAcessos,
  historicoTotal,
  pagina,
  tamanhoPagina,
  podeAnexarOtimista,
}: {
  slug: string;
  papel: Papel;
  alunos: Aluno[];
  planos: Plano[];
  statusFinanceiroMap: Record<string, StatusFinanceiro>;
  ultimosAcessos: Record<string, string>;
  historicoAcessos: AcessoCatraca[];
  historicoTotal: number;
  pagina: number;
  tamanhoPagina: number;
  /**
   * Só true na visão padrão do histórico (página 1, sem filtro de data/
   * resultado/origem/aluno) — evita prependar uma linha que os filtros
   * ativos da recepção escondiam de propósito.
   */
  podeAnexarOtimista: boolean;
}) {
  const [otimistas, setOtimistas] = useState<AcessoCatraca[]>([]);

  // Quando o histórico do servidor chega de verdade (revalidatePath após o
  // registro), remove do estado otimista o que já apareceu — evita duplicar
  // a mesma entrada na tela.
  useEffect(() => {
    setOtimistas((atual) =>
      atual.filter((o) => !historicoAcessos.some((a) => a.id === o.id))
    );
  }, [historicoAcessos]);

  function handleRegistrado(acesso: AcessoCatraca) {
    if (!podeAnexarOtimista) return;
    setOtimistas((atual) => [acesso, ...atual]);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr] lg:items-start">
      <CatracaLog
        alunos={alunos}
        planos={planos}
        statusFinanceiroMap={statusFinanceiroMap}
        ultimosAcessos={ultimosAcessos}
        slug={slug}
        onRegistrado={handleRegistrado}
      />

      <HistoricoAcessos
        slug={slug}
        papel={papel}
        acessos={[...otimistas, ...historicoAcessos]}
        total={historicoTotal + otimistas.length}
        pagina={pagina}
        tamanhoPagina={tamanhoPagina}
        alunos={alunos}
      />
    </div>
  );
}
