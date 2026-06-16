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

Excecao documentada:

Para `fifa.world` / Copa do Mundo 2026, o app pode incluir `CazeTV` como transmissao manual garantida no Brasil quando a ESPN nao retornar canais, pois a competicao tem regra de cobertura integral pela CazeTV. Outras transmissoes da Copa, como Globo/SporTV/SBT/N Sports/GE TV, so devem entrar quando vierem de fonte confiavel por jogo.

Modelo de transmissao esperado:

```json
{
  "name": "CazeTV",
  "type": "streaming",
  "guaranteed": true,
  "source": "manual"
}
```

Decisao revisada (2026-06-16):

A ESPN com `region=br` nao retorna canais (`broadcasts`/`geoBroadcasts` vem vazios) para Brasileirao, Paulista, Libertadores e Copa do Brasil. Para nao deixar a coluna "Onde assistir" vazia, o app passa a usar um mapa curado de transmissoes habituais por competicao (`LEAGUE_DEFAULT_BROADCASTS` em `js/app.js`), marcadas como `source: "manual"` e `guaranteed: false`.

Regras desse mapa:

- As transmissoes habituais entram apenas quando a fonte (ESPN/futuras) nao trouxer canais para o jogo. Se a fonte trouxer dado por jogo, ele tem prioridade e o mapa nao e somado.
- No UI, esses canais aparecem como "transmissao habitual da competicao" (chip tracejado), diferenciando de canais confirmados por jogo. Cabe ao usuario conferir a grade do dia.
- A CazeTV na Copa do Mundo 2026 permanece como `guaranteed: true` e entra sempre, inclusive junto de canais da fonte.
- O mapa reflete os direitos vigentes no Brasil e deve ser revisado a cada temporada, pois os contratos mudam por ano.

Atualizacao automatica:

- Jogos ao vivo: atualizar no maximo a cada 90 segundos.
- Jogos do dia sem partida ao vivo: atualizar no maximo a cada 4 minutos.
- Datas passadas/futuras: atualizar no maximo a cada 15 minutos.
- Pausar auto-refresh quando o app estiver offline ou com a aba em segundo plano.
- Clique manual em atualizar deve respeitar intervalo minimo para evitar spam na API.

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
