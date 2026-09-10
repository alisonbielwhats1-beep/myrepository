import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Camera, Minus, Ruler, Trophy } from "lucide-react";
import {
  evolucaoDasMedidas,
  formatarMedida,
  fotosDeComparacao,
  serieDaMedida,
  sparkline,
  type EvolucaoMedida,
} from "@/lib/evolucao-aluno";
import type { ProgressoPublico } from "@/lib/types";
import { cn, formatDataISO } from "@/lib/utils";

/**
 * "Minha evolução" — o que mudou no corpo do aluno desde a primeira avaliação.
 *
 * Nada aqui pinta variação de verde ou vermelho: emagrecer é bom para quem quer
 * emagrecer e ruim para quem está ganhando massa, e a ficha pública não carrega
 * o objetivo do aluno. Mostramos a direção; o julgamento é dele e do instrutor.
 */
export default function EvolucaoCorpo({
  base,
  progresso,
  recordes,
}: {
  /** Prefixo das rotas do aluno, para os links internos. */
  base: string;
  progresso: ProgressoPublico[];
  recordes: { nome: string; kg: number }[];
}) {
  const medidas = evolucaoDasMedidas(progresso);
  const fotos = fotosDeComparacao(progresso);
  const peso = medidas.find((m) => m.chave === "peso_kg");
  const demais = medidas.filter((m) => m.chave !== "peso_kg");
  const vazio = medidas.length === 0 && recordes.length === 0;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-slate-400">Seu corpo ao longo do tempo</p>
        <h1 className="text-2xl font-bold text-white">Minha evolução</h1>
      </header>

      {vazio && (
        <div className="surface rounded-2xl p-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-volt-300/15 text-volt-300">
            <Ruler className="h-6 w-6" />
          </span>
          <h2 className="mt-3 font-semibold text-white">
            {progresso.length === 1
              ? "Você tem uma avaliação registrada"
              : "Nenhuma avaliação registrada ainda"}
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
            {progresso.length === 1
              ? "A partir da segunda avaliação esta tela mostra o quanto você mudou. Combine a próxima com seu instrutor."
              : "Peça uma avaliação física na recepção. Com peso e medidas registrados, esta tela passa a mostrar sua evolução."}
          </p>
          <Link
            href={`${base}/treinos`}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-volt-300"
          >
            Ir para os treinos
          </Link>
        </div>
      )}

      {/* Peso — herói da tela, com a linha do tempo das medições. */}
      {peso && <CardPeso medida={peso} pontos={serieDaMedida(progresso, "peso_kg")} />}

      {demais.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Suas medidas
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {demais.map((m) => (
              <CardMedida key={m.chave} medida={m} />
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Comparado com a sua primeira avaliação, em{" "}
            {formatDataISO(demais[0].dataPrimeiro)}.
          </p>
        </section>
      )}

      {fotos && (
        <section>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-400">
            <Camera className="h-4 w-4" /> Antes e depois
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { rotulo: "Antes", item: fotos.antes },
              { rotulo: "Agora", item: fotos.depois },
            ].map(({ rotulo, item }) => (
              <figure key={item.id} className="surface overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.foto_url ?? ""}
                  alt={`Foto da avaliação de ${formatDataISO(item.data)}`}
                  className="media-native aspect-[3/4] w-full object-cover"
                />
                <figcaption className="flex items-baseline justify-between gap-2 p-3">
                  <span className="text-sm font-semibold text-white">{rotulo}</span>
                  <span className="text-xs text-slate-400">
                    {formatDataISO(item.data)}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Recordes de carga — evolução na sala, não na fita métrica. */}
      {recordes.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-400">
            <Trophy className="h-4 w-4" /> Seus recordes
          </h2>
          <ul className="divide-y divide-ink-700/70 overflow-hidden rounded-2xl border border-ink-700 bg-ink-800/40">
            {recordes.map((r) => (
              <li key={r.nome} className="flex items-center justify-between gap-3 p-3.5">
                <span className="min-w-0 truncate text-sm text-slate-200">{r.nome}</span>
                <span className="stat-value flex-none text-base text-volt-300">
                  {r.kg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Maior carga que você registrou em cada exercício.
          </p>
        </section>
      )}
    </div>
  );
}

/** Direção da variação — sem cor de julgamento, só a seta e o número. */
function Variacao({ medida }: { medida: EvolucaoMedida }) {
  const Icone =
    medida.delta > 0 ? ArrowUpRight : medida.delta < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm font-semibold",
        medida.delta === 0 ? "text-slate-400" : "text-volt-300"
      )}
    >
      <Icone className="h-4 w-4" />
      {formatarMedida(medida.delta, medida.unidade, medida.casas, true)}
    </span>
  );
}

function CardPeso({
  medida,
  pontos,
}: {
  medida: EvolucaoMedida;
  pontos: { data: string; valor: number }[];
}) {
  const LARGURA = 320;
  const ALTURA = 64;
  const RAIO_MARCADOR = 3.5;
  // Recuo maior que o raio do marcador do último ponto: com o recuo padrão ele
  // encostava na borda direita e sobrava meio pixel de folga — qualquer
  // arredondamento do navegador o cortaria ao meio.
  const linha = sparkline(pontos, LARGURA, ALTURA, RAIO_MARCADOR * 2);

  return (
    <section className="surface rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-muted">Peso hoje</p>
          <p className="stat-value mt-1 text-3xl">
            {formatarMedida(medida.ultimo, medida.unidade, medida.casas)}
          </p>
        </div>
        <div className="text-right">
          <p className="label-muted">Desde o início</p>
          <p className="mt-1">
            <Variacao medida={medida} />
          </p>
        </div>
      </div>

      {linha && (
        <svg
          viewBox={`0 0 ${LARGURA} ${ALTURA}`}
          className="mt-4 h-16 w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Peso de ${formatarMedida(medida.primeiro, medida.unidade, medida.casas)} em ${formatDataISO(medida.dataPrimeiro)} até ${formatarMedida(medida.ultimo, medida.unidade, medida.casas)} em ${formatDataISO(medida.dataUltimo)}, em ${medida.medicoes} medições.`}
        >
          <path d={linha.area} fill="rgb(190 242 100 / 0.12)" stroke="none" />
          <path
            d={linha.linha}
            fill="none"
            stroke="rgb(190 242 100)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={linha.fim.x}
            cy={linha.fim.y}
            r={RAIO_MARCADOR}
            fill="rgb(190 242 100)"
          />
        </svg>
      )}

      <div className="mt-2 flex items-baseline justify-between text-xs text-slate-500">
        <span>
          {formatarMedida(medida.primeiro, medida.unidade, medida.casas)} ·{" "}
          {formatDataISO(medida.dataPrimeiro)}
        </span>
        <span>
          {medida.medicoes} {medida.medicoes === 1 ? "medição" : "medições"}
        </span>
      </div>
    </section>
  );
}

function CardMedida({ medida }: { medida: EvolucaoMedida }) {
  return (
    <div className="surface rounded-2xl p-4">
      <p className="label-muted">{medida.label}</p>
      <p className="stat-value mt-1.5 text-xl">
        {formatarMedida(medida.ultimo, medida.unidade, medida.casas)}
      </p>
      <p className="mt-1">
        <Variacao medida={medida} />
      </p>
    </div>
  );
}
