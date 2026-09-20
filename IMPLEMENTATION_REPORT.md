# Relatório de implementação — ReciclaMapa

Revisão local em 20/09/2026. Repositório existente: `lukravz/ReciclaMapa`. Nenhum commit, push, alteração de remote, deploy ou migration remota foi realizado nesta atualização. O projeto ATLAS da pasta superior foi preservado.

## Base preservada

Next.js/React/TypeScript/Tailwind, Cloudflare Workers/OpenNext, D1/Drizzle, autenticação com bcrypt e sessões, papéis generator/collector/cooperative/admin, CSRF, rate limits, auditoria, privacidade residencial, cache, Leaflet/OpenStreetMap, Nominatim, OSRM, reservas, agendamento, coletas, histórico, impacto e separação da demonstração.

## Auditoria do trabalho anterior

O experimento anterior havia instalado o SDK `openai`, criado helpers de imagens/armazenamento e migrations ainda não aplicadas para imagens/classificações. Foram removidos o SDK, os helpers e as migrations experimentais não aplicadas, incluindo seus metadados. O schema atual não usa essas tabelas. Nenhum binding, segredo ou serviço remoto de imagens foi configurado nesta atualização. Não houve DROP de tabelas remotas.

A busca incluiu código, schema, migrations, configurações, exemplos de ambiente, tipagens, dependências e documentação. Não há funcionalidade ativa de upload persistente, classificação por serviço de IA ou bucket. O teste de migration cita nomes de tabelas antigas apenas para verificar sua ausência; a classe CSS `r2` já existente não é um binding de armazenamento.

Não foram consultados bancos remotos. Se outro ambiente tiver estruturas legadas, elas permanecem sem uso e devem ser preservadas até uma revisão específica.

## Funcionalidades entregues

- Cadastro público em dois caminhos, com coletor independente ou cooperativa no segundo caminho. Admin não aparece no cadastro público.
- ViaCEP por endpoint interno, validação de oito dígitos, normalização do hífen, cache e preenchimento manual em falhas. A confirmação de coordenadas permanece obrigatória.
- Concentração e oportunidades por território, pesos por material, fontes recorrentes, compatibilidade, capacidade, distância em linha reta, quantidade reservável e ordenação por métricas transparentes.
- Seleção de pontos elegíveis para planejamento e destaque no mapa. Pontos da oportunidade seguem para a rota mesmo quando não estão na primeira página de resultados do mapa.
- Quantidade mínima opcional da cooperativa, padrão zero. Volumes menores recebem aviso e continuam visíveis.
- Histórico com média, mínimo, máximo e tendência. Um registro não prevê; dois mostram faixa; três ou mais usam os últimos cinco registros com pesos crescentes de 1 até N.
- Resumo operacional, próximas coletas, recorrência, notificações internas persistentes, leitura individual e em lote, e acompanhamento visual de status.
- Cancelamento de reserva própria quando não vinculada a uma rota ativa, preservando validação concorrente no servidor.
- Impacto com pesos efetivamente informados na coleta, distinto de estoque e previsão, sem inventar CO₂ ou renda.
- Contagem de respostas de validação administrativa sem fabricar entrevistas reais.
- Demo isolada com oportunidade, seleção, rota OSRM, reserva, agendamento, início, coleta, impacto e notificação. Reset restaura somente a demonstração.
- Dados já carregados são mantidos em falhas de atualização; logout limpa todos os estados privados. Datas sem horário preservam o dia informado.

## Arquivos criados

```text
IMPLEMENTATION_REPORT.md
components/Account/notifications.tsx
components/Operations/operational-summary.tsx
components/Operations/opportunities.tsx
components/Operations/recurrence.tsx
components/Operations/status-timeline.tsx
components/demo-logistics.tsx
lib/cep.ts
lib/demo-flow.ts
lib/history.ts
lib/logistics.ts
lib/onboarding.ts
lib/status.ts
lib/server/cep-service.ts
lib/server/intelligence-service.ts
lib/server/notification-service.ts
migrations/0002_logistics.sql
migrations/0003_notification_events.sql
migrations/meta/0002_snapshot.json
migrations/meta/0003_snapshot.json
tests/logistics.test.mjs
tests/migrations.test.mjs
tests/routing-retry.test.mjs
```

## Arquivos modificados

```text
README.md
app/globals.css
components/Account/auth-panel.tsx
components/Cooperative/settings.tsx
components/Map/leaflet-map.tsx
components/Map/location-editor.tsx
components/Operations/live-workspace.tsx
components/Operations/routes-panel.tsx
components/Operations/validation-panel.tsx
components/Operations/waste-cards.tsx
components/Route/distance-impact.tsx
components/analytics.tsx
components/demo.tsx
components/point-explorer.tsx
components/recicla-app.tsx
components/territory-map.tsx
db/schema.ts
lib/model.ts
lib/routing.ts
lib/server/api.ts
lib/server/report-service.ts
lib/server/schemas.ts
lib/server/waste-service.ts
migrations/meta/_journal.json
scripts/test-backend.mjs
tests/model.test.mjs
types/index.ts
```

Os helpers experimentais removidos eram `lib/image-validation.ts` e `lib/server/storage-images.ts`. Como não estavam versionados, sua remoção não aparece como exclusão no diff final. Não há dependência nova no resultado final; `package.json` e lockfile voltaram à base sem o SDK experimental.

## Migrations e testes

`0002_logistics.sql` acrescenta o mínimo de coleta e a tabela/índice de notificações. `0003_notification_events.sql` acrescenta gatilhos para eventos de reserva, agendamento, início, coleta e cancelamento. Foram aplicadas somente ao D1 local, sem reset. O teste SQLite executa migrations sobre dados existentes e verifica preservação, eventos e rollback.

| Verificação | Resultado |
| --- | --- |
| `pnpm test` | 23 testes aprovados, zero falhas |
| `pnpm typecheck` | Aprovado |
| `pnpm build` | Build Next.js aprovado |
| `pnpm test:integration` | Aprovado com servidor e D1 locais |
| Interface | Conferida em 360, 390, 768 e 1440 px, sem overflow horizontal observado |

A integração cobre sessão, RBAC, CSRF, privacidade residencial, reserva concorrente 200/409, propriedade, rotas, agendamento, início, coleta com peso informado, impacto, auditoria, notificações próprias, bloqueio de leitura de notificação alheia e liberação de reserva. As contas e registros de teste são fictícios e existem apenas no ambiente local. Testes de provedores simulam sucesso e falha sem dependência de disponibilidade externa.

A revisão da Demo detectou que a segunda consulta da comparação OSRM podia receber 429 pelo intervalo compartilhado do provedor. Foi adicionada uma única tentativa após dois segundos, mantendo os limites do servidor, cancelamento e erro quando a indisponibilidade persiste. O teste adicional cobre recuperação, limite de tentativas e cancelamento.

A Demo foi executada no navegador até a etapa 11: quatro pontos, 98 kg fictícios, rota original de 14,2 km e sugerida de 12,4 km obtidas pelo OSRM, notificação demonstrativa e reset para 179 kg disponíveis e zero coletas. Também foram conferidos o sino, logout, cadastro em dois caminhos e opções de coletor/cooperativa.

O primeiro comando de integração desta revisão encontrou o servidor desligado; após iniciar `pnpm dev`, a execução completa passou. Build Next.js não equivale a deploy: o empacotamento OpenNext anterior encontrou `EPERM` de symlink no Windows e não foi revalidado nesta rodada.

## Limites e configuração externa

- O Worker publicado e seus bindings reais não foram inspecionados nesta revisão. O usuário informou que já existe implantação; não se deve criar infraestrutura substituta.
- `wrangler.jsonc` local contém UUID de desenvolvimento fictício, placeholders de D1 em produção/demo e `APP_ORIGIN` inválido de exemplo. Esses valores precisam ser comparados aos do painel antes de publicar. Não foram alterados ou inventados IDs reais.
- Nenhum resultado aqui afirma teste em produção, garantia de cotas gratuitas ou validação de billing da conta Cloudflare. O núcleo não acrescenta serviço comercial nem requisito de cartão; hospedagem e provedores públicos têm limites operacionais.
- ViaCEP, Nominatim, mapas e OSRM exigem rede. Falhas são sinalizadas; não existe fabricação de localização ou distância. Manter dados carregados não equivale a sincronização offline de novas operações.
- A previsão é estimativa estatística, nunca estoque publicado automaticamente. Peso coletado é informado pelo operador, sem aferição por hardware.
- A heurística de rotas não garante ótimo global. O refinamento opcional 2-opt foi deixado de fora para preservar estabilidade e limitar chamadas externas.
- O endpoint agregado de inteligência ainda carrega os dados autorizados para cálculo no servidor; grandes bases exigirão agregação/paginação adicional e medição de desempenho.

## Comandos manuais

Para rodar localmente, na pasta `reciclamapa`:

```powershell
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

Para validar em outro terminal:

```powershell
pnpm test
pnpm typecheck
pnpm build
pnpm test:integration
```

A integração requer as contas locais de QA. Somente em um ambiente local de teste, `node scripts/seed-dev.mjs` prepara as credenciais ignoradas pelo Git. Não execute seed em produção.

Para uma futura atualização de produção, primeiro confira no painel o Worker, o binding `DB`, o banco existente, o domínio e o histórico de migrations. Alinhe os valores locais e mantenha um backup recuperável. Após autorização específica, os comandos de referência são:

```powershell
pnpm exec wrangler d1 migrations list DB --remote --env production
pnpm exec wrangler d1 migrations apply DB --remote --env production
pnpm cf:build
pnpm exec wrangler deploy --env production
```

Esses comandos remotos não foram executados. Se o histórico remoto tiver migrations experimentais com numeração conflitante, reconcilie o histórico antes de aplicar; não renumere ou apague estruturas aplicadas por suposição. No Windows, o build OpenNext pode exigir um ambiente com suporte a symlinks ou WSL/Linux.
