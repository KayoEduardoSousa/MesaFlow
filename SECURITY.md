# MesaFlow — Segurança e RLS

## Diagnóstico atual

O projeto contém as migrations `001_initial_schema.sql` a `004_membership_tenant_integrity.sql`. A migration 002 habilita RLS e cria políticas iniciais por associação; a 003 cria o RPC de provisionamento; a 004 bloqueia escrita direta de memberships e impõe relações entre registros do mesmo restaurante. A existência dos arquivos não comprova que foram aplicados ao Supabase; o estado remoto ainda precisa ser verificado pelo histórico de migrations.

O endpoint Supabase configurado respondeu ao health check de Auth (HTTP 200). Isso comprova conectividade do serviço, não comprova configuração de usuários, schema, migrations aplicadas nem autorização correta.

## Riscos atuais

- O `src/App.tsx` ainda mantém cadastros, produtos, mesas, pedidos e funcionários em `localStorage`, agora em namespaces distintos por usuário autenticado; isso evita mistura acidental na UI, mas não substitui persistência e autorização no Supabase.
- O modo de autenticação local foi removido; o login exige Supabase Auth. A carga do app remove registros de credenciais e a sessão visual legados do armazenamento local.
- A sessão atual é restaurada do Supabase Auth; autorização de cada operação continua dependendo de RLS no banco, não do estado visual do frontend.
- A migration 004 remove as políticas de insert/update de `memberships` e revoga `INSERT`, `UPDATE`, `DELETE` e `TRUNCATE` de `PUBLIC`, `anon` e `authenticated`; mudanças de membership precisam de RPCs controlados.
- A migration 004 cria FKs compostas `NOT VALID` para novas relações entre tabelas do mesmo restaurante. Linhas anteriores à migration ainda precisam de auditoria e validação explícita.
- As políticas de pedidos e itens permitem escritas diretas pelo cliente; mudanças de status e itens deveriam ser validadas por operações de banco com transações e regras por papel.
- O fluxo de funcionários cria apenas registros locais; não cria usuários de Auth nem memberships reais.

## Diretrizes de implementação

- usar `auth.uid()` como base da identidade do usuário
- verificar associação do usuário no restaurante com funções seguras
- usar `WITH CHECK` e `USING` nas políticas
- bloquear exclusão em tabelas de histórico ou pedidos
- nunca confiar no frontend para autorização
- manter a `service_role` apenas no backend

## Segurança e validação local

A migration `002_security_baseline.sql` estabelece as políticas RLS iniciais. A `004_membership_tenant_integrity.sql` fecha a escrita direta de membership e adiciona constraints compostas. Testes PGlite aplicam localmente as migrations e cobrem:

- leitura de restaurantes restrita por associação
- bloqueio de alteração/inserção direta de memberships por usuário autenticado
- onboarding via RPC controlado, inclusive slug duplicado sem promoção de membership existente
- rejeição de produto associado a categoria de outro restaurante

Esses testes não demonstram que a migration 004 foi aplicada no Supabase remoto nem substituem um teste ponta a ponta com sessão Auth real.

## Testes de segurança esperados

- usuário de restaurante A não acessa dados de restaurante B
- funcionário sem papel de admin não pode gerenciar configurações
- pedido de cozinha não expõe dados de outras comandas
- operação modificada via frontend não altera `restaurant_id`
- operações de exclusão são bloqueadas quando a linha não pertence ao restaurante do usuário
