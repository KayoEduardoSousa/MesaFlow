# MesaFlow

MesaFlow é um SaaS multi-tenant para gestão de restaurantes, com painel administrativo, mesas, comandas, pedidos, cozinha e cardápio público.

## Estado atual do projeto

O projeto já possui:

- frontend React + TypeScript + Vite
- painel administrativo visual responsivo
- identidade visual institucional em verde escuro e neutros
- cliente Supabase inicial com validação de ambiente
- estrutura inicial de banco em migrations SQL para o domínio principal

O que ainda não está pronto:

- autenticação real com Supabase Auth
- perfis e permissões adequadas por restaurante
- painel de administração conectado a dados reais
- gestão de produtos, categorias, mesas e funcionários integrada
- comanda, pedidos e KDS reais
- QR Code e cardápio público
- notificações em tempo real
- impressão térmica, PWA e Capacitor

## Diagnóstico técnico

### O que já funciona

- estrutura inicial do app React
- layout administrativo visual profissional
- navegação estática de painel
- uso de `@supabase/supabase-js`
- base de banco multi-tenant inicial com tabelas principais

### O que é apenas demonstração visual

- menu e estatísticas fixas sem dados reais
- "Sistema em desenvolvimento" e dados simulados
- ausência de autenticação real
- ausência de sincronização com banco
- ausência de dashboards conectados à data real

### Problemas encontrados

- o projeto ainda não habilita RLS no banco
- existe estrutura de dados, mas faltam políticas de segurança por restaurante
- os dados públicos não estão isolados e protegidos
- `profiles` e `memberships` ainda precisam de regras fortes de autorização
- pedidos, mesas e eventos precisam de validação de integridade de restaurante
- o frontend não possui autenticação segura nem fluxo real de login
- o README original descrevia uma etapa futura como se estivesse concluída
- não há documentação de arquitetura, banco, segurança e implantação ajustada ao projeto real

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

- O login e cadastro usam Supabase Auth quando as variáveis estão presentes; sem configuração, existe um modo local inseguro que grava senha em texto puro no `localStorage`. Não use credenciais reais nesse modo.
- As operações de restaurante, categorias, produtos, funcionários, mesas, pedidos e status atualmente alteram estado local, não dados do Supabase.
- O build de produção (`npm run build`) concluiu com sucesso nesta auditoria.
- O projeto não tem configuração de testes automatizados (`test` script/dependências) e não há diretório `.git` no caminho informado.
- A migration 002 contém políticas RLS iniciais, mas exige revisão de escalada de privilégios e integridade entre tabelas antes de considerar o backend seguro.
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

4. Implementar autenticação e perfis
5. Conectar dashboard aos dados reais do banco
6. Validar RLS e isolamento multi-tenant

## Documentação relacionada

- `ARCHITECTURE.md`
- `DATABASE.md`
- `SECURITY.md`
- `DEPLOYMENT.md`
- `CHANGELOG.md`
- `TODO.md`

## Próxima ação implementada

Foi criada a base inicial de segurança do banco em `supabase/migrations/002_security_baseline.sql`, incluindo:

- habilitação de RLS em todas as tabelas principais
- função `public.is_restaurant_member()`
- função `public.is_restaurant_admin()`
- políticas básicas de segurança multi-tenant

Esse é o primeiro passo concreto para evitar acesso cruzado entre restaurantes e preparar o sistema para autenticação real.

## Execução local

```bash
npm install
npm run dev
```

Importante: neste ambiente atual, a validação de build ficou bloqueada porque o Node/npm não está instalado no PATH do terminal. Assim que o runtime estiver disponível, execute os comandos acima para validar a aplicação localmente.
