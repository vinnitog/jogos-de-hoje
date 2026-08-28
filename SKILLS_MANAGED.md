# Skills Gerenciadas Pelo Togs Backoffice

Este arquivo e gerado pelo hub `togs-backoffice`. O caminho local do control plane e resolvido fora deste repositorio. As skills abaixo foram selecionadas pelas capacidades reais deste projeto; elas nao autorizam acoplamento de codigo com outros repositorios.

| Skill | Fonte | Roteamento |
| --- | --- | --- |
| `diagnosing-bugs` | `mattpocock/skills` | javascript, typescript, bug, performance |
| `tdd` | `mattpocock/skills` | feature, bug, test |
| `javascript-testing-patterns` | `wshobson/agents` | javascript, typescript, unit-test, integration-test |
| `e2e-testing-patterns` | `wshobson/agents` | frontend, critical-flow, playwright, cypress |
| `accessibility-compliance` | `wshobson/agents` | frontend, accessibility, wcag, screen-reader |

## Licencas

- `mattpocock/skills`: `.togs/licenses/mattpocock-skills-MIT.txt`
- `wshobson/agents`: `.togs/licenses/wshobson-agents-MIT.txt`

## Regras

- Use uma skill somente quando o pedido corresponder ao seu roteamento.
- `supabase*` exige Supabase/Postgres real no projeto; capacidade apenas planejada nao basta.
- `use-railway` exige deploy Railway real ou operacao explicitamente solicitada.
- Skills de LLM/RAG exigem runtime de IA real; chat deterministico nao ativa esse perfil.
- O repositorio local continua sendo a fonte de verdade para codigo, testes, Git e deploy.
- Atualizacoes sao feitas no hub e distribuidas por `node scripts/orchestrator.mjs sync <id> --write`.
