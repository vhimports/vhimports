# Backend Supabase — VH Imports

O backend replica as regras transacionais do sistema Finesse e adiciona marcas e grade de numeração para tênis.

## Aplicação

1. Crie um projeto Supabase separado para a VH Imports.
2. Execute as migrations em ordem no SQL Editor ou pelo Supabase CLI.
3. Execute `supabase/seed.sql`.
4. Crie as contas master pelo fluxo de convite.
5. Preencha apenas `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_AUTH_REDIRECT_URL`.

Não copie o projeto do Finesse nem reutilize a URL de produção dele: isso misturaria dados e usuários.

## Operações obrigatórias

- `mark_order_sold`: valida e baixa estoque;
- `record_order_payment`: registra pagamento e entrada financeira;
- `record_installment_payment`: registra parcela e entrada financeira;
- `adjust_stock`: registra ajustes manuais com motivo;
- `record_expense` e `record_income`: registram financeiro;
- `create_manual_order`: cria pedido com chave idempotente;
- `edit_order_details` e `edit_installment_due_date`: corrigem dados sem apagar histórico.

## Imagens

O bucket `product-images` deve permanecer privado. A aplicação normaliza imagens para WebP com até 2400 px no maior lado e até 5 MiB antes do upload.

Nunca coloque a `service_role` no frontend, em `.env` commitado ou em documentação pública.
