/**
 * Testes de lib/progressao-carga.ts — a sugestão de "tenta X kg hoje".
 *
 * A maior parte destes casos é sobre QUANDO NÃO sugerir. A tela aparece para
 * alguém sozinho na sala prestes a levantar peso: sugerir de menos é inofensivo,
 * sugerir de mais não é.
 *
 * Roda com: npm run test:progressao
 */
import {
  formatarCarga,
  incrementoPara,
  sugerirCarga,
  sugestoesDeCarga,
} from "../.test-build-progressao/progressao-carga.js";

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

const exec = (extra) => ({ carga: 40, esforco: "leve", concluido: true, ...extra });

console.log("\n1. Quando NÃO sugerir (a parte que protege o aluno)");
{
  check("sem histórico nenhum", sugerirCarga(null) === null);
  check("undefined não quebra", sugerirCarga(undefined) === null);
  check(
    "esforço 'médio' segura — a carga já está certa",
    sugerirCarga(exec({ esforco: "medio" })) === null
  );
  check(
    "esforço 'pesado' segura — já está no limite",
    sugerirCarga(exec({ esforco: "pesado" })) === null
  );
  check(
    "esforço não informado NÃO conta como leve",
    sugerirCarga(exec({ esforco: null })) === null
  );
  check(
    "não concluiu o exercício: nada de subir peso",
    sugerirCarga(exec({ concluido: false })) === null
  );
  check("carga zero não vira sugestão", sugerirCarga(exec({ carga: 0 })) === null);
  check("carga negativa não vira sugestão", sugerirCarga(exec({ carga: -10 })) === null);
  check("carga não numérica não quebra", sugerirCarga(exec({ carga: NaN })) === null);
  check(
    "exercício sem carga (peso do corpo) fica de fora",
    sugerirCarga(exec({ carga: 0, esforco: "leve" })) === null
  );
}

console.log("\n2. Quando sugerir, e quanto");
{
  const s = sugerirCarga(exec({ carga: 40 }));
  check("leve + concluído gera sugestão", s !== null);
  check("sobe um passo de 2,5 kg em 40 kg", s.carga === 42.5, `(${s.carga})`);
  check("informa o incremento", s.incremento === 2.5);
  check("guarda a carga anterior, para a tela explicar", s.anterior === 40);

  check("halter leve sobe de 1 em 1", sugerirCarga(exec({ carga: 6 })).carga === 7);
  check("faixa do meio sobe de 2 em 2", sugerirCarga(exec({ carga: 12 })).carga === 14);
  check("acima de 50 kg sobe de 5 em 5", sugerirCarga(exec({ carga: 80 })).carga === 85);
  check(
    "carga quebrada continua quebrada de forma usável",
    sugerirCarga(exec({ carga: 42.5 })).carga === 45
  );
  check(
    "sem lixo de ponto flutuante",
    String(sugerirCarga(exec({ carga: 22.5 })).carga) === "25"
  );
}

console.log("\n3. Limites das faixas de incremento");
{
  check("9,9 kg ainda é passo de 1", incrementoPara(9.9) === 1);
  check("10 kg já é passo de 2", incrementoPara(10) === 2);
  check("19,9 kg ainda é passo de 2", incrementoPara(19.9) === 2);
  check("20 kg já é passo de 2,5", incrementoPara(20) === 2.5);
  check("49,9 kg ainda é passo de 2,5", incrementoPara(49.9) === 2.5);
  check("50 kg já é passo de 5", incrementoPara(50) === 5);
  check("carga altíssima não estoura o passo", incrementoPara(300) === 5);
  check("nunca sugere mais de um passo", sugerirCarga(exec({ carga: 100 })).incremento === 5);
}

console.log("\n4. Mapa de sugestões (o que a tela recebe)");
{
  const mapa = sugestoesDeCarga({
    a: exec({ carga: 40, esforco: "leve" }),
    b: exec({ carga: 30, esforco: "pesado" }),
    c: exec({ carga: 20, esforco: "leve", concluido: false }),
    d: exec({ carga: 60, esforco: "leve" }),
  });
  check("só entram os que renderam sugestão", Object.keys(mapa).sort().join(",") === "a,d");
  check("valores corretos", mapa.a.carga === 42.5 && mapa.d.carga === 65);
  check("mapa vazio devolve vazio", Object.keys(sugestoesDeCarga({})).length === 0);
  check("mapa nulo não quebra", Object.keys(sugestoesDeCarga(null)).length === 0);
}

console.log("\n5. Formatação");
{
  check("inteiro sem casas", formatarCarga(45) === "45");
  check("meio quilo com vírgula", formatarCarga(42.5) === "42,5");
  check("não inventa casas", formatarCarga(7) === "7");
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
