# Gap analysis e plano de remediação

**Data**: 2026-08-22

## Resumo após correções

- 0 gaps críticos abertos
- 0 gaps altos abertos
- 2 gaps médios abertos
- 1 gap baixo aberto

## Remediado nesta revisão

1. **Dado pessoal fixo no bundle** — removido telefone ofuscado e toda lógica de decodificação.
2. **Retenção excessiva** — removido armazenamento persistente de telefones digitados e adicionada limpeza idempotente da chave legada no startup.
3. **Transparência** — incluída informação curta e acessível sobre cache e serviços externos.
4. **Minimização** — compartilhamento passou a abrir o seletor do WhatsApp sem coletar contato.

## Gaps abertos

### Médio — hospedagem não documentada

O repositório não identifica o provedor e a configuração de logs da hospedagem de produção.

- Ação: registrar provedor, região, retenção de logs e canal do responsável antes do lançamento comercial.
- Motivo: transparência e prestação de contas, art. 6º, VI e X, da [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm).

### Médio — direitos de uso da fonte não validados para monetização

A API pública funciona tecnicamente, mas isso não equivale a autorização para revenda, SLA ou uso comercial dos dados.

- Ação: validar termos/licenciamento ou contratar fornecedor autorizado antes de widget/API paga.
- Impacto: comercial e contratual; não é gap LGPD isolado.

### Baixo — ausência de varredura automatizada de segredos

- Ação: acrescentar verificação simples em CI quando o repositório adotar pipeline remoto.
- Enquanto isso: manter teste estrutural e varredura antes de cada publicação.

## Checkpoint humano

Não foi gerada política jurídica final, ROPA, RIPD ou DPA porque o app não trata intencionalmente dados pessoais em sistema próprio. Se o contexto de implantação revelar logs identificáveis, analytics ou coleta, retomar o pipeline com revisão profissional.
