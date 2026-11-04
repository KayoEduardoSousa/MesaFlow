# MesaFlow — Arquitetura

## Visão geral

MesaFlow é um SaaS multi-tenant para gestão de restaurantes, com domínio principal em mesas, comandas, pedidos, produtos e acompanhamento de cozinha. A arquitetura atual está organizada em:

- Frontend React + TypeScript + Vite
- Cliente Supabase para autenticação, banco e realtime
- Banco PostgreSQL com RLS e migrações versionadas
- Estrutura multi-tenant por `restaurant_id`

## Frontend

- `src/App.tsx`: painel administrativo inicial e estado de demonstração
- `src/styles.css`: identidade visual institucional
- `src/lib/supabase.ts`: cliente e validação do ambiente

## Banco

A migration `001_initial_schema.sql` define entidades centrais para restaurantes, perfis, memberships, mesas, categorias, produtos, opções, tabs, pedidos, eventos e notificações. A migration `002_security_baseline.sql` habilita RLS e adiciona políticas iniciais. Elas ainda não equivalem a uma autorização pronta para produção; faltam:

- revisão contra escalada de privilégios nas memberships
- integridade composta entre restaurante e registros relacionados
- controle de acesso por perfil e permissões
- operações transacionais e auditáveis para pedidos e comandas
- eventos e sincronização real (Realtime)

## Segurança

O cliente web usa apenas URL e chave anon via variáveis de ambiente; nenhuma `service_role` deve estar no frontend. As migrations habilitam RLS, mas as operações de domínio ainda são em grande parte locais no navegador. O estado real de aplicação das migrations no projeto Supabase ainda precisa ser confirmado. Consulte `SECURITY.md` antes de considerar o backend pronto para produção.

## Roadmap técnico

1. Auditoria e diagnóstico
2. Preparação da arquitetura e padrões de dados
3. Migração de segurança e RLS
4. Autenticação e perfis
5. Área administrativa e navegação
6. Produtos, categorias e adicionais
7. Mesas e QR Code
8. Comandas e pedidos
9. Aplicativo do garçom
10. Painel da cozinha
11. Cardápio digital
12. Notificações e impressão
13. PWA e Capacitor
14. Testes e implantação
