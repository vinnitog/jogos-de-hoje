# Jogos de hoje

PWA mobile-first para consultar os jogos do dia, acompanhar placares e descobrir onde assistir às principais competições de futebol acompanhadas no Brasil.

## O que o app entrega

- agenda por data e campeonato;
- horários, placares, status ao vivo, fase e local;
- canais informados pela fonte e transmissões habituais claramente diferenciadas;
- tabela e chaveamento da Copa do Mundo 2026;
- notificações locais de gol quando o navegador oferece suporte;
- compartilhamento da agenda sem coletar ou armazenar contatos;
- cache local, instalação como PWA e funcionamento degradado offline.

## Competições

- Brasileirão Série A
- Campeonato Paulista Série A1
- Libertadores
- Copa do Brasil
- Copa do Mundo 2026

## Arquitetura

O projeto usa HTML, CSS e JavaScript vanilla, sem framework ou etapa de build. Essa escolha mantém o carregamento leve e o deploy compatível com qualquer hospedagem estática.

```text
.
├── index.html          # estrutura e componentes da interface
├── css/app.css         # tokens, layout e responsividade
├── js/app.js           # consumo, normalização e renderização dos dados
├── sw.js               # cache offline e notificações em segundo plano
├── manifest.json       # metadados da PWA
├── data/jogos.json     # fallback local sem partidas fictícias
└── unit/               # testes de lógica, estrutura, política e service worker
```

Os placares são consultados na API pública de scoreboard da ESPN com `region=br` e `lang=pt`. Quando há código de país compatível, as bandeiras usam FlagCDN como fonte primária e a imagem da ESPN como reserva. Transmissões marcadas como habituais são referências da competição, não confirmação da grade de cada partida.

## Executar localmente

Não há dependências de produção. Sirva a raiz por HTTP para que o Service Worker funcione:

```powershell
python -m http.server 8080
```

Depois, abra `http://localhost:8080` no navegador.

## Testes

No Windows:

```powershell
.\test.cmd
```

Alternativa:

```powershell
npm.cmd test
```

A suíte cobre regras de negócio, mapeamento da ESPN, filtros, compartilhamento, PWA, acessibilidade estrutural, cache e notificações do Service Worker.

## Privacidade

O app não exige cadastro e não inclui analytics, anúncios, cookies ou banco de dados próprio. Preferências e placares em cache ficam no dispositivo. O compartilhamento abre o WhatsApp somente após ação do usuário e não armazena telefone.

A análise técnica está em [`.lgpd/`](.lgpd/) e deve ser refeita se o projeto ganhar autenticação, formulários, publicidade, analytics ou backend. Ela não substitui revisão jurídica.

## Decisões e evolução

- [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md): objetivo, fonte de dados e decisões de arquitetura.
- [`PROJECT_SKILLS.md`](PROJECT_SKILLS.md): adaptação das skills de LGPD, design e monetização.
- [`docs/MONETIZATION.md`](docs/MONETIZATION.md): hipóteses de receita e experimentos de precificação.
- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md): origem e licenças das skills incorporadas.

## Limitações conhecidas

- A disponibilidade e o formato da API pública podem mudar sem aviso.
- A ESPN nem sempre informa a transmissão brasileira por jogo.
- Notificações em segundo plano dependem do suporte e das permissões do navegador.
- Qualquer uso comercial de dados deve validar previamente os direitos da fonte.

## Licença

O código original deste projeto está sob a licença MIT. Skills de terceiros mantêm as licenças indicadas em [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
