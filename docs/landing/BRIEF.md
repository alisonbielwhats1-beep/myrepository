# Landing GestAcad: brief do redesenho (setembro de 2026)

Brief do método scroll-craft. Parte das respostas veio do usuário e parte foi
decidida por mim com liberdade dada por ele. Cada item diz qual é qual.

## Decisões do usuário

- **Paleta:** manter a paleta atual (ink escuro, volt verde, magenta e ciano de apoio).
- **Imagens do hero:** fotos realistas geradas por IA (kie.ai).
- **Tipografia:** uma fonte mais marcante nos títulos. A escolha ficou comigo.
- **Texto:** liberdade para reescrever os títulos no tom da nova narrativa.
- **Proposta aprovada:** "o caos da academia se organiza enquanto você rola".

## Decisões minhas (com liberdade dada pelo usuário)

1. **Clima:** operação sob controle, rotina de academia de verdade, tecnologia calma.
   Referências: a recepção de uma academia às 6h, o painel de um carro elétrico,
   uma mesa de trabalho sendo arrumada em time-lapse.
2. **Percurso:** porta da academia, a bagunça do dia a dia, a bagunça se
   organizando, o painel funcionando, o app do aluno, confiança, plano e
   dúvidas, e a catraca liberando.
3. **Energia:** média na abertura, subindo no problema, com o pico na virada.
   Firme no painel, leve no app, calma na confiança e firme de novo no fechamento.
4. **Sensação:** ver abaixo.
5. **O que nenhum outro site faz:** os problemas da academia viram, sob o
   polegar do visitante, os módulos do sistema que resolvem cada um.
6. **Estética:** premium-minimal escuro, com peso tipográfico (Archivo Expanded).
7. **Estrutura:** cenas distintas, sem um voo contínuo de câmera.
8. **Recursos:** nenhuma foto real. Fotos geradas para o hero, e interface em
   HTML real (painel e app) com dados de demonstração identificados como tal.

## Curva de sensação

| Ato | Sensação | O que causa |
|---|---|---|
| Abertura | reconhecimento | a recepção da academia em camadas, e o celular do aluno liberando a entrada |
| Problema | incômodo | papéis, planilha e mensagens se amontoando, uma frase por vez |
| **Virada (pico)** | **alívio** | cada item da bagunça voa e vira o módulo do sistema que resolve aquele problema |
| Painel | controle | o painel reage ao scroll: entrada na catraca, vencimento, fechamento do mês |
| App do aluno | encanto | as telas do celular passam de lado |
| Confiança | tranquilidade | texto calmo, sem efeitos |
| Plano e dúvidas | clareza | preço e itens inclusos, sem letra miúda escondida |
| Fechamento | decisão | o celular volta, o QR valida e a catraca abre junto com o CTA |

**Pico:** "Rolei a página e a bagunça da academia foi se organizando sozinha,
cada papel virou uma parte do sistema." Fica no ato da virada, que tem a maior
extensão de scroll da página. O ato anterior (problema) é mais contido.

**Frase para contar a alguém:** "É o site em que a bagunça da academia vai se
organizando sozinha enquanto você desce a página."

**Silêncio intencional:** o trecho de confiança não tem efeitos de propósito.
É uma pausa depois do app e antes do plano, e não um scroll morto.

## Estrutura

Estrutura própria, "da bagunça à ordem": o problema e a solução ocupam o
**mesmo palco**, e a transição entre eles é o próprio produto. O cabeçalho
continua fixo e discreto, porque quem já é cliente precisa do "Entrar".
O fechamento repete o objeto da abertura (o celular com o QR), fechando o ciclo.

A estrutura "live surface" pura ficou de fora porque proíbe fotografia e
chrome de marketing, e o usuário pediu um hero fotográfico em camadas.
A "filmic one-shot" ficou de fora porque o percurso tem cortes reais de
assunto. A "split stage" só funcionaria até a virada.

## Movimento exclusivo

**A bagunça vira o sistema.** Seis objetos do dia a dia (post-it de cobrança,
planilha, caderno de entrada, ficha em papel, conta no guardanapo, conversa de
WhatsApp) caem na tela e, na virada, cada um viaja até a sua posição no
painel, trocando de face para o módulo correspondente (Mensalidades, Alunos,
Recepção, Treinos, Financeiro e Retenção). O movimento é todo guiado pelo
scroll, sem tempo fixo.

## Técnica por ato

| Ato | Técnica | Por quê |
|---|---|---|
| Abertura | camadas com parallax fixas na tela (fundo, aluna, título, celular, atmosfera) | profundidade real no primeiro olhar |
| Problema | tela fixa + texto que se monta | argumento, uma linha por vez |
| Virada | movimento exclusivo, guiado pelo scroll | é o pico |
| Painel | tela fixa com estados discretos | o produto reagindo |
| App do aluno | rolagem horizontal | lateral dá sensação de variedade |
| Confiança, plano e dúvidas | fluxo normal com revelação suave | pausa |
| Fechamento | tela fixa + resposta ao ponteiro | a página para e responde |
