# Backend Supabase — VH Imports

O backend replica a base segura do sistema Finesse e adapta o catálogo da VH Imports para trabalhar com fotos fixas e preços administráveis, sem controle de estoque na vitrine.

## Aplicação

1. Crie um projeto Supabase separado para a VH Imports.
2. Execute as migrations em ordem no SQL Editor ou pelo Supabase CLI.
3. Execute `supabase/seed.sql`.
4. Crie as contas master pelo fluxo de convite.
5. Preencha apenas `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_AUTH_REDIRECT_URL`.

A migration `20260926001000_vh_fixed_catalog.sql` cria `vh_catalogo_produtos`. Ela não cria estoque: cada registro aponta para uma foto fixa por `image_key`, e o master altera preço, promoção, destaque, ordem e publicação pela RPC `update_vh_catalog_prices`.

Não copie o projeto do Finesse nem reutilize a URL de produção dele: isso misturaria dados e usuários.

## Operações legadas da base Finesse

As operações abaixo permanecem versionadas para os módulos legados de pedidos e financeiro. O catálogo fixo atual da VH Imports não chama nenhuma operação de estoque.

- `mark_order_sold`: valida e baixa estoque;
- `record_order_payment`: registra pagamento e entrada financeira;
- `record_installment_payment`: registra parcela e entrada financeira;
- `adjust_stock`: registra ajustes manuais com motivo;
- `record_expense` e `record_income`: registram financeiro;
- `create_manual_order`: cria pedido com chave idempotente;
- `edit_order_details` e `edit_installment_due_date`: corrigem dados sem apagar histórico.
- `update_vh_catalog_prices`: altera os valores e o estado público dos produtos fixos com auditoria e idempotência.

## Imagens

As imagens do catálogo VH Imports ficam fixas em `src/assets/` e são mapeadas em `src/lib/vhCatalogAssets.js`. O painel apenas exibe a foto e altera os valores; não existe upload de imagem para esse catálogo.

O bucket `product-images` deve permanecer privado porque ainda atende aos módulos legados da base Finesse. Ele não é necessário para publicar o catálogo fixo.

Nunca coloque a `service_role` no frontend, em `.env` commitado ou em documentação pública.
