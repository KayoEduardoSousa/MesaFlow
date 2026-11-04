# MesaFlow — Segurança e RLS

## Diagnóstico atual

O projeto contém as migrations `001_initial_schema.sql`, `002_security_baseline.sql` e `003_auth_restaurant_setup.sql`. A migration 002 habilita RLS nas tabelas principais e cria políticas iniciais por associação ao restaurante. A migration 003 cria o RPC de provisionamento do proprietário. A existência dos arquivos não comprova que foram aplicados ao Supabase; o estado remoto ainda precisa ser verificado pelo histórico de migrations.

O endpoint Supabase configurado respondeu ao health check de Auth (HTTP 200). Isso comprova conectividade do serviço, não comprova configuração de usuários, schema, migrations aplicadas nem autorização correta.

## Riscos atuais

- O `src/App.tsx` ainda mantém cadastros, produtos, mesas, pedidos e funcionários em `localStorage`; essas telas não são persistidas no Supabase.
- O modo de autenticação local foi removido; o login exige Supabase Auth. A carga do app remove registros de credenciais e a sessão visual legados do armazenamento local.
- A sessão atual é restaurada do Supabase Auth; autorização de cada operação continua dependendo de RLS no banco, não do estado visual do frontend.
- A política de update em `memberships` permite a administradores atualizarem associações, e a regra `is_restaurant_admin` aceita owner/admin. Revisar cuidadosamente a possibilidade de elevar o próprio papel e impedir alteração de `user_id`/papel sem operação privilegiada.
- Referências entre tabelas não impõem consistentemente que os registros pai e filho tenham o mesmo `restaurant_id` (por exemplo, produto/categoria, mesa/comanda e comanda/pedido).
- As políticas de pedidos e itens permitem escritas diretas pelo cliente; mudanças de status e itens deveriam ser validadas por operações de banco com transações e regras por papel.
- O fluxo de funcionários cria apenas registros locais; não cria usuários de Auth nem memberships reais.

## Diretrizes de implementação

- usar `auth.uid()` como base da identidade do usuário
- verificar associação do usuário no restaurante com funções seguras
- usar `WITH CHECK` e `USING` nas políticas
- bloquear exclusão em tabelas de histórico ou pedidos
- nunca confiar no frontend para autorização
- manter a `service_role` apenas no backend

## Base a ser aplicada

A migração `002_security_baseline.sql` estabelece a primeira camada de segurança e a estrutura mínima para o isolamento multi-tenant, com foco em:

- cadastro no restaurante
- leitura restrita por restaurante
- política de atualização por `membership_role`
- uso de funções para checar associação

## Testes de segurança esperados

- usuário de restaurante A não acessa dados de restaurante B
- funcionário sem papel de admin não pode gerenciar configurações
- pedido de cozinha não expõe dados de outras comandas
- operação modificada via frontend não altera `restaurant_id`
- operações de exclusão são bloqueadas quando a linha não pertence ao restaurante do usuário
