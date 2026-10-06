# Coletas reais: horários, validade e resultados

As alterações estão no ReciclaMapa existente. Os dados operacionais usam D1, sessão e permissões; os atalhos Gerador demo, Coletor demo e Cooperativa demo usam exclusivamente o ambiente demonstrativo. Nenhuma credencial pública foi criada no banco real.

## Banco e publicação

Aplicar **antes de publicar o código**:

- `0004_slim_ultragirl.sql`: campos de horários, acesso privado, confirmação, validade, revisão e controle de versão; tabela de resultados; notificações transacionais.
- `0005_warm_star_brand.sql`: fotografia **dos dados públicos do anúncio**, em JSON, para manter material e região do resultado mesmo após editar o saldo. Não é foto/imagem e não usa storage.

São migrações aditivas: não removem tabelas, anúncios, reservas ou históricos anteriores. O diário e os snapshots Drizzle foram atualizados. O histórico de `collection_items` permanece consultável; novos resultados usam `stop_results`, sem duplicar os pesos antigos.

As duas migrações foram aplicadas somente no D1 **local** durante os testes. O Cloudflare publicado ainda precisa delas e do novo código. No repositório, com Wrangler autenticado:

```powershell
pnpm exec wrangler d1 migrations apply DB --remote
```

Depois, publicar pelo fluxo Cloudflare existente. Não é necessário R2, cron, serviço pago ou cartão.

Variável opcional do Worker: `DEFAULT_AVAILABILITY_DAYS=7`, entre 1 e 90. Sem configuração, são sugeridos 7 dias. Para desenvolvimento, pode ser definida em `.dev.vars`. O gerador pode escolher outro prazo no anúncio. A validade é um prazo em dias de 24 horas a partir da última confirmação, calculado e verificado no servidor. Não há dependência do relógio do navegador nem de tarefa agendada.

Registros anteriores sem horários ou validade permanecem utilizáveis: **Horário a combinar**. A primeira confirmação explícita inicia sua validade.

## Regras operacionais

- A faixa agendada deve caber inteiramente na faixa disponível de **cada** parada para o dia escolhido. Dias e faixas são horários locais informados pelas pessoas, sem previsão de chegada.
- Ao vencer, o anúncio fica a confirmar nas respostas do servidor, não entra nas novas sugestões e não aceita nova reserva. Reservas existentes são preservadas e mostram o aviso.
- Edição do gerador usa versão do anúncio. Uma edição de quantidade, localização, horários ou validade com reserva avisa a organização e marca o planejamento para revisão. Não libera outras paradas.
- A retirada de um anúncio com reserva avulsa continua visível à organização. Ela pode reconhecer a retirada e encerrar a reserva explicitamente, preservando o estado retirado. Se já havia agendamento e ocorreu uma tentativa, pode revisar os dados e registrar a ocorrência sem retirada.
- Antes de iniciar, o responsável precisa revisar e reagendar. Pode retirar uma parada explicitamente; apenas sua reserva é liberada. Retirar paradas ou mudar coordenadas invalida o traçado; a rota continua operável sem métricas viárias. Para obter um novo traçado otimizado, cancele explicitamente o rascunho e crie uma nova rota com as paradas desejadas.
- Na execução, a revisão é uma confirmação explícita de ciência dos dados atuais. Ela não bloqueia o registro de ocorrências por alterações tardias de horário. Registrar o primeiro resultado inicia a rota caso ela ainda estivesse agendada.
- Resultados são gravados individualmente pela conta responsável pela organização/base coletora. Geradores não podem registrá-los; organizações não operam paradas alheias.
- Uma parada já registrada não aceita resultado duplicado ou edição concorrente do estoque pelo gerador durante aquela execução. Resultados são históricos imutáveis nesta versão.
- Coleta completa/parcial exige peso positivo. Sem retirada, o peso é zero. A observação é opcional para todos os motivos, inclusive “Outro motivo”.
- Na parcial, a estimativa restante **substitui** o saldo; não se subtrai peso real de quantidade estimada. A estimativa anterior, o peso real e o saldo ficam separados no resultado. Não nasce outro anúncio.
- Em rotas, o saldo parcial fica indisponível para outra reserva até finalizar. Na coleta avulsa, a atualização é imediata. Um saldo existente pode ser coletado novamente, mantendo os eventos anteriores.
- Ao finalizar, todas as paradas devem ter resultado; ocorrências sem sucesso não impedem a conclusão. Sem retirada, o anúncio volta a confirmar, conservando o estoque estimado, até o gerador verificar sua disponibilidade. Um anúncio retirado pelo gerador permanece retirado.
- Após registrar algum resultado, não se cancela a rota: registre as demais ocorrências e finalize, para conservar a rastreabilidade.
- Peso recuperado é exclusivamente peso real, inclusive resultados já registrados em rotas em execução. Rotas finalizadas, sucessos completos, parciais e ocorrências são contados separadamente. Capacidade diária considera pesos já coletados e estimativas das paradas ainda não visitadas, excluindo tentativas sem retirada.
- Acesso ao local é privado ao gerador, administrador e organização com reserva. Mapas e provedores continuam usando coordenadas residenciais aproximadas. Resultados de outras organizações não são expostos a um novo reservante.

## Testes manuais

1. **Entrada:** sem sessão, abrir a raiz e verificar Entrar/Criar conta. Testar os três atalhos demo e o retorno. Com conta real, entrar e verificar Dados reais / conta.
2. **Horários:** criar anúncio com segunda-feira, 08:00–12:00; editar e recarregar. Conferir ficha/cartão e agendamento. Reservar com coletor; tentar janela 11:00–13:00 e outro dia: devem ser incompatíveis. Ajustar para 09:00–11:00 ou retirar explicitamente o ponto. Um registro antigo sem horários deve funcionar.
3. **Validade:** conferir a confirmação inicial e a validade editável. No banco local de teste, antecipar `expires_at`; atualizar o site. O anúncio deve ficar a confirmar, sumir das sugestões e recusar reserva. “Ainda está disponível” deve restaurar a elegibilidade. Editar um material reservado: verificar aviso, reserva preservada e bloqueio do início até revisar.
4. **Resultados:** agendar duas paradas. Na primeira, informar parcial, 12 kg reais e 9 kg restantes; na segunda, Local fechado, sem pesagem. Tentar finalizar antes do segundo resultado: deve falhar. Após ambos, finalizar; conferir 12 kg recuperados, uma parcial e uma ocorrência, saldo de 9 kg e histórico visível ao gerador. Reservar e coletar esse saldo novamente sem duplicar anúncio.
5. **Permissões e conflitos:** tentar confirmar/editar com outro gerador; registrar resultado com gerador/outra organização; reservar simultaneamente em duas sessões; reenviar resultado e edição com versão antiga. Devem falhar sem alterar estoque ou reservas de outras paradas.

## Testes automatizados locais

```powershell
pnpm db:migrate
$env:ALLOW_LOCAL_QA='true'
node scripts/seed-dev.mjs
pnpm dev
# Em outro terminal:
pnpm test
pnpm typecheck
pnpm test:integration
pnpm test:reliability
```

O seed e o teste de confiabilidade forçam `remoteBindings:false`. Criam somente fixtures fictícias locais. As credenciais ficam em `.wrangler/dev-credentials.json`, ignorado pelo Git, e não são os perfis públicos demo.

Cobertura: janelas e registros antigos; limite exato de expiração; migrações sem perda; reserva concorrente; versões antigas; confirmação e propriedade; revisão/notificações; parcial e coleta posterior do saldo; zero em ocorrência; finalização incompleta/duplicada; categorias históricas após edição; peso real durante execução; retirada sem cancelar outras paradas; alteração tardia com ocorrência e finalização.

## Limites desta versão

Uma faixa por dia, sem intervalos que atravessem meia-noite. As faixas são declaradas e não calculam chegadas, trânsito ou presença. Pesagens e saldos são informados pelas pessoas; não há balança integrada. Resultados não possuem fluxo de correção posterior. A demo continua ilustrativa e isolada, enquanto a operação persistente exige uma conta. Não houve publicação nem migração remota nesta entrega.
