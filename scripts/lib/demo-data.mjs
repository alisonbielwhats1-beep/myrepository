// =============================================================================
// scripts/lib/demo-data.mjs
// Dataset de demonstração: inserção, remoção e validação de contagens.
// Compartilhado por criar-demo.mjs e reset-demo.mjs.
//
// Regras do dataset:
//   • Datas sempre relativas à execução — sem crescimento ilimitado.
//   • Períodos limitados a 12 meses no passado.
//   • Nenhuma dependência de catalogo_exercicios (exercícios inline).
//   • Todos os registros marcados com observacoes '[DEMO]' quando possível.
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de data
// ─────────────────────────────────────────────────────────────────────────────

/** Formata Date como 'YYYY-MM-DD'. */
function fmt(d) {
  return d.toISOString().slice(0, 10);
}

/** Primeiro dia do mês, N meses atrás (0 = mês atual). */
function primeiroDeMes(n = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Data com dia específico, N meses atrás. */
function diaMes(dia, mesesAtras = 0) {
  const d = primeiroDeMes(mesesAtras);
  d.setDate(dia);
  return d;
}

/** Data N dias atrás, às 08h. */
function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(8, 0, 0, 0);
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dataset estático
// ─────────────────────────────────────────────────────────────────────────────

const PLANOS = [
  { nome: 'Mensal',     descricao: 'Acesso completo, renovação mensal',        valor_mensal:  99.90, recorrencia_meses: 1 },
  { nome: 'Trimestral', descricao: 'Acesso completo, trimestral com desconto', valor_mensal: 269.90, recorrencia_meses: 3 },
  { nome: 'Semestral',  descricao: 'Acesso completo, semestral melhor preço',  valor_mensal: 479.90, recorrencia_meses: 6 },
];

const FUNCIONARIOS = [
  { nome: 'Carlos Eduardo Souza', cargo: 'Instrutor de musculação', mesesAtras: 10, salario: 2200.00, dia_pagamento:  5, cpf: 'DEMO-F01' },
  { nome: 'Renata Alves',         cargo: 'Recepcionista',           mesesAtras:  7, salario: 1650.00, dia_pagamento:  5, cpf: 'DEMO-F02' },
  { nome: 'Felipe Nascimento',    cargo: 'Personal trainer',        mesesAtras:  5, salario: 2500.00, dia_pagamento: 10, cpf: 'DEMO-F03' },
  { nome: 'Juliana Reis',         cargo: 'Auxiliar de limpeza',     mesesAtras:  3, salario: 1450.00, dia_pagamento:  5, cpf: 'DEMO-F04' },
];

//  inadimplente → mensalidade do mês anterior vencida e não paga
//  sumido       → sem acesso nos últimos 14 dias (dispara alerta)
const ALUNOS = [
  { idx:  1, nome: 'Marina Costa',        status: 'ativa',    mesesAtras: 11, planoIdx: 0, cpf: 'DEMO-001' },
  { idx:  2, nome: 'Lucas Almeida',        status: 'ativa',    mesesAtras:  9, planoIdx: 0, cpf: 'DEMO-002' },
  { idx:  3, nome: 'Beatriz Ramos',        status: 'ativa',    mesesAtras:  8, planoIdx: 1, cpf: 'DEMO-003' },
  { idx:  4, nome: 'Pedro Henrique Silva', status: 'ativa',    mesesAtras:  7, planoIdx: 0, cpf: 'DEMO-004' },
  { idx:  5, nome: 'Camila Ferreira',      status: 'ativa',    mesesAtras:  6, planoIdx: 0, cpf: 'DEMO-005', inadimplente: true },
  { idx:  6, nome: 'Rafael Souza',         status: 'ativa',    mesesAtras:  5, planoIdx: 1, cpf: 'DEMO-006' },
  { idx:  7, nome: 'Juliana Martins',      status: 'ativa',    mesesAtras:  4, planoIdx: 0, cpf: 'DEMO-007', inadimplente: true },
  { idx:  8, nome: 'Gabriel Oliveira',     status: 'ativa',    mesesAtras:  4, planoIdx: 0, cpf: 'DEMO-008', sumido: true },
  { idx:  9, nome: 'Larissa Rocha',        status: 'ativa',    mesesAtras:  3, planoIdx: 2, cpf: 'DEMO-009', sumido: true },
  { idx: 10, nome: 'Thiago Pereira',       status: 'ativa',    mesesAtras:  2, planoIdx: 0, cpf: 'DEMO-010', inadimplente: true },
  { idx: 11, nome: 'Fernanda Lima',        status: 'trancada', mesesAtras:  5, planoIdx: 0, cpf: 'DEMO-011' },
  { idx: 12, nome: 'Rodrigo Barbosa',      status: 'trancada', mesesAtras:  4, planoIdx: 1, cpf: 'DEMO-012' },
  { idx: 13, nome: 'Diego Santos',         status: 'inativa',  mesesAtras:  7, planoIdx: 0, cpf: 'DEMO-013' },
  { idx: 14, nome: 'Patrícia Gomes',       status: 'inativa',  mesesAtras:  5, planoIdx: 0, cpf: 'DEMO-014' },
  { idx: 15, nome: 'Eduardo Cardoso',      status: 'pendente', mesesAtras:  0, planoIdx: 0, cpf: 'DEMO-015' },
  { idx: 16, nome: 'Amanda Nogueira',      status: 'ativa',    mesesAtras:  1, planoIdx: 0, cpf: 'DEMO-016' },
];

const PRODUTOS = [
  { nome: 'Whey Protein 900g',  categoria: 'suplemento', preco: 149.90, estoque: 12, destaque: true,  ordem: 1 },
  { nome: 'Coqueteleira 700ml', categoria: 'acessorio',  preco:  39.90, estoque:  8, destaque: false, ordem: 2 },
  { nome: 'Camiseta Dry-fit',   categoria: 'vestuario',  preco:  69.90, estoque: 15, destaque: true,  ordem: 3 },
  { nome: 'Luva de treino',     categoria: 'acessorio',  preco:  59.90, estoque:  6, destaque: false, ordem: 4 },
  { nome: 'Barra de proteína',  categoria: 'suplemento', preco:   8.90, estoque: 30, destaque: false, ordem: 5 },
];

// Fichas de treino vinculadas a alunos por índice 0-based de ALUNOS
const TREINOS_FICHAS = [
  {
    alunoIdx: 0,
    nome_treino: 'Treino A – Peito e Tríceps', objetivo: 'Hipertrofia', modalidade: 'Musculação', publico: true,
    exercicios: [
      { nome_exercicio: 'Supino reto com barra',    series: 4, repeticoes: '8–10',     carga_kg: 30, descanso_segundos: 90, ordem: 1 },
      { nome_exercicio: 'Supino inclinado halter',  series: 3, repeticoes: '10–12',    carga_kg: 20, descanso_segundos: 75, ordem: 2 },
      { nome_exercicio: 'Crossover no cabo',        series: 3, repeticoes: '12–15',    carga_kg: 10, descanso_segundos: 60, ordem: 3 },
      { nome_exercicio: 'Tríceps na polia alta',    series: 3, repeticoes: '12',       carga_kg:  8, descanso_segundos: 60, ordem: 4 },
      { nome_exercicio: 'Mergulho no banco',        series: 3, repeticoes: 'até falha',carga_kg:  0, descanso_segundos: 60, ordem: 5 },
    ],
  },
  {
    alunoIdx: 1,
    nome_treino: 'Treino B – Costas e Bíceps', objetivo: 'Hipertrofia', modalidade: 'Musculação', publico: false,
    exercicios: [
      { nome_exercicio: 'Puxada frontal na polia',  series: 4, repeticoes: '10',    carga_kg: 40, descanso_segundos: 90, ordem: 1 },
      { nome_exercicio: 'Remada curvada com barra', series: 3, repeticoes: '10–12', carga_kg: 35, descanso_segundos: 75, ordem: 2 },
      { nome_exercicio: 'Remada unilateral',        series: 3, repeticoes: '12',    carga_kg: 20, descanso_segundos: 60, ordem: 3 },
      { nome_exercicio: 'Rosca direta com barra',   series: 3, repeticoes: '12',    carga_kg: 15, descanso_segundos: 60, ordem: 4 },
      { nome_exercicio: 'Rosca martelo',            series: 3, repeticoes: '12',    carga_kg: 10, descanso_segundos: 60, ordem: 5 },
    ],
  },
  {
    alunoIdx: 3,
    nome_treino: 'Treino C – Pernas', objetivo: 'Força', modalidade: 'Musculação', publico: false,
    exercicios: [
      { nome_exercicio: 'Agachamento livre',        series: 5, repeticoes: '5',      carga_kg: 60,  descanso_segundos: 180, ordem: 1 },
      { nome_exercicio: 'Leg press 45°',            series: 4, repeticoes: '8–10',   carga_kg: 100, descanso_segundos: 120, ordem: 2 },
      { nome_exercicio: 'Cadeira extensora',        series: 3, repeticoes: '12',     carga_kg: 40,  descanso_segundos:  75, ordem: 3 },
      { nome_exercicio: 'Mesa flexora',             series: 3, repeticoes: '12',     carga_kg: 30,  descanso_segundos:  75, ordem: 4 },
      { nome_exercicio: 'Panturrilha em pé',        series: 4, repeticoes: '15',     carga_kg:  0,  descanso_segundos:  60, ordem: 5 },
    ],
  },
  {
    alunoIdx: 8,
    nome_treino: 'Full Body – Emagrecimento', objetivo: 'Emagrecimento', modalidade: 'Funcional', publico: true,
    exercicios: [
      { nome_exercicio: 'Burpee',                   series: 3, repeticoes: '10',  carga_kg: 0, descanso_segundos: 60, ordem: 1 },
      { nome_exercicio: 'Agachamento com salto',    series: 3, repeticoes: '12',  carga_kg: 0, descanso_segundos: 45, ordem: 2 },
      { nome_exercicio: 'Flexão de braço',          series: 3, repeticoes: '10',  carga_kg: 0, descanso_segundos: 60, ordem: 3 },
      { nome_exercicio: 'Prancha abdominal',        series: 3, repeticoes: '30s', carga_kg: 0, descanso_segundos: 30, ordem: 4 },
      { nome_exercicio: 'Mountain climber',         series: 3, repeticoes: '20',  carga_kg: 0, descanso_segundos: 45, ordem: 5 },
    ],
  },
];

// Progressos para 3 alunos (alunoIdx 0-based de ALUNOS)
const PROGRESSOS_CONFIG = [
  { alunoIdx: 0, pesoInicial: 73.5, gorduraInicial: 28.0, tendencia: 'perder',  medicoes: 5 }, // Marina
  { alunoIdx: 3, pesoInicial: 88.0, gorduraInicial: 19.0, tendencia: 'ganhar',  medicoes: 4 }, // Pedro
  { alunoIdx: 8, pesoInicial: 71.0, gorduraInicial: 26.5, tendencia: 'perder',  medicoes: 4 }, // Larissa
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de geração
// ─────────────────────────────────────────────────────────────────────────────

function gerarMensalidades(academiaId, alunoId, aluno, planoValor) {
  const registros = [];
  const { mesesAtras, status, inadimplente, nome } = aluno;

  // Para alunos não-ativos não geramos o mês atual (cobrança cessou).
  const limiteMin = status === 'ativa' ? 0 : 1;

  for (let i = mesesAtras; i >= limiteMin; i--) {
    const competencia = fmt(primeiroDeMes(i));
    const dataVenc    = fmt(diaMes(10, i));

    let pagStatus;
    if (i === 0) {
      // Mês atual: sempre pendente
      pagStatus = 'pendente';
    } else if (i === 1 && inadimplente) {
      // Mês anterior de inadimplente: vencida (data no passado, status pendente)
      pagStatus = 'pendente';
    } else {
      pagStatus = 'pago';
    }

    registros.push({
      academia_id: academiaId,
      aluno_id:    alunoId,
      tipo:        'mensalidade',
      descricao:   `Mensalidade – ${nome}`,
      valor:       planoValor,
      data:        dataVenc,
      status:      pagStatus,
      competencia,
      observacoes: '[DEMO]',
    });
  }

  return registros;
}

function gerarFolhaSalarial(academiaId, funcId, func) {
  const registros = [];
  // Meses anteriores: pagos
  for (let i = func.mesesAtras; i >= 1; i--) {
    registros.push({
      academia_id:    academiaId,
      descricao:      `Salário – ${func.nome}`,
      categoria:      'salarios',
      valor:          func.salario,
      data:           fmt(diaMes(func.dia_pagamento, i)),
      status:         'pago',
      funcionario_id: funcId,
      competencia:    fmt(primeiroDeMes(i)),
      observacoes:    '[DEMO]',
    });
  }
  // Mês atual: pendente
  registros.push({
    academia_id:    academiaId,
    descricao:      `Salário – ${func.nome}`,
    categoria:      'salarios',
    valor:          func.salario,
    data:           fmt(diaMes(func.dia_pagamento, 0)),
    status:         'pendente',
    funcionario_id: funcId,
    competencia:    fmt(primeiroDeMes(0)),
    observacoes:    '[DEMO]',
  });
  return registros;
}

function gerarAcessos(academiaId, alunoId, aluno) {
  const acessos = [];
  // Sumido: últimos acessos foram entre 16 e 45 dias atrás (sem acesso recente)
  const inicio = aluno.sumido ? 16 : 0;
  const fim    = aluno.sumido ? 45 : 30;
  // Padrão de treino determinístico por idx (evita MD5 randômico)
  const padrao = aluno.idx % 3;
  const diasTreino = padrao === 0 ? [1, 4] : padrao === 1 ? [1, 3, 5] : [2, 4, 6];
  const horaBase = 6 + (aluno.idx % 4); // 6h–9h

  for (let i = fim; i >= inicio; i--) {
    const d = diasAtras(i);
    if (!diasTreino.includes(d.getDay())) continue;
    d.setHours(horaBase, (aluno.idx * 7) % 60, 0, 0);
    acessos.push({
      academia_id:        academiaId,
      aluno_id:           alunoId,
      origem:             'Direto',
      data_hora_entrada:  d.toISOString(),
      status_liberacao:   'liberado',
    });
  }
  return acessos;
}

function gerarProgressos(academiaId, alunoId, config) {
  const registros = [];
  for (let i = config.medicoes - 1; i >= 0; i--) {
    const deltaPeso = config.tendencia === 'perder'
      ? -(config.medicoes - 1 - i) * 0.9
      : config.tendencia === 'ganhar'
        ? (config.medicoes - 1 - i) * 0.6
        : 0;
    const deltaGord = config.tendencia === 'perder'
      ? -(config.medicoes - 1 - i) * 0.5
      : (config.medicoes - 1 - i) * 0.1;
    const pesoAtual = Number((config.pesoInicial + deltaPeso).toFixed(1));
    const gordAtual = Number((config.gorduraInicial + deltaGord).toFixed(1));

    registros.push({
      academia_id:         academiaId,
      aluno_id:            alunoId,
      data:                fmt(primeiroDeMes(i)),
      peso_kg:             pesoAtual,
      percentual_gordura:  gordAtual,
      peito_cm:            Math.round(pesoAtual * 1.26),
      cintura_cm:          Math.round(pesoAtual * 0.93 - i * 0.3),
      quadril_cm:          Math.round(pesoAtual * 1.14),
      braco_cm:            Math.round(pesoAtual * 0.40),
      coxa_cm:             Math.round(pesoAtual * 0.70),
      observacoes:         'Avaliação de rotina',
    });
  }
  return registros;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper de insert com verificação de erro
// ─────────────────────────────────────────────────────────────────────────────

async function ins(supabase, tabela, dados, seletor = 'id') {
  if (!dados || dados.length === 0) return [];
  const { data, error } = await supabase.from(tabela).insert(dados).select(seletor);
  if (error) throw new Error(`[${tabela}] ${error.message}`);
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exportações públicas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insere todos os dados de demonstração para academiaId.
 * Retorna { planos, funcionarios, alunos, receitas, despesas,
 *           acessos, treinos, exercicios, progressos, produtos }.
 */
export async function inserirSeed(supabase, academiaId) {
  // ── 1. Planos ──────────────────────────────────────────────────────────────
  const planosData = PLANOS.map(p => ({ ...p, academia_id: academiaId, ativo: true }));
  const planosInseridos = await ins(supabase, 'planos', planosData, 'id, nome');

  const planoIdPorIdx = Object.fromEntries(
    planosInseridos.map((p, i) => [i, p.id])
  );

  // ── 2. Funcionários ────────────────────────────────────────────────────────
  const funcsData = FUNCIONARIOS.map(f => ({
    academia_id:   academiaId,
    nome:          f.nome,
    cargo:         f.cargo,
    cpf:           f.cpf,
    data_admissao: fmt(primeiroDeMes(f.mesesAtras)),
    salario:       f.salario,
    dia_pagamento: f.dia_pagamento,
    status:        'ativo',
    email:         `${f.cpf.toLowerCase().replace('-', '')}@demo.gestacad.com`,
    telefone:      `(11) 9${String(7000 + FUNCIONARIOS.indexOf(f)).padStart(4,'0')}-${String(3000 + FUNCIONARIOS.indexOf(f)).padStart(4,'0')}`,
  }));
  const funcsInseridos = await ins(supabase, 'funcionarios', funcsData, 'id');
  const funcIds = funcsInseridos.map(f => f.id);

  // ── 3. Alunos ──────────────────────────────────────────────────────────────
  const alunosData = ALUNOS.map(a => ({
    academia_id:      academiaId,
    nome:             a.nome,
    cpf:              a.cpf,
    email:            `${a.cpf.toLowerCase().replace('-', '')}@demo.gestacad.com`,
    telefone:         `(11) 9${String(8100 + a.idx * 3).padStart(4,'0')}-${String(1200 + a.idx * 7).padStart(4,'0')}`,
    data_nascimento:  fmt(new Date(1985 + (a.idx % 10), (a.idx * 3) % 12, 1)),
    status_matricula: a.status,
    plano_id:         planoIdPorIdx[a.planoIdx],
    matricula_codigo: a.cpf, // reutiliza o código DEMO-XXX
    criado_em:        primeiroDeMes(a.mesesAtras).toISOString(),
  }));
  const alunosInseridos = await ins(supabase, 'alunos', alunosData, 'id, matricula_codigo');

  const alunoIdPorIdx = Object.fromEntries(
    alunosInseridos.map((a, i) => [i, a.id])
  );

  // ── 4. Receitas ────────────────────────────────────────────────────────────
  const todasReceitas = [];

  // 4.1 Matrículas
  for (let i = 0; i < ALUNOS.length; i++) {
    const a = ALUNOS[i];
    todasReceitas.push({
      academia_id: academiaId,
      aluno_id:    alunoIdPorIdx[i],
      tipo:        'matricula',
      descricao:   `Taxa de matrícula – ${a.nome}`,
      valor:       60.00,
      data:        fmt(primeiroDeMes(a.mesesAtras)),
      status:      'pago',
      observacoes: '[DEMO]',
    });
  }

  // 4.2 Mensalidades
  for (let i = 0; i < ALUNOS.length; i++) {
    const a = ALUNOS[i];
    const planoValor = PLANOS[a.planoIdx].valor_mensal;
    const mens = gerarMensalidades(academiaId, alunoIdPorIdx[i], a, planoValor);
    todasReceitas.push(...mens);
  }

  // 4.3 Vendas de produtos (avulsas)
  const vendasAvulsas = [
    { alunoIdx: 0, produto: 'Whey Protein 900g', valor: 149.90, mesesAtras: 2 },
    { alunoIdx: 2, produto: 'Camiseta Dry-fit',  valor:  69.90, mesesAtras: 4 },
    { alunoIdx: 5, produto: 'Coqueteleira 700ml',valor:  39.90, mesesAtras: 3 },
    { alunoIdx: 8, produto: 'Luva de treino',    valor:  59.90, mesesAtras: 1 },
    { alunoIdx: 3, produto: 'Barra de proteína', valor:   8.90, mesesAtras: 0 },
  ];
  for (const v of vendasAvulsas) {
    todasReceitas.push({
      academia_id: academiaId,
      aluno_id:    alunoIdPorIdx[v.alunoIdx],
      tipo:        'venda_produto',
      descricao:   v.produto,
      valor:       v.valor,
      data:        fmt(diaMes(15, v.mesesAtras)),
      status:      'pago',
      observacoes: '[DEMO]',
    });
  }

  const receitasInseridas = await ins(supabase, 'receitas', todasReceitas, 'id');

  // ── 5. Despesas ────────────────────────────────────────────────────────────
  const todasDespesas = [];

  // 5.1 Fixas mensais (12 meses × 5 categorias)
  const fixas = [
    { categoria: 'aluguel',          descricao: 'Aluguel do espaço',      base: 2800.00 },
    { categoria: 'energia_eletrica', descricao: 'Conta de energia',        base:  620.00 },
    { categoria: 'agua',             descricao: 'Conta de água',           base:  175.00 },
    { categoria: 'internet',         descricao: 'Internet e telefonia',    base:  220.00 },
    { categoria: 'produtos_limpeza', descricao: 'Produtos de limpeza',     base:  140.00 },
  ];
  for (let mes = 11; mes >= 0; mes--) {
    for (const f of fixas) {
      // Variação determinística de ±6% por mês (sem crescimento cumulativo)
      const variacao = 1 + ((mes * 7) % 13 - 6) / 100;
      const valor    = Number((f.base * variacao).toFixed(2));
      todasDespesas.push({
        academia_id: academiaId,
        descricao:   f.descricao,
        categoria:   f.categoria,
        valor,
        data:        fmt(diaMes(5, mes)),
        status:      mes === 0 ? 'pendente' : 'pago',
        observacoes: '[DEMO]',
      });
    }
  }

  // 5.2 Esporádicas
  const esporadicas = [
    { categoria: 'manutencao',   descricao: 'Manutenção de esteiras',       valor:  420.00, mesesAtras: 3,  dia: 12 },
    { categoria: 'equipamentos', descricao: 'Reposição de anilhas',          valor:  890.00, mesesAtras: 7,  dia: 20 },
    { categoria: 'manutencao',   descricao: 'Manutenção do ar-condicionado', valor:  350.00, mesesAtras: 10, dia:  8 },
    { categoria: 'equipamentos', descricao: 'Bicicleta ergométrica nova',    valor: 2200.00, mesesAtras: 11, dia: 15 },
    { categoria: 'impostos',     descricao: 'Simples Nacional (guia)',       valor:  480.00, mesesAtras: 1,  dia: 20, status: 'pago' },
    { categoria: 'impostos',     descricao: 'Simples Nacional (guia)',       valor:  480.00, mesesAtras: 0,  dia: 20, status: 'pendente' },
    { categoria: 'outros',       descricao: 'Divulgação em redes sociais',   valor:  200.00, mesesAtras: 2,  dia: 10 },
  ];
  for (const e of esporadicas) {
    todasDespesas.push({
      academia_id: academiaId,
      descricao:   e.descricao,
      categoria:   e.categoria,
      valor:       e.valor,
      data:        fmt(diaMes(e.dia, e.mesesAtras)),
      status:      e.status ?? 'pago',
      observacoes: '[DEMO]',
    });
  }

  // 5.3 Folha salarial
  for (let fi = 0; fi < FUNCIONARIOS.length; fi++) {
    const folha = gerarFolhaSalarial(academiaId, funcIds[fi], FUNCIONARIOS[fi]);
    todasDespesas.push(...folha);
  }

  const despesasInseridas = await ins(supabase, 'despesas', todasDespesas, 'id');

  // ── 6. Acessos de catraca ──────────────────────────────────────────────────
  const todosAcessos = [];
  for (let i = 0; i < ALUNOS.length; i++) {
    const a = ALUNOS[i];
    // Somente ativos geram acessos
    if (a.status !== 'ativa') continue;
    todosAcessos.push(...gerarAcessos(academiaId, alunoIdPorIdx[i], a));
  }
  const acessosInseridos = await ins(supabase, 'acessos_catraca', todosAcessos, 'id');

  // ── 7. Produtos ────────────────────────────────────────────────────────────
  const produtosData = PRODUTOS.map(p => ({
    academia_id: academiaId,
    nome:        p.nome,
    categoria:   p.categoria,
    preco:       p.preco,
    estoque:     p.estoque,
    destaque:    p.destaque,
    ordem:       p.ordem,
    ativo:       true,
  }));
  const produtosInseridos = await ins(supabase, 'produtos', produtosData, 'id');

  // ── 8. Treinos de alunos + exercícios ──────────────────────────────────────
  let totalExercicios = 0;
  for (const ficha of TREINOS_FICHAS) {
    const { data: treinoArr, error: errT } = await supabase
      .from('treinos')
      .insert({
        academia_id: academiaId,
        aluno_id:    alunoIdPorIdx[ficha.alunoIdx],
        nome_treino: ficha.nome_treino,
        objetivo:    ficha.objetivo,
        modalidade:  ficha.modalidade,
        ordem:       1,
        ativo:       true,
        publico:     ficha.publico,
      })
      .select('id');
    if (errT) throw new Error(`[treinos] ${errT.message}`);

    const treinoId = treinoArr[0].id;
    const exsData  = ficha.exercicios.map(e => ({ treino_id: treinoId, ...e }));
    const exsInserted = await ins(supabase, 'exercicios_treino', exsData, 'id');
    totalExercicios += exsInserted.length;
  }

  // ── 9. Progresso dos alunos ────────────────────────────────────────────────
  const todosProgressos = [];
  for (const cfg of PROGRESSOS_CONFIG) {
    const alunoId = alunoIdPorIdx[cfg.alunoIdx];
    todosProgressos.push(...gerarProgressos(academiaId, alunoId, cfg));
  }
  const progressosInseridos = await ins(supabase, 'progresso_aluno', todosProgressos, 'id');

  return {
    planos:       planosInseridos.length,
    funcionarios: funcsInseridos.length,
    alunos:       alunosInseridos.length,
    receitas:     receitasInseridas.length,
    despesas:     despesasInseridas.length,
    acessos:      acessosInseridos.length,
    treinos:      TREINOS_FICHAS.length,
    exercicios:   totalExercicios,
    progressos:   progressosInseridos.length,
    produtos:     produtosInseridos.length,
  };
}

/**
 * Remove todos os dados de demonstração do tenant.
 * Preserva: academias, perfis_admin, auth.users, treinos biblioteca (aluno_id null).
 */
export async function removerDadosDemo(supabase, academiaId) {
  const erros = [];

  async function del(tabela, filtros) {
    let q = supabase.from(tabela).delete();
    for (const [col, val] of Object.entries(filtros)) {
      q = q.eq(col, val);
    }
    const { error } = await q;
    if (error) erros.push(`[${tabela}] ${error.message}`);
  }

  // Ordem respeita FKs (SET NULL ou CASCADE declarados no schema).
  await del('acessos_catraca', { academia_id: academiaId });
  await del('receitas',        { academia_id: academiaId });
  await del('despesas',        { academia_id: academiaId });
  await del('feedbacks',       { academia_id: academiaId });
  // Cascade de alunos → progresso_aluno, treinos de aluno, exercicios_treino
  await del('alunos',          { academia_id: academiaId });
  await del('funcionarios',    { academia_id: academiaId });
  await del('produtos',        { academia_id: academiaId });
  await del('planos',          { academia_id: academiaId });

  if (erros.length > 0) {
    throw new Error(`Falhas ao remover dados:\n  ${erros.join('\n  ')}`);
  }
}

/**
 * Valida contagens pós-seed. Retorna { ok: boolean, relatorio: string[] }.
 */
export async function validarContagens(supabase, academiaId) {
  const esperado = {
    planos:       3,
    funcionarios: 4,
    alunos:       16,
    treinos:      4,   // fichas de alunos (aluno_id NOT NULL)
    produtos:     5,
  };

  const relatorio = [];
  let ok = true;

  async function checar(tabela, campo, esperadoN, filtrosExtras = {}) {
    const q = supabase
      .from(tabela)
      .select(campo, { count: 'exact', head: true })
      .eq('academia_id', academiaId);

    // Aplica filtros extras (ex: aluno_id IS NOT NULL para treinos de alunos)
    let qFinal = q;
    for (const [col, val] of Object.entries(filtrosExtras)) {
      qFinal = val === 'NOT NULL'
        ? qFinal.not(col, 'is', null)
        : qFinal.eq(col, val);
    }

    const { count, error } = await qFinal;
    if (error) {
      relatorio.push(`  ✗ ${tabela}: erro ao contar — ${error.message}`);
      ok = false;
      return;
    }
    const atual = count ?? 0;
    if (esperadoN === null) {
      relatorio.push(`  ✓ ${tabela}: ${atual} registros`);
    } else if (atual >= esperadoN) {
      relatorio.push(`  ✓ ${tabela}: ${atual} (esperado ≥ ${esperadoN})`);
    } else {
      relatorio.push(`  ✗ ${tabela}: ${atual} (esperado ≥ ${esperadoN})`);
      ok = false;
    }
  }

  await checar('planos',         'id', esperado.planos);
  await checar('funcionarios',   'id', esperado.funcionarios);
  await checar('alunos',         'id', esperado.alunos);
  await checar('receitas',       'id', 16);   // mínimo: 16 matrículas
  await checar('despesas',       'id', 60);   // mínimo: 12×5 fixas
  await checar('acessos_catraca','id', 20);   // mínimo razoável
  await checar('treinos',        'id', esperado.treinos, { aluno_id: 'NOT NULL' });
  await checar('produtos',       'id', esperado.produtos);
  await checar('progresso_aluno','id', 10);   // mínimo: 3 alunos × 3+ medições

  return { ok, relatorio };
}
