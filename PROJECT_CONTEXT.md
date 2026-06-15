# PROJECT_CONTEXT.md - Jogos de hoje

Gerado em: 2026-06-15 16:26:23

## Descricao

PWA simples e funcional que ira ser responsavel por consumir api's que trara informações se terá jogo do brasileirao e campeonato paulista, libertadores e copa do brasil, data e hora dos jogos, quais times irão se enfrentar e onde será transmitido

## Objetivo

Listar jogos do dia referente aos campeonatos, brasileiro, paulista, libertadores e copa do brasil, somente das séries A e listar tambem onde esses jogos serão transmitidos

## Publico Alvo

Nao definido

## Caracteristicas Informadas

- Interface visual: Sim
- Login/autenticacao: Nao
- Banco de dados: Nao
- Offline/PWA: Nao
- Mobile: Sim
- Dashboard/graficos: Nao
- API propria: Nao
- Integracoes externas: Nao
- Multiusuario: Nao

## Stack Escolhida

```text
HTML + CSS + JavaScript vanilla + Service Worker
```

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
