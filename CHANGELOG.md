# Changelog

## [Unreleased]

### Segurança e manutenção

- removido o login local que persistia senhas em texto puro
- sessão visual agora é derivada do Supabase Auth e reage a alterações da sessão
- dados legados de usuários e a chave de sessão antiga são removidos ao abrir o app
- adicionados Vitest e testes para autenticação, limpeza do armazenamento legado e preços em centavos
- removidas dependências de teste ainda não usadas
- `.env.example` passou a usar placeholders; `.env*` é ignorado pelo Git, exceto o arquivo de exemplo
- associação do usuário com restaurante passou a ser carregada de `memberships` com escopo RLS
- o painel usa o UUID retornado pelo RPC ao criar o restaurante
- falha ao carregar memberships agora impede cadastro enganoso e oferece nova tentativa
- memberships são ordenadas pelo próprio `created_at`, evitando ordenação ambígua da relação
- dados operacionais locais são isolados por usuário autenticado; dados legados são sanitizados no escopo guest
- respostas de criação de restaurante são descartadas se a sessão mudar antes do RPC terminar
- migration 004 bloqueia escritas diretas em memberships e adiciona FKs compostas entre registros do mesmo restaurante
- PGlite adicionado somente para testes locais das migrations e regras de segurança
- testes SQL verificam isolamento de leitura, bloqueio de elevação por escrita direta, onboarding controlado e integridade produto/categoria

## [0.1.0] - 2026-11-04

### Adicionado

- diagnóstico inicial do projeto
- roadmap técnico do MesaFlow
- documentação de arquitetura, banco, segurança e deployment
- migração inicial do banco (`001_initial_schema.sql`)
- migração de segurança e RLS base (`002_security_baseline.sql`)
- validação de ambiente Supabase no frontend
- painel de diagnóstico visual do projeto

### Ajustado

- `src/App.tsx` agora exibe status do projeto e preparação operacional
- `src/lib/supabase.ts` agora valida URL e anon key do ambiente com melhor feedback

### Pendentes

- memberships reais e seleção/carregamento de restaurante
- gestão de restaurantes e perfis
- painéis de administração reais
- pedidos e fluxos de cozinha
- QR Code e cardápio público
- notificações, PWA e Capacitor
