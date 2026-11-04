# MesaFlow — Banco de dados

## Estrutura atual

A migração `001_initial_schema.sql` cria a base do sistema com as seguintes entidades:

- `restaurants`
- `profiles`
- `memberships`
- `dining_tables`
- `categories`
- `products`
- `product_options`
- `product_option_items`
- `tabs`
- `orders`
- `order_items`
- `order_events`
- `notifications`

## Observações

A estrutura atende às entidades principais do domínio e já organiza o modelo multi-tenant com `restaurant_id` em quase todas as tabelas. Também há suporte a enums para funções e status de pedidos.

## Melhorias necessárias

- criar RLS em todas as tabelas
- criar funções para verificação de associação do usuário ao restaurante
- restringir acesso cruzado entre restaurantes
- revisar índices e filtros para consultas de dashboard
- implementar `updated_at` em entidades que ainda não o possuem
- criar trigger para atualização de timestamps
- separar eventos de auditoria por ação e actor

## Próxima migração recomendada

A migração `002_security_baseline.sql` foi criada para iniciar esse reforço de segurança, incluindo:

- habilitação de RLS
- função `public.is_restaurant_member()`
- função `public.current_restaurant_id()`
- política básica de leitura para restaurantes e memberships
- políticas de isolamento por restaurante

## Regras de integridade

- cada usuário deve estar associado a um restaurante via `memberships`
- uma tabela deve pertencer ao mesmo restaurante da comanda e do pedido
- todos os itens e eventos devem ser vinculados ao mesmo `restaurant_id`
- `order_items` deve preservar snapshot de preço e nome do produto
- um pedido não pode ser apagado silenciosamente após envio à cozinha
