# Mapa de dados — Jogos de hoje

**Versão**: 1.0

**Data**: 2026-08-22

**Owner**: responsável pelo repositório

## A001 — Consulta de dados esportivos

| Campo | Valor |
|---|---|
| Finalidade | Exibir agenda, placares, tabela e chaveamento |
| Dados do conteúdo | partidas, times, local, horário, status e transmissão |
| Dados pessoais armazenados pelo app | Nenhum |
| Fonte | ESPN |
| Sistemas | memória, `localStorage` e Cache Storage do navegador |
| Terceiros | ESPN; FlagCDN para imagens de bandeiras |
| Metadados técnicos | IP/user-agent podem ser recebidos diretamente pelos serviços externos |
| Retenção | cache local controlado pelo navegador e atualizado por data |
| Alto risco | Não identificado |

## A002 — Preferência e notificação local de gol

| Campo | Valor |
|---|---|
| Finalidade | Lembrar a opção do usuário e evitar notificação duplicada |
| Dados | `on/off`, identificadores de partidas, placares e tags técnicas |
| Identificador de pessoa/conta | Nenhum |
| Sistema | `localStorage`, Service Worker e Cache Storage locais |
| Compartilhamento | Nenhum pelo código do app |
| Retenção | até limpeza dos dados do site ou substituição do cache |
| Alto risco | Não |

## A003 — Compartilhamento voluntário

| Campo | Valor |
|---|---|
| Finalidade | Entregar o texto da agenda ao WhatsApp |
| Dados preparados | texto público sobre jogos e fonte |
| Contato/telefone | Não solicitado, embutido ou armazenado |
| Acionamento | clique explícito do usuário |
| Terceiro | WhatsApp, após o clique |
| Alto risco | Não |

## Reavaliação obrigatória

Refazer o mapa antes de adicionar login, formulário, analytics, anúncios, push remoto, pagamento, perfil de time favorito ou backend.
