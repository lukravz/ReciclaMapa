# Planos, perfil e configurações

> Publicação de 06/10/2026: melhorias de coletas, contas, planos e preferências enviadas ao GitHub e publicadas no Worker `reciclamapa`. Migrações remotas `0004` a `0007` aplicadas. Versão Cloudflare: `950330c0-7208-4f6a-a810-134bb7c563e1`. Site e endpoints públicos verificados. As observações de não publicação abaixo registram etapas anteriores.


Implementação no ReciclaMapa existente, sem cobrança, contratação, serviços pagos ou alteração de planos pelo navegador.

## O que funciona

- Catálogo único em `lib/plans.ts`: Gratuito, Pro e Institucional; recursos implementados e em desenvolvimento.
- Plano vinculado à cooperativa/base quando ela existe. Antes disso, vinculado à conta. Perfil de atuação continua separado do plano e não pode ser alterado no formulário.
- Novas contas gratuitas podem manter uma rota aberta (rascunho, agendada ou em andamento). A criação valida o limite na mesma transação que grava a rota, impedindo duas criações simultâneas. Reservas avulsas, finalização de rotas e consulta ao histórico não são bloqueadas por plano.
- Contas e organizações existentes na migração mantêm os acessos anteriores, incluindo rotas paralelas, análises e previsões. Continuam identificadas como Gratuito com acessos anteriores preservados; não são convertidas em assinaturas pagas.
- Análises e previsões são filtradas no servidor para novas contas gratuitas. Os próprios registros históricos continuam acessíveis.
- Relatório CSV e produtividade da organização têm autorização no servidor e consultam somente a organização da conta. O CSV omite endereços, contatos e observações privadas e neutraliza fórmulas em células.
- Página Planos na navegação e no perfil, com comparação, público, plano atual, “Preço a definir”, “Sob consulta” e “Contratação em breve”. Não há botão de ativação paga nem solicitação fictícia.
- Na demo, a troca de plano afeta somente os exemplos. Cadastro, permissões e assinatura reais não são alterados. O CSV demonstrativo identifica a origem fictícia.
- Menu superior acessível por teclado, nome, iniciais, perfil, plano, organização, configurações e saída. No celular, o avatar abre os mesmos dados.
- Edição autenticada de nome, telefone opcional, cidade e estado, com proteção contra gravação de versão antiga. E-mail e papel permanecem somente leitura.
- Preferências de tema claro, escuro, sistema e redução de animações no banco. A aparência é armazenada também no navegador e aplicada antes da primeira pintura. Visitantes e demo usam preferências locais.
- Categorias de notificações filtram o sino; o histórico completo permanece acessível. Alterações críticas continuam nas rotas/anúncios. Confirmações de disponibilidade geram eventos transacionais.
- Troca de senha exige senha atual, mínimo de 12 caracteres, proteção contra tentativas repetidas e encerra todas as sessões. É necessário entrar novamente.

## Migrações

Novas nesta etapa:

1. `0006_yummy_nightshade.sql`: planos de contas/organizações, preferências, preservação explícita dos acessos anteriores e padrões seguros para cadastros novos.
2. `0007_availability_confirmation_notification.sql`: evento de confirmação de disponibilidade.

As migrações são aditivas, não apagam dados nem mudam reservas. Foram aplicadas somente ao D1 local. Na publicação, aplicar todas as migrações pendentes **antes** do código:

```powershell
pnpm exec wrangler d1 migrations apply DB --remote
```

As migrações 0004/0005 da etapa anterior também precisam ser aplicadas caso ainda estejam pendentes. Depois, usar o fluxo de publicação Cloudflare existente. Não foi executada publicação remota nesta etapa.

Não há configuração de pagamento. Um futuro processo comercial deve atualizar o plano no servidor, com autorização e auditoria adequadas. Não há API para o usuário ou administrador do navegador atribuir planos. O marcador `legacy_access` deve ser preservado até uma migração explicitamente planejada. Não o apague ao publicar.

## Como testar

1. **Acessos existentes:** entrar com uma conta anterior à migração; abrir Planos e conferir “Acessos anteriores preservados”. Abrir rotas já salvas, histórico, análises e finalizar normalmente.
2. **Gratuito novo:** criar uma conta coletora e configurar a base. Reservar pontos, criar uma rota e tentar uma segunda antes de concluir/cancelar a primeira. A API deve recusar, inclusive duas criações concorrentes. Os materiais e rotas salvos continuam visíveis.
3. **Demo:** abrir a demonstração, Planos, escolher Gratuito, Pro e Institucional. Verificar análises bloqueadas no Gratuito e abertas no Pro; recursos ainda não implementados continuam identificados em todos os planos. Sair da demo e conferir que o plano real não mudou.
4. **Perfil:** editar nome/telefone/cidade/estado, salvar e recarregar. E-mail e papel não editáveis. Tentativas diretas à API com e-mail, papel, plano ou ID de outra conta devem ser rejeitadas.
5. **Aparência:** salvar cada tema e recarregar. Em Sistema, alterar o tema do dispositivo e conferir acompanhamento. Repetir no visitante, demo e conta. Testar menus, cadastro, mapa, rotas, gráficos e tabelas em tela estreita.
6. **Notificações:** desativar uma categoria e gerar um evento com outra conta local de teste. O sino filtra o evento; “Ver histórico completo” e o acompanhamento operacional continuam mostrando-o.
7. **Segurança:** senha atual incorreta deve falhar. Com a correta, alterar em uma conta fictícia; sessões de outros dispositivos devem deixar de funcionar e o novo login deve aceitar somente a senha nova.

Automação local:

```powershell
pnpm db:migrate
pnpm dev
# Em outro terminal, com seed fictício local já configurado:
pnpm test
pnpm typecheck
pnpm test:plans
pnpm test:integration
pnpm test:reliability
pnpm build
```

`test:plans` aceita somente localhost. Cria contas fictícias e altera o plano apenas da organização recém-criada no D1 local para testar os recursos Pro. As credenciais de teste ficam em `.wrangler`, ignorado pelo Git.

## Em desenvolvimento / limites

- Gestão de equipe, convites e permissões compartilhadas.
- Múltiplas unidades, comparação e consolidação entre unidades, usuários por unidade e relatórios institucionais com filtros combinados de período/material/região.
- Alteração verificada de e-mail e migração de perfil de atuação.
- Contratação, preços finais e cobrança. Não há envio de notificações por e-mail, WhatsApp ou push.
- A demo conserva seu planejador ilustrativo de uma rota; as rotas paralelas persistentes são testadas no backend local. Nenhum controle de equipe/unidades é apresentado como funcional.
- A conta proprietária da cooperativa continua sendo a responsável pela operação; o plano não expande o acesso a outras organizações.
