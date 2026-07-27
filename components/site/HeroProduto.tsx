import {
  ArrowUpRight,
  CheckCircle2,
  Dumbbell,
  QrCode,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

/**
 * Composição visual do produto para o Hero.
 *
 * IMPORTANTE — não são capturas de tela reais: o projeto ainda não possui
 * nenhuma imagem do dashboard nem da área do aluno em `public/`. Esta é uma
 * REPRESENTAÇÃO fiel construída com os mesmos componentes visuais das telas
 * reais (StatTile do painel, cards da Home do aluno), com números fictícios
 * marcados explicitamente como demonstração. Nenhum dado de cliente real é
 * usado. Ao adicionar capturas reais do tenant demo, este componente deve ser
 * substituído por <Image>.
 */
export default function HeroProduto() {
  return (
    <div className="relative">
      {/* Painel do proprietário */}
      <div className="surface rounded-3xl p-4 shadow-card sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Painel do proprietário
            </p>
            <p className="truncate text-sm font-semibold text-white">
              Resumo de hoje
            </p>
          </div>
          <span className="chip shrink-0 border-ink-600 bg-ink-700/60 text-[10px] text-slate-300">
            Demonstração
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Indicador
            icon={Users}
            label="Alunos ativos"
            valor="184"
            cor="text-volt-300"
          />
          <Indicador
            icon={Wallet}
            label="Recebido no mês"
            valor="R$ 21.480"
            cor="text-volt-300"
          />
          <Indicador
            icon={QrCode}
            label="Acessos hoje"
            valor="63"
            cor="text-cyanx-400"
          />
          <Indicador
            icon={TrendingUp}
            label="Precisam de atenção"
            valor="7"
            cor="text-magenta-400"
          />
        </div>

        {/* Barra de evolução — puramente ilustrativa, sem eixo/números */}
        <div className="mt-4 rounded-2xl border border-ink-600/60 bg-ink-900/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Resultado do mês
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-volt-300">
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> em alta
            </span>
          </div>
          <div className="mt-3 flex h-16 items-end gap-1.5" aria-hidden="true">
            {[38, 52, 45, 64, 58, 76, 70, 88].map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}%` }}
                className="flex-1 rounded-t bg-gradient-to-t from-volt-500/25 to-volt-300/70"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Celular com a área do aluno — abaixo no mobile, sobreposto no desktop */}
      <div className="mt-4 flex justify-center lg:absolute lg:-bottom-10 lg:-right-6 lg:mt-0 lg:justify-end">
        <div className="w-[190px] rounded-[1.75rem] border border-ink-600 bg-ink-900 p-2.5 shadow-card sm:w-[210px]">
          <div className="rounded-[1.35rem] bg-ink-950 p-3.5">
            <p className="text-[10px] text-slate-400">Academia Bairro Novo</p>
            <p className="text-sm font-bold text-white">Olá, Marina 👋</p>

            {/* QR — credencial apresentada à recepção */}
            <div className="mt-3 rounded-xl bg-white p-2.5">
              <div
                className="mx-auto grid h-16 w-16 grid-cols-4 grid-rows-4 gap-[2px]"
                aria-hidden="true"
              >
                {QR_PADRAO.map((preenchido, i) => (
                  <span
                    key={i}
                    className={preenchido ? "rounded-[1px] bg-ink-950" : ""}
                  />
                ))}
              </div>
            </div>
            <p className="mt-2 text-center text-[9px] text-slate-500">
              Apresente na recepção
            </p>

            <div className="mt-3 space-y-1.5">
              <LinhaApp
                icon={CheckCircle2}
                texto="Acesso liberado"
                cor="text-volt-300"
              />
              <LinhaApp icon={Dumbbell} texto="Treino B atualizado" cor="text-cyanx-400" />
              <LinhaApp icon={Wallet} texto="Mensalidade em dia" cor="text-volt-300" />
            </div>
          </div>
        </div>
      </div>

      {/* Selo flutuante — só no desktop, ancorado para nunca sair da tela */}
      <div className="pointer-events-none absolute -left-3 top-1/2 hidden -translate-y-1/2 xl:block">
        <div className="surface-strong flex items-center gap-2 rounded-xl px-3 py-2 shadow-card">
          <CheckCircle2 className="h-4 w-4 text-volt-300" aria-hidden="true" />
          <span className="text-xs font-medium text-white">Mensalidade recebida</span>
        </div>
      </div>
    </div>
  );
}

/** Padrão fixo de QR meramente decorativo — não codifica informação nenhuma. */
const QR_PADRAO = [
  true, true, false, true, true, false, true, false,
  true, false, true, true, false, true, false, true,
];

function Indicador({
  icon: Icon,
  label,
  valor,
  cor,
}: {
  icon: typeof Users;
  label: string;
  valor: string;
  cor: string;
}) {
  return (
    <div className="rounded-2xl border border-ink-600/60 bg-ink-900/50 p-3">
      <Icon className={`h-4 w-4 ${cor}`} aria-hidden="true" />
      <p className="mt-2 text-base font-bold leading-none text-white">{valor}</p>
      <p className="mt-1 text-[10px] leading-tight text-slate-400">{label}</p>
    </div>
  );
}

function LinhaApp({
  icon: Icon,
  texto,
  cor,
}: {
  icon: typeof Users;
  texto: string;
  cor: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-ink-800/70 px-2 py-1.5">
      <Icon className={`h-3 w-3 shrink-0 ${cor}`} aria-hidden="true" />
      <span className="truncate text-[9px] text-slate-300">{texto}</span>
    </div>
  );
}
