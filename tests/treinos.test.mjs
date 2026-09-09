/**
 * Testes de lib/treinos.ts — classificação de nível dos treinos-modelo depois
 * da desconflação origem × visibilidade (migrations 076 e 077).
 *
 * Roda com: npm run test:treinos
 * Mesmo esquema dos outros testes do projeto: compila lib/treinos.ts +
 * lib/types.ts para .test-build-treinos/ e roda com Node puro, sem framework.
 */
import {
  agruparTreinosPorAutor,
  nivelDoTreino,
} from "../.test-build-treinos/treinos.js";
import {
  normalizarNomeExercicio,
  resolverMidiaExercicio,
} from "../.test-build-treinos/exercicios-treino.js";

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

const ACAD = "11111111-1111-1111-1111-111111111111";

console.log("\n1. Dados migrados: origem_tipo define plataforma; visibilidade define o nível de tenant");
{
  check(
    "gestacad -> plataforma (mesmo com academia_id preenchido)",
    nivelDoTreino({ origem_tipo: "gestacad", academia_id: null, visibilidade: "academia" }) === "plataforma"
  );
  check(
    "instrutor + privado -> privado",
    nivelDoTreino({ origem_tipo: "instrutor", academia_id: ACAD, visibilidade: "privado" }) === "privado"
  );
  check(
    "instrutor + equipe -> equipe (nível NOVO, distinto de academia)",
    nivelDoTreino({ origem_tipo: "instrutor", academia_id: ACAD, visibilidade: "equipe" }) === "equipe"
  );
  // Chave da desconflação: a AUTORIA continua instrutor, mas compartilhar
  // (visibilidade) é que move o card de aba.
  check(
    "instrutor + academia -> academia (autoria não muda a aba)",
    nivelDoTreino({ origem_tipo: "instrutor", academia_id: ACAD, visibilidade: "academia" }) === "academia"
  );
  check(
    "academia (ficha) + academia -> academia",
    nivelDoTreino({ origem_tipo: "academia", academia_id: ACAD, visibilidade: "academia" }) === "academia"
  );
}

console.log("\n2. equipe e academia são níveis DISTINTOS");
{
  const equipe = nivelDoTreino({ origem_tipo: "instrutor", academia_id: ACAD, visibilidade: "equipe" });
  const academia = nivelDoTreino({ origem_tipo: "instrutor", academia_id: ACAD, visibilidade: "academia" });
  check("equipe !== academia", equipe !== academia);
  check("equipe é 'equipe'", equipe === "equipe");
  check("academia é 'academia'", academia === "academia");
}

console.log("\n3. Fallback pré-migração (sem origem_tipo, valores legados)");
{
  check(
    "academia_id nulo -> plataforma",
    nivelDoTreino({ origem_tipo: undefined, academia_id: null, visibilidade: "academia" }) === "plataforma"
  );
  check(
    "visibilidade legada 'plataforma' -> plataforma",
    nivelDoTreino({ origem_tipo: undefined, academia_id: ACAD, visibilidade: "plataforma" }) === "plataforma"
  );
  check(
    "visibilidade legada 'instrutor' -> privado",
    nivelDoTreino({ origem_tipo: undefined, academia_id: ACAD, visibilidade: "instrutor" }) === "privado"
  );
  check(
    "visibilidade 'academia' -> academia",
    nivelDoTreino({ origem_tipo: undefined, academia_id: ACAD, visibilidade: "academia" }) === "academia"
  );
}

console.log("\n4. origem_tipo tem precedência: não classifica plataforma falsa");
{
  check(
    "origem_tipo instrutor + visibilidade legada 'plataforma' -> academia (não plataforma)",
    nivelDoTreino({ origem_tipo: "instrutor", academia_id: ACAD, visibilidade: "academia" }) === "academia"
  );
  check(
    "gestacad vence visibilidade privado -> plataforma",
    nivelDoTreino({ origem_tipo: "gestacad", academia_id: null, visibilidade: "privado" }) === "plataforma"
  );
}

console.log("\nVínculo do exercício com a biblioteca (migração 098)");
{
  // O normalizador precisa concordar com public.normalizar_nome_exercicio
  // (SQL). Se um dos dois mudar sozinho, a importação liga um exercício que a
  // migração deixou solto — ou o contrário. Estes pares foram conferidos
  // rodando os dois lado a lado contra o Postgres.
  const pares = [
    ["Supino Reto com Barra", "supino reto com barra"],
    ["SUPINO RETO COM BARRA", "supino reto com barra"],
    ["Remada Baixa (Cabo)", "remada baixa"],
    ["Remada  Baixa   (Cabo)", "remada baixa"],
    ["Agachamento Sumô", "agachamento sumo"],
    ["Tríceps Testa", "triceps testa"],
    ["Elevação Pélvica", "elevacao pelvica"],
    ["Rosca Direta - Barra", "rosca direta barra"],
    ["Leg Press 45°", "leg press 45"],
    ["Crucifixo/Peck Deck", "crucifixo peck deck"],
    ["  Espaços  nas  Pontas  ", "espacos nas pontas"],
    ["Cadeira Extensora (leve)", "cadeira extensora"],
  ];
  for (const [entrada, esperado] of pares) {
    const obtido = normalizarNomeExercicio(entrada);
    check(
      "normaliza " + JSON.stringify(entrada),
      obtido === esperado,
      "-> " + JSON.stringify(obtido)
    );
  }

  const daBiblioteca = {
    imagem_demonstracao_url: "https://cdn/biblioteca.jpg",
    video_demonstracao_url: "https://cdn/biblioteca.mp4",
  };

  const semPropria = resolverMidiaExercicio({
    imagem_demonstracao_url: null,
    video_demonstracao_url: null,
    catalogo: daBiblioteca,
  });
  check(
    "sem imagem própria -> usa a da biblioteca",
    semPropria.imagem_demonstracao_url === "https://cdn/biblioteca.jpg"
  );
  check(
    "sem vídeo próprio -> usa o da biblioteca",
    semPropria.video_demonstracao_url === "https://cdn/biblioteca.mp4"
  );
  check(
    "a chave `catalogo` não vaza para o componente",
    !("catalogo" in semPropria)
  );

  const comPropria = resolverMidiaExercicio({
    imagem_demonstracao_url: "https://cdn/foto-do-professor.jpg",
    video_demonstracao_url: null,
    catalogo: daBiblioteca,
  });
  check(
    "imagem própria SEMPRE vence a da biblioteca",
    comPropria.imagem_demonstracao_url === "https://cdn/foto-do-professor.jpg"
  );

  // Importações antigas gravaram "" em vez de null — vazio conta como ausência.
  const vazio = resolverMidiaExercicio({
    imagem_demonstracao_url: "",
    video_demonstracao_url: "   ",
    catalogo: daBiblioteca,
  });
  check(
    "string vazia conta como ausente (imagem)",
    vazio.imagem_demonstracao_url === "https://cdn/biblioteca.jpg"
  );
  check(
    "só espaços conta como ausente (vídeo)",
    vazio.video_demonstracao_url === "https://cdn/biblioteca.mp4"
  );

  const semNada = resolverMidiaExercicio({
    imagem_demonstracao_url: null,
    video_demonstracao_url: null,
    catalogo: null,
  });
  check(
    "sem imagem em lugar nenhum -> null (o card mostra o placeholder)",
    semNada.imagem_demonstracao_url === null
  );
}

console.log("\nAgrupar por autor (visão \"Por instrutor\" da biblioteca)");
{
  const RODRIGO = "aaaaaaaa-0000-0000-0000-000000000001";
  const VINICIUS = "bbbbbbbb-0000-0000-0000-000000000002";
  const equipe = [
    { id: RODRIGO, nome: "Rodrigo", papel: "instrutor" },
    { id: VINICIUS, nome: "Vinícius", papel: "instrutor" },
  ];
  const modelo = (extra) => ({
    academia_id: ACAD,
    aluno_id: null,
    origem_tipo: "instrutor",
    visibilidade: "equipe",
    criado_por: null,
    profissional_nome: null,
    ...extra,
  });

  const base = [
    modelo({ id: "t1", criado_por: VINICIUS, nome_treino: "Peito A" }),
    modelo({ id: "t2", criado_por: RODRIGO, nome_treino: "Perna A" }),
    modelo({ id: "t3", criado_por: RODRIGO, nome_treino: "Costas A" }),
  ];

  const g = agruparTreinosPorAutor(base, equipe);
  check("um bloco por autor", g.length === 2, `(${g.length})`);
  check("ordem alfabética: Rodrigo antes de Vinícius", g[0].nome === "Rodrigo");
  check("Rodrigo leva os 2 treinos dele", g[0].treinos.length === 2);
  check(
    "Vinícius leva 1 treino",
    g[1].nome === "Vinícius" && g[1].treinos.length === 1
  );
  check("papel vem do perfil atual", g[0].papel === "instrutor");
  check(
    "nenhum treino se perde no agrupamento",
    g.reduce((n, x) => n + x.treinos.length, 0) === base.length
  );

  // Nome do perfil atual tem precedência sobre o congelado no treino.
  const renomeado = agruparTreinosPorAutor(
    [
      modelo({
        id: "t4",
        criado_por: RODRIGO,
        profissional_nome: "Rodrigo (antigo)",
      }),
    ],
    equipe
  );
  check(
    "nome do perfil vence o profissional_nome antigo",
    renomeado[0].nome === "Rodrigo"
  );

  // Autor que saiu da academia: cai para o nome gravado no treino.
  const exFuncionario = agruparTreinosPorAutor(
    [
      modelo({
        id: "t5",
        criado_por: "cccccccc-0000-0000-0000-000000000003",
        profissional_nome: "Marcos",
      }),
    ],
    equipe
  );
  check(
    "autor fora da equipe usa o profissional_nome",
    exFuncionario[0].nome === "Marcos"
  );

  // Sem criado_por (importação antiga): agrupa pelo nome do profissional.
  const importados = agruparTreinosPorAutor(
    [
      modelo({ id: "t6", profissional_nome: "Rodrigo" }),
      modelo({ id: "t7", profissional_nome: "rodrigo" }),
    ],
    []
  );
  check("mesmo nome com caixa diferente cai num bloco só", importados.length === 1);
  check("bloco por nome junta os dois treinos", importados[0].treinos.length === 2);

  // Sem autoria nenhuma e modelo da plataforma têm posição fixa no fim.
  const mistura = agruparTreinosPorAutor(
    [
      modelo({ id: "t8" }),
      modelo({
        id: "t9",
        academia_id: null,
        origem_tipo: "gestacad",
        visibilidade: "academia",
      }),
      modelo({ id: "t10", criado_por: VINICIUS }),
    ],
    equipe
  );
  check(
    "ordem final: pessoa, sem autor, plataforma",
    mistura.map((x) => x.chave).join("|").endsWith("__sem_autor__|__gestacad__")
  );
  check("plataforma é o último bloco", mistura[mistura.length - 1].ehPlataforma === true);
  check("bloco sem autor é sinalizado", mistura[1].ehSemAutor === true);

  // Ficha de aluno nunca entra na biblioteca por autor.
  const comFicha = agruparTreinosPorAutor(
    [modelo({ id: "t11", criado_por: RODRIGO, aluno_id: "aluno-1" })],
    equipe
  );
  check("ficha de aluno é ignorada", comFicha.length === 0);

  // Roster completo: instrutor sem treino visível continua aparecendo.
  const roster = agruparTreinosPorAutor(
    [modelo({ id: "t12", criado_por: RODRIGO })],
    equipe,
    { incluirEquipeSemTreinos: true }
  );
  check("equipe inteira aparece mesmo sem treino", roster.length === 2);
  check(
    "instrutor sem treino vem com lista vazia",
    roster.find((x) => x.nome === "Vinícius")?.treinos.length === 0
  );
  check(
    "sem a opção, quem não tem treino não vira bloco",
    agruparTreinosPorAutor([modelo({ id: "t13", criado_por: RODRIGO })], equipe)
      .length === 1
  );

  check("lista vazia devolve nenhum bloco", agruparTreinosPorAutor([], []).length === 0);
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
