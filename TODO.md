# TODO — MesaFlow

## Fase 1 — Auditoria do projeto atual

- [x] analisar estrutura atual do projeto
- [x] revisar package.json
- [x] revisar README
- [x] revisar App.tsx
- [x] revisar styles.css
- [x] revisar configuração do Supabase
- [x] revisar migrations
- [x] documentar diagnóstico
- [x] criar roadmap inicial

## Fase 2 — Preparação da arquitetura

- [x] instalar e configurar base de testes Vitest
- [x] validar conversão de preços para centavos inteiros com testes
- [x] revisar policies de membership e integridade multi-tenant localmente
- [x] adicionar migration de bloqueio de escrita direta e FKs compostas
- [x] cobrir RLS/RPC/integridade com testes SQL locais em PGlite
- [ ] aplicar migrations pendentes no Supabase e confirmar histórico remoto
- [ ] auditar dados existentes antes de validar as constraints `NOT VALID`
- [x] carregar associações e restaurantes do usuário pelo Supabase
- [x] refletir no painel o restaurante retornado pelo RPC de criação
- [x] exibir erro e permitir nova tentativa quando falha a carga de memberships
- [x] ordenar o restaurante mais recente pelo timestamp da própria membership
- [x] ignorar resposta de criação de restaurante se a sessão mudar durante a chamada
- [ ] migrar persistência das telas do navegador para o Supabase
- [x] remover autenticação local e espelhamento de sessão inseguro
- [ ] criar integração de dados por domínio com validação multi-tenant

## Fase 3 — Persistência operacional

- [ ] migrar categorias e produtos para consultas Supabase autenticadas
- [ ] migrar mesas, comandas e pedidos com operações transacionais
- [ ] validar papéis e fluxo de funcionários por RPC seguro
- [x] separar o armazenamento local por usuário autenticado para evitar reutilização acidental entre contas
- [ ] migrar os dados operacionais locais para o Supabase sem perda e com plano de preservação
- [ ] adicionar testes ponta a ponta com usuário autenticado no projeto remoto
