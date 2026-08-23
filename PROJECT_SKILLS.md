# Perfil das skills — Jogos de hoje

Este arquivo adapta as skills versionadas em `.agents/skills/` ao contexto real do app. As instruções de origem continuam intactas; este perfil prevalece quando um exemplo genérico pressupõe backend, autenticação ou banco de dados que o projeto não possui.

## Contexto fixo

- Produto: PWA de consulta rápida de jogos e transmissões para o público brasileiro.
- Stack: HTML, CSS, JavaScript vanilla e Service Worker, sem build step.
- Dados: ESPN pública como fonte principal; cache local de placares; FlagCDN para bandeiras; WhatsApp somente após ação explícita do usuário.
- Privacidade: sem cadastro, banco, analytics, anúncios, cookies ou coleta de contato.
- Interface: modo `Operate`, mobile-first, identidade verde e dourada já estabelecida.

## LGPD

Entrada: `lgpd-audit`, cenário B (retrofit de app existente).

- Começar por inventário de dados e minimização.
- Não gerar schema Prisma, endpoints DSAR, consent ledger, KMS ou DPA automaticamente: não há backend nem contas.
- Tratar IP e user-agent recebidos por serviços externos como fluxo técnico indireto a ser divulgado, sem afirmar que o repositório os armazena.
- Qualquer adição de analytics, publicidade, login, push remoto ou formulário reabre a auditoria.
- Artefatos vivem em `.lgpd/`; textos jurídicos finais exigem checkpoint e revisão profissional.

## Impeccable

Entrada: `impeccable`, modo `polish` para a superfície existente.

- Preservar funcionalidades, conteúdo factual e identidade verde/dourada.
- Priorizar leitura em poucos segundos, alvos de toque, teclado, estados offline/erro/vazio e ausência de scroll horizontal.
- Não adicionar fontes, bibliotecas ou imagens remotas apenas por estética.
- A validação visual local segue `AGENTS.md`: testes automatizados e inspeção estática; Browser somente mediante pedido explícito.
- Rodar o detector uma vez ao final sobre os arquivos alterados.

## Monetização e precificação

Entrada: `monetization-strategy`; complementar com `pricing-strategy` quando houver valores ou pacotes.

- Manter a consulta principal gratuita durante a validação.
- Não adicionar anúncios comportamentais, cadastro, paywall ou coleta de perfil sem demanda comprovada e nova revisão LGPD/UX.
- Verificar direitos/licenças da fonte antes de vender acesso a dados, widget ou API.
- Registrar hipóteses, faixas e critérios de sucesso em `docs/MONETIZATION.md`; números não validados devem ser rotulados como experimento.
