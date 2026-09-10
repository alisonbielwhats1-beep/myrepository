/**
 * Testes de lib/evolucao-aluno.ts — a tela "Minha evolução" do aluno.
 *
 * Roda com: npm run test:evolucao
 */
import {
  evolucaoDasMedidas,
  formatarMedida,
  fotosDeComparacao,
  serieDaMedida,
  sparkline,
} from "../.test-build-evolucao/evolucao-aluno.js";

let passou = 0;
let falhou = 0;
function check(nome, cond, detalhe = "") {
  if (cond) {
    passou++;
    console.log(`  OK   ${nome}`);
  } else {
    falhou++;
    console.log(`  FALHA ${nome} ${detalhe}`);
  }
}

const vazio = {
  peso_kg: null,
  percentual_gordura: null,
  peito_cm: null,
  cintura_cm: null,
  quadril_cm: null,
  braco_cm: null,
  coxa_cm: null,
  foto_url: null,
};
const med = (id, data, extra) => ({ id, data, ...vazio, ...extra });

console.log("\n1. Série de uma medida");
{
  const p = [
    med("c", "2026-03-01", { peso_kg: 78 }),
    med("a", "2026-01-01", { peso_kg: 82 }),
    med("b", "2026-02-01", { peso_kg: 80 }),
  ];
  const serie = serieDaMedida(p, "peso_kg");
  check("ordena por data, não pela ordem recebida", serie[0].data === "2026-01-01");
  check("mantém todos os pontos", serie.length === 3);
  check("último é o mais recente", serie[2].valor === 78);

  const comBuraco = [
    med("a", "2026-01-01", { peso_kg: 82, cintura_cm: 95 }),
    med("b", "2026-02-01", { peso_kg: 80 }),
    med("c", "2026-03-01", { peso_kg: 78, cintura_cm: 90 }),
  ];
  check(
    "medida ausente na avaliação não vira ponto",
    serieDaMedida(comBuraco, "cintura_cm").length === 2
  );
  check("medida sem nenhum registro devolve vazio", serieDaMedida(comBuraco, "coxa_cm").length === 0);
}

console.log("\n2. Evolução primeiro × último");
{
  const p = [
    med("a", "2026-01-01", { peso_kg: 82, cintura_cm: 95, braco_cm: 32 }),
    med("b", "2026-04-01", { peso_kg: 78.5, cintura_cm: 89 }),
  ];
  const ev = evolucaoDasMedidas(p);
  const peso = ev.find((x) => x.chave === "peso_kg");
  check("peso entra", !!peso);
  check("delta negativo quando diminuiu", peso.delta === -3.5, `(${peso.delta})`);
  check("guarda as datas das pontas", peso.dataPrimeiro === "2026-01-01" && peso.dataUltimo === "2026-04-01");
  check("conta as medições", peso.medicoes === 2);
  check(
    "medida com uma única leitura fica FORA (não há evolução)",
    !ev.some((x) => x.chave === "braco_cm")
  );
  check("peso vem antes de cintura (ordem de leitura)", ev[0].chave === "peso_kg");
  check(
    "cintura também entra",
    ev.some((x) => x.chave === "cintura_cm" && x.delta === -6)
  );

  check("uma medição só não produz evolução nenhuma", evolucaoDasMedidas([p[0]]).length === 0);
  check("lista vazia não quebra", evolucaoDasMedidas([]).length === 0);

  const ganho = evolucaoDasMedidas([
    med("a", "2026-01-01", { peso_kg: 70 }),
    med("b", "2026-06-01", { peso_kg: 74.2 }),
  ]);
  check("delta positivo quando aumentou", ganho[0].delta === 4.2, `(${ganho[0].delta})`);
}

console.log("\n3. Antes e depois em foto");
{
  const semFoto = [med("a", "2026-01-01", { peso_kg: 80 })];
  check("sem foto nenhuma devolve null", fotosDeComparacao(semFoto) === null);

  const umaFoto = [med("a", "2026-01-01", { foto_url: "https://cdn/1.jpg" })];
  check("uma foto só não é comparação", fotosDeComparacao(umaFoto) === null);

  const duas = [
    med("b", "2026-05-01", { foto_url: "https://cdn/3.jpg" }),
    med("a", "2026-01-01", { foto_url: "https://cdn/1.jpg" }),
    med("meio", "2026-03-01", { peso_kg: 79 }),
  ];
  const par = fotosDeComparacao(duas);
  check("pega a primeira e a última COM foto", par.antes.data === "2026-01-01" && par.depois.data === "2026-05-01");

  const vazia = [
    med("a", "2026-01-01", { foto_url: "   " }),
    med("b", "2026-05-01", { foto_url: "https://cdn/3.jpg" }),
  ];
  check("string em branco não conta como foto", fotosDeComparacao(vazia) === null);
}

console.log("\n4. Sparkline");
{
  const pontos = [
    { data: "2026-01-01", valor: 80 },
    { data: "2026-02-01", valor: 78 },
    { data: "2026-03-01", valor: 76 },
  ];
  const s = sparkline(pontos, 300, 60);
  check("recua da borda esquerda (o marcador não pode sair cortado)", s.linha.startsWith("M4.0,"));
  check("três pontos viram três comandos", s.linha.split(/[ML]/).filter(Boolean).length === 3);
  check(
    "área fecha no rodapé sobre o mesmo intervalo da linha",
    s.area.endsWith("L296.0,60 L4.0,60 Z"),
    `(${s.area.slice(-24)})`
  );
  check("último x recua o padding da largura", Math.round(s.fim.x) === 296);
  check("min e max corretos", s.minimo === 76 && s.maximo === 80);
  check(
    "todas as coordenadas ficam dentro da caixa, com folga nas bordas",
    [...s.linha.matchAll(/[ML]([\d.]+),([\d.]+)/g)].every(
      (m) => Number(m[1]) >= 4 && Number(m[1]) <= 296 && Number(m[2]) >= 0 && Number(m[2]) <= 60
    )
  );

  const plano = sparkline(
    [
      { data: "2026-01-01", valor: 75 },
      { data: "2026-02-01", valor: 75 },
    ],
    100,
    40
  );
  check("valores iguais não dividem por zero", plano.linha === "M4.0,20.0 L96.0,20.0");

  // A tela passa um recuo maior que o padrão, do tamanho do marcador do último
  // ponto — é esse valor que roda em produção.
  const comRecuo = sparkline(pontos, 300, 60, 7);
  check("recuo explícito afasta as duas pontas", comRecuo.linha.startsWith("M7.0,"));
  check("recuo explícito encolhe o fim na mesma medida", Math.round(comRecuo.fim.x) === 293);

  check("um ponto só não vira gráfico", sparkline([pontos[0]], 300, 60) === null);
  check("lista vazia não vira gráfico", sparkline([], 300, 60) === null);
  check("largura zero não vira gráfico", sparkline(pontos, 0, 60) === null);
}

console.log("\n5. Formatação");
{
  check("peso com uma casa", formatarMedida(78.5, "kg", 1) === "78,5 kg");
  check("medida sem casas", formatarMedida(90, "cm", 0) === "90 cm");
  check("variação positiva ganha +", formatarMedida(4.2, "kg", 1, true) === "+4,2 kg");
  check("variação negativa usa sinal de menos real", formatarMedida(-3.5, "kg", 1, true) === "−3,5 kg");
  check("variação zero não ganha sinal", formatarMedida(0, "cm", 0, true) === "0 cm");
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
