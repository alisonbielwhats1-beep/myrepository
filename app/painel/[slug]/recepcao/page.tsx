import { Clock3, DoorOpen, UserCheck, Wallet } from "lucide-react";
import Breadcrumbs from "@/components/painel/Breadcrumbs";
import CatracaLog from "@/components/painel/CatracaLog";
import StatTile from "@/components/painel/StatTile";
import { requireSecao } from "@/lib/auth";
import { getAcessos, getAlunos } from "@/lib/data";
import { formatBRL } from "@/lib/utils";

export default async function RecepcaoPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSecao(params.slug, "recepcao");
  const [acessos, alunos] = await Promise.all([
    getAcessos(sessao.academia.id),
    getAlunos(sessao.academia.id),
  ]);

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

  // Horário com mais entradas hoje, calculado a partir de dados reais.
  const contagemHora = new Map<number, number>();
  for (const a of acessosHoje) {
    const h = new Date(a.data_hora_entrada).getHours();
    contagemHora.set(h, (contagemHora.get(h) ?? 0) + 1);
  }
  let horaPico: number | null = null;
  let maxAcessos = 0;
  for (const [h, n] of contagemHora) {
    if (n > maxAcessos) {
      maxAcessos = n;
      horaPico = h;
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs slug={params.slug} items={[{ label: "Recepção / Catraca" }]} />
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
          icon={Clock3}
          label="Pico de hoje"
          value={horaPico !== null ? `${String(horaPico).padStart(2, "0")}h` : "—"}
          hint={horaPico !== null ? `${maxAcessos} acessos` : "sem acessos hoje"}
          accent="slate"
        />
      </div>

      <CatracaLog acessosIniciais={acessos} alunos={alunos} slug={params.slug} />
    </div>
  );
}
