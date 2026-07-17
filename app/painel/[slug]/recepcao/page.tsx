import { DoorOpen, TrendingUp, UserCheck, Wallet } from "lucide-react";
import CatracaLog from "@/components/painel/CatracaLog";
import StatTile from "@/components/painel/StatTile";
import { getAcademia, getAcessos, getAlunos } from "@/lib/data";
import { formatBRL } from "@/lib/utils";

export default async function RecepcaoPage({
  params,
}: {
  params: { slug: string };
}) {
  const academia = await getAcademia(params.slug);
  const acessos = await getAcessos(academia?.id ?? "");
  const alunos = await getAlunos(academia?.id ?? "");

  const hoje = new Date().toDateString();
  const acessosHoje = acessos.filter(
    (a) => new Date(a.data_hora_entrada).toDateString() === hoje
  );
  const liberadosHoje = acessosHoje.filter(
    (a) => a.status_liberacao === "liberado"
  ).length;
  const repasseHoje = acessosHoje.reduce(
    (acc, a) => acc + (a.valor_repasse ?? 0),
    0
  );
  const ativos = alunos.filter((a) => a.status_matricula === "ativa").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Recepção &amp; Catraca</h1>
        <p className="text-sm text-slate-400">
          Monitore entradas em tempo real e libere acessos.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={DoorOpen}
          label="Acessos hoje"
          value={String(acessosHoje.length)}
          hint={`${liberadosHoje} liberados`}
          accent="volt"
        />
        <StatTile
          icon={UserCheck}
          label="Alunos ativos"
          value={String(ativos)}
          hint={`${alunos.length} no total`}
          accent="cyan"
        />
        <StatTile
          icon={Wallet}
          label="Repasse hoje"
          value={formatBRL(repasseHoje)}
          hint="Gympass + TotalPass"
          accent="magenta"
        />
        <StatTile
          icon={TrendingUp}
          label="Pico previsto"
          value="19h"
          hint="+34% vs. média"
          accent="slate"
        />
      </div>

      <CatracaLog acessosIniciais={acessos} alunos={alunos} />
    </div>
  );
}
