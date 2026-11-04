# MesaFlow

MesaFlow é um SaaS multi-tenant para gestão de restaurantes, com painel administrativo, mesas, comandas, pedidos, cozinha e cardápio público.

## Estado atual do projeto

O projeto já possui:

- frontend React + TypeScript + Vite
- painel administrativo visual responsivo
- identidade visual institucional em verde escuro e neutros
- cliente Supabase com validação de ambiente e autenticação real
- criação/listagem inicial de restaurantes via RPC e memberships
- migrations versionadas com RLS e regras iniciais de integridade multi-tenant
- testes unitários e testes SQL locais com PGlite

O que ainda não está pronto:

- persistência no Supabase para os módulos operacionais
- gestão de funcionários/memberships e fluxo completo de papéis
- painel de administração conectado a dados reais
- gestão de produtos, categorias, mesas e funcionários integrada
- comanda, pedidos e KDS reais
- QR Code e cardápio público
- notificações em tempo real
- impressão térmica, PWA e Capacitor

## Diagnóstico técnico

### O que já funciona

- frontend React responsivo e cliente Supabase
- login, cadastro e restauração de sessão via Supabase Auth
- onboarding inicial de restaurante e carregamento de memberships
- migrations com RLS, isolamento inicial por membro e integridade entre tabelas
- testes automatizados para autenticação, lógica de domínio e regras de segurança SQL

### O que é apenas demonstração visual

- categorias, produtos, funcionários, mesas, comandas, pedidos e status ainda usam armazenamento local, separado por usuário para evitar mistura acidental na UI
- métricas do painel ainda não são alimentadas por consultas reais
- fluxos de equipe, cozinha, notificações e relatórios ainda não estão completos

### Problemas encontrados

- as migrations existem no repositório, mas ainda não foi verificado se foram aplicadas no Supabase remoto
- a migration 004 bloqueia escrita direta de memberships e adiciona chaves estrangeiras compostas; ainda precisa ser aplicada e validada no projeto remoto
- chaves compostas são adicionadas como `NOT VALID`: dados legados precisam de auditoria antes de validar as constraints
- dados operacionais locais não são uma persistência segura para produção e ainda não foram migrados

## Arquitetura atual

- Frontend: React + TypeScript + Vite
- Estilo: CSS customizado com identidade do projeto
- Backend: Supabase + PostgreSQL + Supabase Auth
- Realtime: previsto para KDS e notificações
- PWA: ainda não configurado
- Capacitor: ainda não configurado

## Roadmap realista de implementação

### Fase 1 — Auditoria e base segura

- validar projeto atual
- documentar diagnóstico
- criar baseline de segurança e RLS
- preparar primeiros padrões multi-tenant

### Fase 2 — Autenticação e perfis

- configurar Supabase Auth
- criar cadastro de restaurante
- criar associação de usuário a restaurante
- definir permissões: owner/admin/waiter/kitchen

### Fase 3 — Administração

- dashboard real com filtros por data
- gestão de funcionários
- categorias e produtos
- adicionais e opções
- mesas e QR Code

### Fase 4 — Comandas e pedidos

- abertura de comanda
- criação de pedidos
- snapshots de preço e nome
- envio à cozinha
- status em tempo real
- histórico e fechamento

### Fase 5 — Garçom, cozinha e notificações

- fluxo mobile-first do garçom
- painel KDS
- realtime e notificações
- confirmação e cancelamento

### Fase 6 — Preparação para produção

- PWA
- impressão térmica
- Capacitor + Android
- testes de segurança
- implantação e monitoramento

## Dependências externas que exigem configuração

- conta Supabase com projeto ativo
- URL do projeto e anon key em `.env.local`
- autenticação de usuários via Supabase Auth
- configuração de políticas e RLS no banco
- (quando houver): serviço de envio de notificações push e impressora térmica local

## Status da conexão com Supabase

As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão configuradas em `.env.local` (os valores não são exibidos aqui). O host configurado respondeu ao health check do Supabase Auth com HTTP 200. Isso confirma conectividade do serviço, mas não confirma que as migrations foram aplicadas, que o schema está atualizado ou que os fluxos estão funcionando no banco.

## Limitações e riscos confirmados

- Login e cadastro exigem Supabase Auth. O modo de autenticação local foi removido; credenciais legadas são eliminadas do armazenamento local ao iniciar o app.
- Cadastro/listagem inicial do restaurante usa o RPC e memberships do Supabase; categorias, produtos, funcionários, mesas, pedidos e status ainda alteram estado local em namespaces por usuário (não é persistência remota).
- O build de produção (`npm run build`) concluiu com sucesso nesta auditoria.
- `npm test` executa testes unitários e testes de segurança SQL locais em PGlite; ainda falta um teste ponta a ponta contra uma sessão Supabase real.
- A leitura da relação `memberships` → `restaurants` foi validada no schema remoto sem autenticação; criação e carregamento com uma sessão real ainda precisam de teste ponta a ponta.
- A migration 004 remove escrita direta em memberships e adiciona constraints multi-tenant. Ela foi exercitada localmente, mas não foi aplicada no Supabase remoto.
- Constraints `NOT VALID` aceitam dados antigos até a auditoria e validação explícita; não considerar integridade legada comprovada.
- Não foi verificado o histórico remoto de migrations; a conectividade Auth não prova que o banco esteja provisionado.

## Como continuar

1. Criar um projeto no Supabase
2. Configurar `.env.local` com:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
```

3. Aplicar as migrations em ordem:

- `001_initial_schema.sql`
- `002_security_baseline.sql`
- `003_auth_restaurant_setup.sql`
- `004_membership_tenant_integrity.sql`

4. Confirmar a aplicação das migrations pelo histórico remoto
5. Auditar registros legados antes de validar constraints `NOT VALID`
6. Conectar dashboard e módulos operacionais aos dados reais do banco

## Documentação relacionada

- `ARCHITECTURE.md`
- `DATABASE.md`
- `SECURITY.md`
- `DEPLOYMENT.md`
- `CHANGELOG.md`
- `TODO.md`

## Segurança SQL local

`supabase/migrations/004_membership_tenant_integrity.sql` bloqueia escrita direta de memberships para `anon` e `authenticated` e acrescenta FKs compostas que impedem novas referências entre restaurantes. O onboarding controlado continua no RPC `create_restaurant_owner`.

Os testes em `supabase/tests/security.test.ts` aplicam as migrations em um Postgres WASM local e verificam isolamento de leitura, bloqueio de escrita direta de memberships, onboarding via RPC e rejeição de produto ligado a categoria de outro restaurante. Isso não comprova o estado do projeto Supabase remoto.

## Execução local

```bash
npm install
npm test
npm run dev
```
