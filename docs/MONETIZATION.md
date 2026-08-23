# Estratégia de monetização e precificação

**Status**: hipóteses para validação, não preços lançados

**Data**: 2026-08-22

## Contexto

O valor atual é conveniência: reunir agenda, placar e transmissão em uma PWA leve, sem cadastro. A alternativa do usuário é pesquisar em buscadores, portais ou apps esportivos mais amplos. O produto ainda não possui métricas de audiência ou pesquisa de disposição a pagar.

Concorrentes maiores combinam versão gratuita com publicidade, patrocínio e assinatura. A OneFootball documenta publicidade, conteúdo de marca e assinatura com menos anúncios; a App Store brasileira lista uma assinatura VIP do 365Scores por R$ 14,90. Esses sinais validam os modelos, mas não provam que a audiência deste app pagaria por eles: [OneFootball Business](https://business.onefootball.com/), [termos da OneFootball](https://promo.onefootball.com/legal/platform-terms-and-conditions/en), [365Scores na App Store](https://apps.apple.com/br/app/365scores-partidas-de-hoje/id571801488).

## Opções avaliadas

| Prioridade | Estratégia | Quem paga | Faixa experimental | Fit e risco principal |
|---|---|---|---|---|
| 1 | Patrocínio contextual | bar, canal esportivo, loja ou creator | R$ 300–1.000/mês por cota piloto | Mantém o app gratuito; exige audiência comprovada e inserção discreta |
| 2 | Apoio voluntário | usuário recorrente | R$ 5–15 por contribuição | Baixo atrito e sem paywall; receita pequena e imprevisível |
| 3 | Afiliados de streaming | plataforma parceira | comissão por conversão | Próximo do momento “onde assistir”; depende de programa oficial e transparência |
| 4 | Widget white-label | portal, rádio ou mídia local | R$ 149–499/mês + implantação | Valor B2B claro; exige fonte licenciada, SLA e suporte |
| 5 | Assinatura sem anúncios | usuário final | R$ 6,90–12,90/mês | Mercado conhece o modelo, mas hoje não há anúncios nem benefício premium suficiente |

As faixas acima são âncoras de teste, não recomendação financeira definitiva.

## Recomendação

### 1. Testar apoio voluntário

- **Proposta**: botão externo e discreto de apoio, sem bloquear recursos.
- **Economia inicial**: margem alta, CAC orgânico, LTV desconhecido.
- **Experimento**: apresentar a opção a 100 usuários recorrentes ou durante 30 dias.
- **Sucesso**: pelo menos 2% de conversão ou 10 apoios, sem queda perceptível de uso.
- **LGPD/UX**: o provedor de pagamento deve ser informado; não enviar dados para ele antes do clique.

### 2. Validar patrocínio contextual antes de anúncios programáticos

- **Proposta**: uma cota fixa, identificada como “Patrocínio”, relacionada ao contexto esportivo.
- **Economia inicial**: venda direta; receita previsível; custo comercial manual.
- **Experimento**: página comercial simples e 10 conversas com negócios locais/creators.
- **Sucesso**: 2 interessados qualificados ou 1 piloto pago na faixa proposta.
- **Risco**: excesso visual e perda de confiança; limitar a uma inserção sem rastreamento comportamental.

## O que não lançar agora

- Paywall para a agenda básica: concorrentes oferecem placares gratuitos e o app ainda não tem diferencial premium.
- Publicidade comportamental: adicionaria coleta, fornecedores e custo LGPD antes de haver escala.
- Venda de API/widget usando a fonte atual: validar termos e contratar dados licenciados antes de comercializar.

## Pesquisa de disposição a pagar

Aplicar Van Westendorp apenas após definir uma proposta premium concreta. Perguntar a usuários recorrentes quando o produto ficaria barato demais, vantajoso, caro mas aceitável e caro demais. Separar respostas de consumidor final e comprador B2B.

## Roadmap de validação

1. Definir métrica agregada de uso que preserve privacidade.
2. Entrevistar 8–12 usuários sobre frequência, alternativa e recurso premium desejado.
3. Testar apoio voluntário por 30 dias.
4. Fazer 10 abordagens de patrocínio com uma única cota piloto.
5. Só então testar preço, embalagem e eventual integração comercial.
