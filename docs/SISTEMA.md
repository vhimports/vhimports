# Sistema VH Imports

## Objetivo

Replicar o fluxo operacional da Finesse para uma loja de tênis importados, preservando as regras de autenticação, estoque, pedidos, pagamentos, cobranças, financeiro, conteúdo e auditoria.

## Perfis e acesso

- O acesso operacional é feito por contas Supabase Auth previamente autorizadas.
- Existem dois slots de usuário master, reservados no schema privado.
- O usuário precisa estar ativo, ter e-mail confirmado e sessão válida.
- O cadastro público não faz parte do sistema.
- A autorização final ocorre pelo RLS e pelas funções RPC; alterar apenas o perfil visual não concede acesso.

## Fluxo de pedido

1. A operação seleciona ou cadastra o cliente.
2. Seleciona produtos, marca, categoria, numeração e quantidade.
3. O pedido começa como pendente.
4. Ao confirmar a venda, `mark_order_sold` valida o estoque e registra as saídas.
5. Pagamentos entram por `record_order_payment`, com chave idempotente.
6. Parcelamentos geram acordo e parcelas.
7. O pedido pode avançar para vendido, enviado, concluído, cancelado ou devolvido.

Não existe baixa direta de estoque pela interface; ajustes usam `adjust_stock`.

## Catálogo e estoque

O catálogo é organizado por marca, categoria, modelo/SKU, grade de numeração, preço de custo, preço de venda, preço promocional, imagens privadas e estoque por numeração.

As marcas iniciais são Nike, Adidas, Asics, New Balance, Puma e Olympikus. O cadastro continua aberto para novas marcas.

O bucket `product-images` é privado. O frontend utiliza URLs assinadas e nunca recebe a `service_role`.

## Financeiro e cobranças

- Entradas e despesas são registradas por RPC.
- Pagamentos parciais e totais atualizam o pedido ou a parcela.
- Acordos de cobrança possuem parcelas, vencimento e contato de cobrança.
- O financeiro mantém conta, categoria, valor, data, status e auditoria.
- Não existe abertura/fechamento de caixa, caixa por turno, leitor de código ou fluxo de balcão.

## Conteúdo e relacionamento

- O calendário permite sugerir, aprovar, agendar, publicar e marcar falha.
- Aniversários e reativação geram listas de contato.
- As mensagens ficam prontas para copiar ou abrir no WhatsApp.
- A integração de envio automático não é presumida; o sistema organiza o conteúdo e registra o resultado.

## Banco e segurança

As migrations criam tabelas em português, enums, views, RLS, funções transacionais e logs de auditoria. As funções sensíveis são a fonte única das regras de estoque, pagamentos e financeiro.

Aplicar, em ordem:

1. `20260918000100_initial_backend.sql`
2. `20260918000200_security.sql`
3. `20260918000300_mvp_operations.sql`
4. `20260919000400_remove_mfa_requirement.sql`
5. `20260919000500_portuguese_table_names.sql`
6. `20260921000600_linked_orders_and_dashboard.sql`
7. `20260921000700_weekly_content_scheduler.sql`
8. `20260921000800_sales_goals.sql`
9. `20260925000900_vh_imports_catalog.sql`
10. `supabase/seed.sql`

## Estado desta versão

O frontend contém a estrutura operacional migrada da Finesse e a identidade da VH Imports. A conexão real depende de criar o projeto Supabase da VH Imports, aplicar as migrations e preencher as variáveis públicas em `.env.local`.

## Vitrine pública — tema preto e fotos do catálogo

Atualização visual de 25/09/2026:

- A vitrine pública passou a usar o preto como tema principal, com superfícies escuras, texto claro e contraste alto para destacar os produtos.
- O efeito de tipografia em grafite foi removido. Os títulos e palavras de ênfase usam a família condensada `Anton`, sem a fonte dripping/graffiti.
- Quatro fotos reais da pasta compartilhada do catálogo foram incorporadas ao projeto como arquivos locais de alta resolução:
  - `src/assets/catalog/nike-01-hi.jpg`
  - `src/assets/catalog/nike-02-hi.jpg`
  - `src/assets/catalog/nike-03-hi.jpg`
  - `src/assets/catalog/nike-04-hi.jpg`
- As imagens originais têm aproximadamente 1.200 × 1.600 px e são usadas no destaque principal, no primeiro card de produto e na galeria da comunidade.
- As imagens ficam empacotadas pelo Vite em `dist/assets` durante o build; o site não depende de URLs privadas do Google Drive para renderizar essa seleção inicial.

Validação realizada com `npm run build` e prévia local em `http://127.0.0.1:4173/?catalog=hi-res`.
