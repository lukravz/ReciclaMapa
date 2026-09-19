# RECICLAMAPA — etapa 2

**Resíduos em dados. Dados em rotas.**

Evolução do MVP existente, preservando identidade visual, navegação, cadastros, validação, previsão por histórico e separação entre dados demonstrativos e próprios. Projeto independente na subpasta `reciclamapa`; o ATLAS da pasta superior foi preservado. Nenhum commit, push ou deploy foi realizado.

## Executar localmente

Requer Node.js 22.13+ e pnpm (há `pnpm-lock.yaml`).

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Abra [http://localhost:3001](http://localhost:3001). Com as dependências instaladas, também é possível usar `node node_modules/next/dist/bin/next dev --webpack -p 3001`. Para produção local: `pnpm build` e `pnpm start`.

## Bibliotecas instaladas

- `leaflet@1.9.4`: mapas, marcadores e camadas geográficas.
- `react-leaflet@5.0.0`: integração React, carregada somente no cliente.
- `leaflet.markercluster@1.5.3`: agrupamento quando há mais de 20 pontos não selecionados.
- `@types/leaflet@1.9.20` e `@types/leaflet.markercluster@1.5.6`: tipagem.

A base continua Next.js 16, React 19, TypeScript, Tailwind e Lucide. Nenhuma biblioteca de autenticação, pagamento ou IA foi adicionada.

## APIs e variáveis de ambiente

**Nenhuma API key ou cartão é necessário.** Os padrões funcionam sem `.env.local`. As opções de `.env.example` podem ser copiadas para `.env.local`:

| Variável opcional | Padrão / finalidade |
| --- | --- |
| `NOMINATIM_BASE_URL` | `https://nominatim.openstreetmap.org/`, geocodificação direta e reversa |
| `OSRM_BASE_URL` | `https://router.project-osrm.org`, trajetos de automóvel |
| `GEOCODING_USER_AGENT` | `ReciclaMapa/2.0 (local-MVP)`, identificação enviada aos provedores; configurar contato real antes de ampliar o uso |

Os endpoints internos `POST /api/geocode`, `POST /api/reverse-geocode` e `POST /api/route` validam entradas, consultam os provedores e devolvem erros legíveis. Tiles públicos do OpenStreetMap são carregados diretamente pelo navegador, com atribuição visível.

**Nominatim público tem limites estritos:** no máximo uma requisição por segundo para toda a aplicação, identificação do cliente, cache e ausência de autocomplete ou consultas em massa. Nesta versão, consultas são explícitas, têm debounce de 700 ms e passam por uma fila compartilhada no processo com intervalo mínimo de 1,1 s. Geocodificação tem cache de 24 h; rotas, de 1 h. Cada cache tem limite de 250 entradas; consultas iguais em andamento são deduplicadas. A fila aceita até oito consultas pendentes. Consulte a [política do Nominatim](https://operations.osmfoundation.org/policies/nominatim/) antes de ampliar o uso. Em múltiplas instâncias, será necessário centralizar fila/cache ou mudar de provedor.

Também se aplicam a [política de tiles OSM](https://operations.osmfoundation.org/policies/tiles/) e as condições do [servidor público OSRM](https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy). Esses serviços de demonstração não oferecem garantia de disponibilidade. A aplicação não baixa mapas em massa nem inventa rotas quando o serviço falha.

## Fluxo de uso e teste manual

1. Selecione **Meus cadastros**. Estoque, cooperativa, programação e histórico ficam separados do modo demonstrativo.
2. Em **Cadastrar Resíduo**, informe um gerador e 20 kg de papelão. Complete rua, número (ou s/n), bairro, cidade e estado.
3. Clique em **Buscar endereço no mapa** e escolha um resultado; alternativamente, clique no mapa, use **Usar minha localização** ou informe latitude/longitude manualmente. O clique tenta preencher o endereço por geocodificação reversa. Revise os campos e marque **Confirmar localização** antes de salvar.
4. Abra o popup do ponto no **Mapa** e clique em **Adicionar à rota**. Ele mostra material, kg, região, disponibilidade, recorrência e status.
5. Em **Cooperativa**, configure nome, endereço, posição, raio, capacidade e materiais aceitos. Use os filtros de 5/10/15/20 km, área de atuação, materiais e recorrência. Distâncias até a base são calculadas em linha reta por Haversine.
6. Selecione vários pontos. Em **Rotas**, ajuste início e destino opcional; a cooperativa é o padrão quando configurada. Clique em **Calcular rota real**. O sistema compara a ordem de seleção com a heurística de vizinho mais próximo, consultando o OSRM para ambas quando diferentes. Se a alternativa for maior nas ruas, preserva a original.
7. Confira o mapa com paradas numeradas, traçado, kg, materiais, distância e duração. Ative a comparação com o traçado original. Uma alteração de pontos ou origem/destino invalida o cálculo anterior.
8. Salve a programação ou conclua a coleta. A distância efetivamente percorrida pode ser informada a partir do odômetro; deixá-la vazia não transforma a estimativa planejada em percurso realizado. Capacidade excedida ou material não aceito impedem a conclusão até ajustar a seleção/configuração.
9. Confira **Impacto**: estoque, peso coletado, geradores, coletas e comparação viária. Recarregue para verificar a persistência.
10. Em **Demo**, execute a apresentação de cerca de 30 s. Ela usa sete geradores fictícios, destaca 124 kg no Centro, seleciona quatro pontos/98 kg, calcula a rota pelas ruas e registra uma coleta isolada. A rede pode ampliar o tempo; falhas interrompem a apresentação com mensagem e opção de repetir. **Restaurar dados da demo** reinicia esse cenário. Na Visão Geral demonstrativa há restauração do estoque/histórico demonstrativo, com confirmação, preservando os cadastros próprios e a validação.

No celular, use o menu hamburger e o drawer de filtros. Em **Concentração**, alterne marcadores/círculos proporcionais: a área dos círculos representa o peso em kg. O ranking por região continua disponível. Fontes recorrentes têm identificação própria; previsões dependem de histórico e não criam estoque automaticamente.

## O que é real, estimado ou demonstrativo

| Informação | Natureza |
| --- | --- |
| Mapa e ruas | Dados geográficos OpenStreetMap |
| Geolocalização | API nativa do navegador, somente após solicitação/permissão; nunca bloqueia o cadastro manual |
| Endereço → coordenadas e caminho inverso | Consulta real ao Nominatim, sujeita à qualidade do cadastro OSM e confirmação do usuário |
| Distância até a cooperativa / raio | Haversine sobre coordenadas; linha reta, não distância viária |
| Traçado, distância e duração da rota | Cálculo OSRM sobre vias reais; planejamento estimado, sem trânsito ou rastreamento |
| Redução de km | Diferença calculada entre as rotas original e sugerida; aparece sem valor quando não há comparação viária |
| Distância efetivamente percorrida | Informação opcional do usuário; não é medição por GPS |
| Geradores/quantidades iniciais e apresentação | Dados demonstrativos em coordenadas coerentes de Fortaleza; não comprovam coletas reais |
| Cadastros e conclusão de coleta | Dados declarados pelo usuário, armazenados localmente; sem auditoria externa |
| Previsão de recorrência | Estimativa a partir do histórico existente, identificada na interface |

As distâncias da Demo não são fixas. Os 98 kg são dados declaradamente demonstrativos: 42 + 18 + 13 + 25 kg. O cenário isolado acrescenta 26 kg no Centro para totalizar 124 kg na região. O estoque demonstrativo normal mantém os seis pontos e 157 kg do MVP. Nenhum CO₂ evitado, renda ou economia financeira é presumido.

## Privacidade, persistência e migração

Tipos organizados em `types/index.ts`; adaptador local em `lib/storage.ts`. A chave **reciclamapa-v1** foi mantida para recuperar o conteúdo anterior, agora com esquema `version: 2`. Antes da primeira migração, o conteúdo antigo é copiado para **reciclamapa-backup-before-v2**. Cadastros, pesos, coletas e validação são preservados. Pontos próprios com localização esquemática ficam pendentes de confirmação, fora do mapa/roteamento, e podem ser corrigidos pelo botão da lista. Rotas históricas sem cálculo viário não recebem distâncias retroativas.

Para residências, mapas de operação, concentração, filtros de distância e roteamento usam coordenadas arredondadas a duas casas decimais (aproximadamente 1 km). Endereços completos não aparecem nos popups. Buscas residenciais enviam somente bairro/cidade/estado; geocodificação reversa e OSRM recebem posição aproximada. O formulário de cadastro permite ao próprio usuário conferir a posição exata. Por isso a rota residencial atende a área aproximada, não a porta do imóvel.

O endereço completo e as coordenadas cadastradas continuam no LocalStorage deste navegador. Não há conta, controle de acesso, sincronização ou criptografia local. A aplicação não envia nomes de geradores aos provedores de mapas. A localização atual, quando escolhida como origem, é enviada ao OSRM no cálculo solicitado. Tiles revelam ao provedor a área visualizada. Os dados são separados por origem: `localhost` e `127.0.0.1` têm armazenamentos distintos. Limpar os dados do navegador remove os registros; falhas de armazenamento são informadas e conteúdo incompatível não é sobrescrito automaticamente.

## Arquivos criados nesta etapa

| Arquivos | Responsabilidade |
| --- | --- |
| `types/index.ts` | Pontos, cooperativas, rotas, coletas, entrevistas e estado persistido |
| `lib/geo.ts` | Haversine, proximidade, raio e proteção de coordenadas residenciais |
| `lib/geolocation.ts` | API nativa e mensagens para permissão negada/timeout |
| `lib/geocoding.ts` | Cliente das consultas diretas/reversas |
| `lib/routing.ts` | Comparação real entre ordens, invalidação e privacidade |
| `lib/server/providers.ts` | Validação, fila, cache, timeout e acesso aos provedores |
| `app/api/geocode/route.ts`, `app/api/reverse-geocode/route.ts`, `app/api/route/route.ts` | Endpoints internos do Next.js |
| `components/Map/leaflet-map.tsx` | Mapa real, popups, cluster, traçado e localização |
| `components/Map/location-editor.tsx` | Endereço, escolha no mapa e confirmação |
| `components/Map/concentration-view.tsx` | Visualização ponderada por kg |
| `components/Cooperative/settings.tsx` | Base, raio, materiais e capacidade |
| `components/Route/distance-impact.tsx` | Comparações históricas e percurso informado |
| `tests/geography.test.mjs` | Testes de geografia, migração, privacidade, falhas e integração das regras |
| `scripts/test-services.mjs` | Verificação opcional dos endpoints com provedores reais |
| `.env.example`, `pnpm-lock.yaml` | Configuração documentada e versões resolvidas |

## Arquivos alterados nesta etapa

`package.json`, `.gitignore`, `README.md`, `app/layout.tsx`, `app/globals.css`, `components/recicla-app.tsx`, `components/registration.tsx`, `components/territory-map.tsx`, `components/point-explorer.tsx`, `components/route-planner.tsx`, `components/analytics.tsx`, `components/demo.tsx`, `components/primitives.tsx`, `lib/model.ts` e `lib/storage.ts`.

A navegação, a identidade visual, os componentes de validação, os testes anteriores e o favicon foram preservados. WebMCP opcional continua oferecendo `reciclamapa_read_summary`, somente leitura de indicadores.

## Verificação e limites

```sh
pnpm test
pnpm typecheck
pnpm build
# Opcional, com servidor local em execução e acesso à internet:
node scripts/test-services.mjs
```

Os 14 testes automatizados cobrem estoque/coleta e duplicidade, Demo, previsão histórica, Haversine/raio, migração, proteção residencial, invariância da rota, geolocalização com navegador simulado e falhas de serviço sem distâncias inventadas. As chamadas externas do teste de integração são reais e devem ser executadas moderadamente.

Verificação realizada nesta etapa: TypeScript e build de produção aprovados; cadastro de 20 kg após geocodificação direta; clique no mapa com coordenadas e endereço reverso; popup e seleção; configuração de cooperativa e filtro de raio; conclusão de coleta atualizando impacto; persistência após reload; Demo completa de quatro paradas; interface desktop, 768 px e 360 px, sem rolagem horizontal. A Demo consultada resultou em 14,2 km antes e 12,4 km depois; outra rota de quatro paradas mudou a ordem e passou de 18,3 para 14,5 km. São resultados dos testes, não constantes da aplicação. Ambos os traçados foram verificados no mapa. Houve timeout do provedor público; a tentativa seguinte funcionou, confirmando o tratamento de erro. GPS foi verificado com simulação da API nativa (sucesso e recusa), sem solicitar a localização pessoal do operador. O agrupamento acima de 20 pontos foi implementado e compilado, mas não recebeu teste manual com um conjunto grande de cadastros.

Limites atuais: até 20 paradas por cálculo; heurística sem garantia de ótimo; perfil de automóvel, sem restrições de caminhão, janelas de atendimento ou trânsito; aproximação residencial; qualidade variável de endereços; disponibilidade dos serviços públicos e da internet; uma programação ativa por modo; LocalStorage finito e sem sincronização. GPS exige contexto seguro (HTTPS ou localhost) e permissão do navegador. O mapa é carregado sob demanda; cadastros e edição manual continuam possíveis quando o provedor externo falha. Para escalar, será necessário backend persistente e provedores/fila/cache adequados ao volume.

## Etapa 3 — contas, D1 e operação persistente

A terceira etapa adiciona uma camada persistente opcional por ambiente, sem misturar a Demo com dados reais. O modo **Demonstrativos** continua isolado no navegador e mantém mapa, concentração, rotas, impacto e apresentação de cerca de 30 segundos. O modo **Dados reais / conta** usa Next.js Route Handlers, serviços TypeScript, Drizzle ORM e Cloudflare D1/SQLite. O navegador guarda apenas a preferência de modo e estado visual; usuários, perfis, resíduos, coordenadas, cooperativas, reservas, rotas, agendamentos, coletas, pesos reais, entrevistas, auditoria, cache e limites ficam no banco.

### Persistência e segurança

As tabelas normalizadas estão em `db/schema.ts` e as migrations SQL em `migrations/`. O conjunto inclui `users`, `profiles`, `sessions`, `cooperatives`, `cooperative_materials`, `waste_points`, `routes`, `route_points`, `collections`, `collection_items`, `validation_interviews`, `audit_logs`, `rate_limits`, `provider_cache`, `provider_locks`, `legacy_imports` e `operation_guards`. Senhas usam `bcryptjs` com 12 rounds; sessões usam token aleatório somente em cookie `HttpOnly`, `SameSite=Lax`, com hash SHA-256 no banco e expiração de sete dias. E-mail e senha nunca são retornados.

Cada mutação valida Zod no servidor, verifica origem/CSRF, aplica rate limit por IP/conta e registra auditoria. O papel determina as ações: geradores criam/editam/cancelam seus resíduos; cooperativas e coletores reservam, roteirizam, agendam e coletam; administradores consultam indicadores, auditoria e validação. Propriedade é conferida no servidor. Reserva e coleta usam uma transação D1 em batch com precondição: se duas cooperativas tentarem reservar o mesmo ponto, uma recebe 200 e a outra 409, sem sobrescrever a primeira. Status percorrem `available → reserved → scheduled → collected` ou `cancelled`; cancelamento libera materiais vinculados a rotas abertas.

Para residências, a coordenada exata permanece privada no banco. Consultas públicas recebem coordenada arredondada e endereço público reduzido; somente proprietário, cooperativa que reservou e administrador recebem a posição completa. O mesmo filtro é usado em distância, raio, mapas e OSRM. O endereço completo é aceito apenas no servidor autenticado e não aparece no mapa público.

### Endpoints novos

`POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`; `GET/POST /api/waste`, `GET/PATCH/DELETE /api/waste/:id`, `POST /api/waste/:id/reserve`, `/schedule` e `/collect`; `GET/POST /api/cooperatives`; `GET/POST /api/routes`, `/api/routes/:id/schedule`, `/start`, `/cancel` e `/collect`; `GET /api/impact?period=today|7|30|all`; `GET /api/history`; `GET/POST /api/validation`; `GET /api/admin`; `GET/POST /api/import`. Os endpoints anteriores de geocodificação e OSRM continuam ativos, agora com cache/limite compartilhável em D1.

### Como executar a etapa 3 localmente

```powershell

pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate
pnpm dev
```

`wrangler.jsonc` define os ambientes `development`, `demo` e `production`, com D1 separado por ambiente. Os IDs no arquivo são placeholders intencionais: substitua-os antes de uma conta Cloudflare real. Para criar contas fictícias somente no banco local, rode `node scripts/seed-dev.mjs`; as credenciais são gravadas em `.wrangler/dev-credentials.json`, ignorado pelo Git. Não execute esse seed em produção.

Para D1 remoto: crie três bancos no painel/CLI Cloudflare, substitua `database_id` em `wrangler.jsonc`, faça `wrangler d1 migrations apply DB --remote --env production` e configure `APP_ORIGIN` com o domínio real. Não há segredo no repositório. A publicação ainda não foi feita. O comando `pnpm cf:build` gera o pacote OpenNext para Workers; no Windows, a ferramenta pode falhar ao criar symlinks por permissão do sistema. Nesse caso, use WSL/Linux ou habilite symlinks no ambiente, sem alterar o código.

### Fluxo de operação persistente

Um gerador cria a conta, publica um resíduo e acompanha o cartão em **Meus resíduos**. Uma cooperativa cria a própria base, escolhe pontos por material/raio, reserva, salva uma rota, agenda data e janela, inicia e registra o peso real por parada; o gerador vê o status agendado. **Impacto** filtra hoje, 7 dias, 30 dias ou todo o período e usa o peso real de `collection_items`, não a estimativa inicial. **Histórico** calcula média, faixa e tendência simples para fontes recorrentes. **Validação** e **Gestão** são protegidas por perfil admin e começam vazias em bases novas.

### Migração do MVP

Depois do login, o cartão “Dados das etapas anteriores” detecta registros próprios no `reciclamapa-v1`, pede confirmação e envia um payload validado para `POST /api/import`. O servidor cria IDs estáveis, guarda uma cópia em `legacy_imports` e importa pontos/coletas em batch; dados demonstrativos são rejeitados. Coletas antigas sem peso real permanecem no histórico legado, mas não entram nas métricas comprováveis. O LocalStorage só é removido depois da resposta bem-sucedida. Repetir o mesmo payload é idempotente por checksum.

### Verificação da terceira etapa

Além dos 14 testes puros existentes, `node scripts/test-backend.mjs` passou no D1 local com quatro contas fictícias: sessão, cadastro, proteção de residência, tentativa de edição por outro usuário (403), reserva concorrente (200/409), rota, agendamento, início, coleta de 29,5 kg reais, impacto, auditoria, validação admin e logout. `pnpm typecheck` e o build Next.js passaram. O OpenNext concluiu a compilação Next e falhou somente na etapa final de bundle por `EPERM` de symlink no Windows, limitação documentada acima. Nenhum seed, migration `--remote`, commit, push ou deploy foi executado.
