import Breadcrumbs from "@/components/painel/Breadcrumbs";
import GestaoFuncionarios from "@/components/painel/GestaoFuncionarios";
import { requireSessao } from "@/lib/auth";
import { getFuncionarios } from "@/lib/data";

export default async function FuncionariosPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSessao(params.slug);
  const funcionarios = await getFuncionarios(sessao.academia.id);

  return (
    <div className="space-y-6">
      <Breadcrumbs slug={params.slug} items={[{ label: "Funcionários" }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">Funcionários</h1>
        <p className="text-sm text-slate-400">
          Cadastre, edite e gerencie a equipe da academia.
        </p>
      </div>

      <GestaoFuncionarios slug={params.slug} funcionariosIniciais={funcionarios} />
    </div>
  );
}
