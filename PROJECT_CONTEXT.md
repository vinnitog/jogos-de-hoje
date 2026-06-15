# PROJECT_CONTEXT.md - Jogos de hoje

Gerado em: 2026-06-15 16:26:23

## Descricao

PWA simples e funcional que consome API publica de placares para trazer informacoes de jogos do Brasileirao, Campeonato Paulista, Libertadores, Copa do Brasil e Copa do Mundo 2026: data, hora, times, local, status e transmissao quando a fonte informar.

## Objetivo

Listar jogos do dia referentes aos campeonatos Brasileiro Serie A, Paulista Serie A1, Libertadores, Copa do Brasil e Copa do Mundo 2026, mostrando tambem onde esses jogos serao transmitidos quando a API retornar essa informacao.

## Publico Alvo

Nao definido

## Caracteristicas Informadas

- Interface visual: Sim
- Login/autenticacao: Nao
- Banco de dados: Nao
- Offline/PWA: Sim
- Mobile: Sim
- Dashboard/graficos: Nao
- API propria: Nao
- Integracoes externas: Sim
- Multiusuario: Nao

## Stack Escolhida

```text
HTML + CSS + JavaScript vanilla + Service Worker
```

## Integracao De Dados

Fonte primaria:

```text
ESPN scoreboard API publica, com region=br e lang=pt
```

Ligas consumidas:

- `bra.1` - Brasileirao Serie A
- `bra.camp.paulista` - Paulista Serie A1
- `conmebol.libertadores` - Libertadores
- `bra.copa_do_brazil` - Copa do Brasil
- `fifa.world` - Copa do Mundo 2026

Observacao:

A transmissao e exibida somente quando a fonte retornar canais/plataformas. Se a API nao informar transmissao brasileira, a interface deve mostrar "A confirmar pela fonte" para evitar dado inventado.

## Motivo Da Stack

Para PWA simples, mobile e offline, vanilla reduz build step e facilita deploy estatico.

## Alternativas Rejeitadas

React/Vite: valido se surgirem muitas telas/estado. Electron: rejeitado; PWA deve ser tentado primeiro.

## Revisao Obrigatoria De Stack

Antes da primeira feature real, o `senior-dev` deve validar se a stack escolhida ainda faz sentido.

Se houver front-end, `ui-ux-expert` deve validar impacto visual e UX.

O `code-reviewer` deve apontar risco de stack inadequada, excesso de complexidade ou falta de base para evolucao.

## Workflow Padrao

1. `senior-dev`
2. `ui-ux-expert`, quando houver front-end
3. `code-reviewer`
4. `qa-senior`
5. `qa-automate`
6. Validacao final com testes e diff
7. Commit/push em `develop` e PR `develop -> main`

## Comandos De Validacao

```powershell
.\test.cmd
npm.cmd test
git diff --check
```

## Notas De Escopo

- Trabalhar sempre em `develop`.
- Nunca fazer push direto para `main`.
- Preservar alteracoes existentes do usuario.
- Fazer staging explicito por arquivo.
- Manter documentacao de contexto versionada neste arquivo.
