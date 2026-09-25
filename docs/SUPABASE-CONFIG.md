# VH Imports — configuração do banco Supabase

Data da configuração: 25/09/2026

## Projeto

- Project ref: zbmxehzprydojjfdwupp
- URL pública: https://zbmxehzprydojjfdwupp.supabase.co
- Organização: vhimportsst
- O projeto está separado da operação Finesse.

## Migrations aplicadas

As migrations foram executadas em ordem no SQL Editor do projeto:

1. 20260918000100_initial_backend.sql
2. 20260918000200_security.sql
3. 20260918000300_mvp_operations.sql
4. 20260919000400_remove_mfa_requirement.sql
5. 20260919000500_portuguese_table_names.sql
6. 20260921000600_linked_orders_and_dashboard.sql
7. 20260921000700_weekly_content_scheduler.sql
8. 20260921000800_sales_goals.sql
9. 20260925000900_vh_imports_catalog.sql
10. supabase/seed.sql

## Dados iniciais

O seed criou ou atualizou seis marcas, seis categorias de tênis, seis categorias financeiras e três contas financeiras padrão. Não foram criados clientes, pedidos ou dados reais.

## Storage

O bucket product-images foi criado como privado, aceitando JPEG, PNG e WebP até 5 MiB. O acesso depende de usuário autenticado e ativo; a service_role não é usada no navegador.

## Auth e URLs

- Site URL: https://vhimports.github.io/vhimports/
- Redirect publicado: https://vhimports.github.io/vhimports/painel.html
- Redirect local: http://localhost:3000/painel.html
- Redirect local alternativo: http://127.0.0.1:4173/painel.html

O seed não cria usuários. O painel exige dois usuários master previamente convidados no Supabase Authentication e provisionados pela operação supabase/operations/provision-masters.sql. Os e-mails reais dos administradores não devem ser commitados.

## Ambiente local

Copie .env.example para .env.local e preencha VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e VITE_AUTH_REDIRECT_URL. O arquivo .env.local está ignorado pelo Git. Nunca coloque service_role ou outra chave secreta no frontend.

## Segurança e regras

O banco usa RLS, perfis ativos, funções RPC transacionais e auditoria. Estoque, venda, pagamento, recebimento, financeiro e alterações sensíveis devem passar pelas regras do banco.

## Validação

Após a configuração, foram confirmadas as contagens marcas=6, categorias=6, categorias_financeiras=6, contas_financeiras=3 e bucket_privado=1. Os 31 testes automatizados do projeto passaram com npm test.

## Próximo passo

Definir os dois e-mails de administração, criar os convites no Authentication e provisionar os slots master. Depois, gerar o build com npm run build e publicar a versão conectada ao Supabase.
