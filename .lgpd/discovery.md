# Discovery de privacidade

**Data**: 2026-08-22

## Arquitetura examinada

- Front-end estático em HTML/CSS/JavaScript.
- Service Worker para app shell, placares e notificações locais.
- Sem servidor próprio, autenticação, banco ou formulário enviado ao projeto.
- Sem SDK de analytics, pixel, gerenciador de tags, anúncios ou cookies.

## Armazenamento local

| Chave/cache | Conteúdo | Dado pessoal no app? | Retenção |
|---|---|---|---|
| `jogos-hoje-cache-v2` | placares e metadados esportivos por data | Não | até limpeza do navegador; sobrescrito por data |
| `jogos-hoje-goal-notifications` | preferência `on/off` | Não identificável isoladamente | até o usuário limpar o site |
| cache `goal-notification-state` | jogos, placares e tags já notificadas | Não | gerenciado pelo Service Worker |

## Serviços externos

| Serviço | Finalidade | Momento | Observação |
|---|---|---|---|
| ESPN | placares, classificação e chaveamento | carregamento/atualização | requisição direta do navegador |
| FlagCDN | bandeiras de seleções | quando a Copa é renderizada | requisição direta do navegador; ESPN é fallback |
| WhatsApp | compartilhar texto da agenda | somente após clique | o app não coleta nem persiste contato |
| Hospedagem estática | servir os arquivos | acesso ao app | provedor ainda não documentado no repositório |

Serviços externos normalmente recebem metadados de rede como IP e user-agent. O repositório não armazena esses metadados e não controla os logs próprios de cada serviço.

## Exposição encontrada e corrigida

O código continha um telefone pessoal em uma lista ofuscada e salvava números digitados em `localStorage`. Ofuscação não é anonimização nem proteção. O fluxo foi substituído pelo seletor do WhatsApp, sem campo de contato e sem persistência.

## Fundamento

A correção segue os princípios de necessidade, transparência, segurança e prevenção do art. 6º da [Lei nº 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm). Este documento é uma análise técnica, não parecer jurídico.
