# Arquitetura da aplicação

## Estrutura alvo

- `src/app`: composição de rotas Next.js; páginas devem delegar a interface para uma feature.
- `src/features/<feature>/{application,data,domain,ui}`: casos de uso, acesso aos dados da feature, regras específicas e telas. Um `contracts.ts` na raiz da feature pode declarar formas de dados compartilhadas entre camadas. Relatório mensal, dashboard e extrato total mantêm consultas Firestore em `data`; comandos, membros, operações PIX, gerenciamento de perfil/espaços do dashboard e comandos compartilhados de contas passam por `application`.
- `src/features/auth/{application,data}`: a sessão de login web coordena entrada, observação do usuário e validação do perfil em `application`; `data/authRepository` é uma fábrica que recebe Auth, login, perfil e configuração. `data/googleSignIn` implementa popup/redirecionamento; `data/userProfileService` e `data/personalSpaceService` implementam os fluxos de perfil sem escolher a instância Firebase; os repositórios web e Expo injetam seus próprios clientes.
- O serviço de perfil é composto uma única vez em `auth/data/webUserProfileRepository`, que injeta Firestore e o provisionamento de espaço pessoal. Login, dashboard, lançamentos, contas mobile web, relatório mensal, extrato de cartões e extrato total consomem esse repositório; `features/members/data/userService` mantém operações de usuários, membros e espaços. Operações financeiras aceitam Firestore explícito, preservando clientes web e nativos por meio dos respectivos repositórios. A busca do grupo autenticado do relatório mensal fica isolada em `monthlyReportUserRepository`, sem ser carregada pelo Expo junto da fonte financeira.
- `monthlyReportRepository` contém apenas consultas financeiras que recebem Firestore por argumento. A composição web fica em `webMonthlyReportRepository`; o Expo injeta seu cliente diretamente, sem importar o singleton `src/lib/firestore`.
- `src/domain`: regras financeiras puras compartilhadas entre funcionalidades, sem React ou Firebase.
- Os payloads financeiros compartilhados, como criação de transação e compra parcelada, ficam no domínio; a camada de dados os consome. Contratos específicos do dashboard Expo ficam em `apps/mobile/src/features/dashboard/contracts.ts`, sem acoplar aplicação e hook ao formato interno do repositório.
- `src/shared`: utilitários genéricos, componentes e hooks realmente reutilizados.
- `src/services`: diretório legado sem serviços; os acessos Firebase de finanças foram localizados em `src/features/<feature>/data`.
- `apps/mobile`: interface e integrações específicas do Expo.
- `packages`: código independente de plataforma que web e nativo possam compartilhar.

## Regras de dependência

1. Rotas compõem telas e declaram configurações do segmento Next.js.
2. Interfaces chamam fluxos de aplicação; não devem acessar Firestore diretamente.
3. Regras de domínio não importam React, Next.js ou Firebase.
4. A camada Firebase implementa acesso a dados e recebe a configuração do cliente da plataforma.
5. Comportamentos financeiros diferentes ficam explícitos nos parâmetros e cobertos por testes.

## Migração

A migração é incremental. Cada feature deve manter seus contratos e resultados visíveis, com testes, verificação de tipos e build antes de seguir para a próxima. O Next.js permanece na raiz porque o Firebase App Hosting publica este diretório.

O escopo, os pesos e os critérios de aceite estão em [architecture-roadmap.md](./architecture-roadmap.md).

## Fronteira web e mobile

O serviço de perfil é uma fábrica em `src/features/auth/data/userProfileService.ts` que recebe explicitamente a instância de Firestore. O repositório web compõe essa fábrica em `webUserProfileRepository`; o Expo compõe sua instância com `firebase.db` nativo. A configuração Firebase, persistência nativa e composição do serviço de perfil no Expo ficam em `apps/mobile/src/platform/firebaseClient.ts`, fora da rota. O provisionamento do espaço pessoal fica em `src/features/auth/data/personalSpaceService.ts` e passa o mesmo Firestore para os serviços de mês e categorias.

`userService` fica restrito a membros, convites e operações de espaço/conta; o Expo consome o serviço de perfil compartilhado sem importar o módulo web `userService`.

O hook `apps/mobile/src/features/auth/hooks/useMobileSession.ts` concentra o estado React da sessão; a coordenação de login e carregamento do perfil fica em `application`, e a integração Google/Firebase em `data`. A rota Expo fica responsável pela apresentação dos estados de autenticação.

O repositório `apps/mobile/src/features/dashboard/data/mobileDashboardRepository.ts` recebe o Firestore nativo e reúne consultas de meses, contas e transações. Os serviços compartilhados mantêm `db` como padrão para a web e aceitam uma instância explícita para o app nativo.

A tela financeira Expo fica em `apps/mobile/src/features/dashboard/ui/MobileDashboardScreen.tsx`, com estado e comandos em `useMobileDashboard` e `application`. O menu nativo expõe início, créditos, contas fixas, contas variáveis e agenda financeira; os relatórios e o Extrato Total permanecem no web. O dashboard segue a composição mobile web, com carrossel de cartões, lançamentos recentes e botão flutuante para lançar.

A agenda nativa é uma visualização do mês selecionado no dashboard. O caso de uso `apps/mobile/src/features/dashboard/application/mobileAgenda.ts` reutiliza o agrupamento de vencimentos do domínio e aplica os mesmos totais pendentes da agenda web; ela não faz consultas adicionais nem altera dados. A alternância entre resumo e agenda fica na tela nativa do dashboard.

A consulta nativa de contas permite marcar créditos como recebidos e despesas como pagas. A gravação é executada em `mobileDashboardRepository` com a instância Firestore nativa; depois a tela recarrega as contas e lançamentos do mês para manter saldos e agenda atualizados. O cadastro básico também está disponível no Expo: o caso de uso valida os dados, calcula a próxima posição por tipo e delega a gravação ao repositório, que injeta a instância Firestore nativa em `accountService`. Cartões começam com valor zero e exigem dia de fechamento, conforme a regra web. A edição nativa permite atualizar nome, valor inicial e vencimento de contas comuns, e nome, vencimento, fechamento, arquivamento e cartão principal de cartão/PIX quando aplicável. Cartões e PIX permanecem protegidos contra exclusão, como no web. A exclusão de conta parcelada cancela a compra e suas parcelas futuras; contas comuns são removidas do mês selecionado e seus lançamentos permanecem.

O formulário nativo de lançamento consulta categorias e contas do mês. `createMobileDashboardTransaction` aplica as regras compartilhadas de fatura, fechamento, PIX e parcelamento; as operações são gravadas pelo repositório com Firestore nativo. A edição atual altera o valor da transação e ajusta o valor base da conta quando não é cartão. A exclusão de compra parcelada cancela as parcelas restantes usando o serviço compartilhado com a instância Firestore injetada. Em 09/11/2026, a compra parcelada foi conferida no emulador: R$ 0,03 em duas parcelas geraram R$ 0,02 e R$ 0,01 nas faturas de novembro e dezembro, e o cancelamento do grupo removeu as parcelas de teste.

O relatório mensal web reutiliza `buildMonthlyReport` do domínio, incluindo médias de meses completos, total até o mês corrente e impacto de investimentos e objetivos; a tela web também permite informar ou corrigir a data de recebimento/pagamento. O Extrato Total web reutiliza `summarizeExpenses`, agrupa por categoria e mês e permite associar lançamentos não classificados a uma conta. Em 09/11/2026, um lançamento de R$ 0,01 criado no app nativo foi localizado como não classificado em `/extrato-total`, associado ao PIX e removido do aviso de pendências. As rotas `/mobile/fixas`, `/mobile/variaveis`, `/mobile/creditos` e `/mobile/agenda` seguem sendo rotas mobile web do Next.js; no Expo as mesmas funções de dashboard e contas estão integradas ao app, enquanto os relatórios permanecem no web.

O saldo real é calculado por `calculateDashboardRealBalance` em `src/domain/finance/accountBalance.ts`, usado pelo dashboard web e pelo app nativo. As consultas de impacto mensal de investimentos e contribuições de objetivos aceitam Firestore explícito, preservando o `db` web como padrão.

## Features compartilhadas

- A rota `/` usa `src/features/auth/application/loginSession`; login Google, observação do estado de autenticação, preparação do perfil e logout por falha passam pelo repositório da feature. `authRepository` recebe as dependências explicitamente. `googleSignIn` concentra popup/redirecionamento; `webAuthRepository` usa a instância Auth obtida de `src/lib/firebase`. As telas web observam sessão, consultam o usuário atual e fazem logout por `auth/application/webSession`, sem importar Firebase Auth diretamente. `webUserProfileRepository` centraliza a composição do perfil web e é consumido pelas demais features, sem passar pelo wrapper de `userService`; o antigo adaptador `src/lib/auth` foi removido após a migração dos consumidores.

- A rota `/extrato` delega para `src/features/card-statement/ui/CardStatementPage`; consultas e operações de perfil, membros, meses, contas, transações e parcelas passam por `card-statement/application` e `card-statement/data`, que compõem serviços de dados de suas features.
- O extrato total compõe o cliente web em `expense-statement/data/webExpenseStatementRepository`; `expense-statement/data/expenseStatementRepository` recebe Firestore explicitamente para consultas de meses, contas, transações, membros e associação de lançamentos sem conta.
- A conversão de contas e transações carregadas para itens do extrato fica em `card-statement/application/cardStatementViewModel`; a tela coordena carregamento e estado, sem conter a regra de seleção e ordenação dos lançamentos de cartão.
- A busca do mês selecionado, membros, contas e transações é coordenada por `card-statement/application/loadCardStatementMonth`; a página mantém autenticação e atualiza o estado visual com o resultado.
- Edição comum, antecipação de parcelas, exclusão simples e cancelamento de parcelas passam por `card-statement/application/cardStatementMutations`; a página mantém validações, estado dos diálogos, atualização otimista e notificações.
- O título, ações de navegação e resumo do total do extrato ficam em `src/features/card-statement/ui/components/CardStatementHeader`; recebem valor, visibilidade e callbacks da tela.
- Os filtros de período, categoria, responsável e cartão ficam em `src/features/card-statement/ui/components/CardStatementFilters`; a tela mantém os estados e a lógica de data e filtragem.
- Lista, modal de conciliação, estados de carregamento/vazio e apresentação do extrato ficam em `src/features/card-statement/ui/components`; a tela fornece dados e callbacks.
- Os diálogos de edição e exclusão do extrato ficam em `src/features/card-statement/ui/components`; recebem estado e callbacks da tela, enquanto validações e comandos permanecem na página.
- O modal de conciliação também pertence à feature de extrato; importações salvas e ajustes de itens ignorados passam por `card-statement/application` e `card-statement/data`.
- Coluna e modais de contas vivem em `src/features/accounts/ui`; os modais usam comandos de aplicação para persistência, e tipos/regras de conta vêm do domínio.
- `src/features/accounts/application` contém os comandos usados pelos modais de criação e edição de contas.
- `src/features/accounts/data` centraliza o acesso desses comandos ao serviço Firebase legado enquanto a migração dos serviços continua.
- Os repositórios web de contas e dashboard passam explicitamente a instância Firestore nas operações de criar/editar contas, organizar contas, carregar/criar meses, editar valores e alterar lançamentos PIX. As consultas e operações da tela mobile web de contas também fixam explicitamente o cliente web no repositório.
- Os modais permanecem em `src/components` porque são usados pelo dashboard e pelas telas mobile web.
- O modal de lançamento, compartilhado por dashboard, extrato e telas mobile web, fica em `src/features/transaction-entry/ui`; seus acessos aos serviços legados ainda serão migrados para `application` e `data`.
- O modal de lançamento usa `application` e um repositório de dados para categorias, contas, meses, parcelas e transações. O repositório adapta serviços Firebase localizados nas features de contas e lançamentos.
- `src/features/accounts/data/accountService.ts` concentra operações Firebase de contas e é compartilhado por outras features por meio de imports direcionados à feature responsável; a versão antiga em `src/services` foi removida.
- `src/features/categories/data/categoryService.ts` concentra carregamento, criação, renomeação e remoção de categorias. Os fluxos de lançamentos e preparação do espaço pessoal importam a implementação dessa feature; a versão antiga em `src/services` foi removida.
- Os serviços de dados das features exigem Firestore como argumento; não têm dependência padrão de `src/lib/firestore`. Repositórios web e Expo escolhem e passam seus clientes de plataforma.
- Serviços compartilhados de meses, transações e membros ficam em `features/months/data`, `features/transactions/data` e `features/members/data`. Parcelas ficam junto à entrada de lançamentos; metas junto à feature `financial-goals`; investimentos junto ao dashboard; e importação de faturas junto ao extrato de cartões. Os consumidores web e Expo apontam diretamente para essas áreas, sem barrel de compatibilidade em `src/services`.
- O repositório de lançamento fixa explicitamente o Firestore web para carregar/criar categorias, contas, meses, compras parceladas e lançamentos; o serviço continua aceitando Firestore injetado para outros clientes.
- O tipo `FinanceAccount` e as regras puras de conta ficam em `src/domain/finance/account.ts`; os serviços não reexportam mais tipos ou regras do domínio. Os consumidores importam contratos diretamente do domínio.
- Os contratos compartilhados `FinanceMonth` e `GroupMemberListItem` ficam no domínio, evitando que as interfaces dependam dos serviços para importar esses tipos.
- Os painéis de investimentos e objetivos financeiros, exclusivos do dashboard, vivem em `src/features/dashboard/ui/components`.
- A interface e o hook do dashboard usam `FinanceTransaction` do domínio compartilhado; a camada de dados não exporta modelos para cima da arquitetura.
- O painel de objetivos chama casos de uso em `application`; o repositório em `data` ainda adapta os serviços Firebase legados.
- O painel de investimentos chama casos de uso em `application`; o repositório em `data` adapta as operações do serviço legado. O cálculo de impacto também é consumido pelo relatório mensal e permanece compatível no serviço até migrar esse consumidor.
- O histórico PIX do dashboard tem componente próprio para filtro e diálogos; comandos de edição e exclusão continuam na aplicação do dashboard.
- Os diálogos de perfil e membros do dashboard vivem em componente próprio; carregamento, convite e remoção permanecem nos casos de uso do dashboard.
- O resumo de saldos e a navegação por áreas ficam em `DashboardOverview`; a página injeta saldos calculados e o painel ativo.
- As rotas `/mobile/fixas`, `/mobile/variaveis`, `/mobile/creditos` e `/mobile/agenda` compõem a mesma tela em `src/features/accounts/ui/MobileAccountTypePage`; consultas e operações dessa tela passam por `accounts/application` e `accounts/data`, que ainda adaptam serviços Firebase legados.
- A rota `/mobile` delega para `src/features/dashboard/ui/MobileDashboard`; os serviços de meses, contas, transações, membros, perfil e parcelamentos usados nessa tela passam por `dashboard/application` e `dashboard/data`. A autenticação continua usando o cliente Firebase compartilhado.
- O cabeçalho da tela mobile principal, incluindo o menu lateral, o menu do perfil e a navegação mensal, fica em `src/features/dashboard/ui/components/MobileDashboardHeader`; recebe dados e ações por propriedades, enquanto o estado permanece na tela.
- A configuração do Metro observa o código compartilhado no monorepo e bloqueia a pasta `.next`, pois os artefatos temporários do Next eram substituídos durante o desenvolvimento e derrubavam a indexação do bundle nativo.
- O carrossel de cartões de crédito fica em `src/features/dashboard/ui/components/MobileDashboardCreditCards`; recebe cartões, valor formatado, visibilidade e callbacks da tela, mantendo cálculos e estado no dashboard.
- A lista de lançamentos recentes fica em `src/features/dashboard/ui/components/MobileDashboardTransactions`; filtro e apresentação são isolados, e as ações de edição/exclusão são callbacks para a tela.
- O diálogo de edição de lançamento fica em `src/features/dashboard/ui/components/MobileDashboardEditTransactionModal`; recebe valores, campos e ações por propriedades, enquanto regras de gravação e antecipação permanecem na tela.
- O diálogo de confirmação de exclusão de lançamento fica em `src/features/dashboard/ui/components/MobileDashboardDeleteTransactionDialog`; a confirmação e a atualização dos dados continuam na tela principal.
- A lista, o cadastro e a confirmação de remoção de membros ficam em `src/features/dashboard/ui/components/MobileDashboardMembersDialogs`; carregamento e operações permanecem na tela e nos casos de uso de dashboard.
- Os modais de opções e exclusão da conta ficam em `src/features/dashboard/ui/components/MobileDashboardAccountDialogs`; execução e controle de estado continuam no dashboard.
- O contrato compartilhado `FinanceTransaction` fica no domínio financeiro e é usado pelo dashboard e pelas telas de contas mobile web.
