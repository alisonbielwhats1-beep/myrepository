# Auditoria de UX — GestAcad

Os 8 problemas que motivaram o redesenho, na ordem de impacto. Cada um aponta a tela do protótipo que resolve.

## Alto

**1. A tela em branco durante o carregamento.**
O Início fica vazio até os dados do Supabase voltarem — sensação de app travado. Skeletons com a forma exata dos cards fazem a espera parecer metade do tempo, e o conteúdo real entra sem salto de layout. → tela 1a, `loading.tsx` por rota.

**2. "Sem treino programado para hoje" é um beco sem saída.**
É a frase que o aluno mais vê e a que menos ajuda. Deve virar contexto + ação: onde ele está na semana, quando é o próximo treino, e um botão para adiantar. → tela 1a, estado "Dia sem treino".

**3. O dashboard responde "como vai a academia?" — não "o que eu faço agora?".**
23 alunos, 14 novos, 18 sumidos, 4 funcionários: quatro números do mesmo tamanho, nenhum acionável. Inadimplentes / sumidos / vencendo hoje sobem para o topo com o botão da ação na própria linha. → tela 1c.

## Médio

**4. Repasses de R$ 10 e R$ 25 ocupam o mesmo espaço da receita.**
Um card inteiro para R$ 35 desequilibra a hierarquia. Vira uma linha dentro do Financeiro; volta a card se passar de ~10% da receita. → telas 1c e 2c.

**5. A aba Treinos mostra fichas, mas não a rotina.**
Cards iguais e empilhados, dois planos ABCD "Em andamento" ao mesmo tempo, sem saber onde parou. A semana como trilha (feito / hoje / planejado) com retomada no exercício exato resolve. → telas 1b e 2b.

**6. Chips de dia sem estado de progresso.**
SEG–DOM só filtram. Com um ponto de status, cada chip vira mapa da semana e cria sensação de sequência — o gancho de retenção mais barato que existe. → tela 1b.

**7. Caixa e competência (DRE) convivem na mesma tela.**
São duas perguntas diferentes com números parecidos; hoje a diferença é explicada num tooltip longo. Duas abas e uma faixa que liga as duas visões com número resolvem. → tela 2c.

## Baixo

**8. O banner "Adicionar à tela inicial" rouba a dobra em toda visita.**
Aparece acima da saudação. Mostrar a partir do 3º acesso, 1×/semana, no rodapé do Perfil.

**9. Tudo é card cinza com o mesmo raio.**
A identidade verde só aparece em botões. Uma superfície própria para o "treino de hoje" (tinta verde + borda) e o resto neutro: **um único destaque por tela** é o que tira a cara de template. → todas as telas.
