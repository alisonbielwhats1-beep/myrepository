# GestAcad Intelligence Chat V1

Assistente determinístico baseado nos dados do GestAcad. Esta versão não usa
OpenAI, Claude, Gemini, embeddings, banco vetorial ou qualquer serviço pago de
IA.

## Fluxo

1. O proprietário envia somente a pergunta para `/api/intelligence/[slug]`.
2. O servidor resolve usuário e academia pela sessão Supabase.
3. O texto é normalizado e classificado por aliases e expressões regulares.
4. `parseDateRange()` converte períodos em datas ISO usando o fuso já adotado
   pelo projeto (`America/Sao_Paulo`).
5. O intent chama apenas um serviço previamente permitido.
6. RPCs agregam os dados no PostgreSQL e devolvem somente números ou listas
   limitadas.
7. O servidor monta uma resposta estruturada; a UI não interpreta SQL nem
   recebe histórico completo.

## Segurança e multi-tenant

- A rota aceita `question`, nunca `academia_id`.
- O slug da rota é comparado com a academia da sessão.
- A V1 é restrita ao papel `dono`, pois contém informações financeiras.
- As funções SQL da migration 065 resolvem o tenant com
  `academia_id_atual()` e também exigem papel `dono`.
- As consultas usam o cliente Supabase da sessão e continuam sob RLS.
- Texto do usuário nunca é concatenado ou executado como SQL.

## Intenções e períodos padrão

| Intenção | Padrão sem período explícito |
| --- | --- |
| Receita, financeiro, meta, novos alunos e resumo | mês atual |
| Check-ins, movimento e horário de pico | hoje |
| Alunos sumidos, inadimplentes e ativos | situação atual |
| Planos vencendo | próximos 7 dias |
| Comparação | mês atual x mês anterior |

O parser cobre hoje, ontem, anteontem, esta semana, semana passada, este mês,
mês passado, últimos/próximos X dias, meses por nome, datas `DD/MM`, intervalos
e comparações.

## Histórico que a V1 não inventa

O banco permite calcular com segurança receita, check-ins e novos cadastros em
períodos passados. Porém não guarda uma fotografia diária completa do status
da matrícula, da retenção ou da inadimplência. Por isso perguntas como:

- “Quem estava inadimplente em 10/07/2026?”
- “Quem estava sumido em julho?”
- “Quantos alunos estavam ativos em 10/07/2026?”

retornam uma mensagem transparente de histórico insuficiente. Resumos antigos
omitem alunos ativos e inadimplência em vez de usar o estado atual.

“Planos vencendo” usa mensalidades pendentes já geradas no GestAcad, pois o
modelo atual não possui uma data de expiração independente para planos
recorrentes.

## Publicação

Antes de publicar o código da interface, aplicar no Supabase a migration:

`supabase/migrations/065_intelligence_chat_v1.sql`

Ela é aditiva: cria três RPCs e não altera nem remove dados existentes.

