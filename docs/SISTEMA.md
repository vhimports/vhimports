# Sistema VH Imports

## Objetivo

Replicar a base segura da Finesse para uma loja de tênis importados, adaptando a regra comercial da VH Imports: o catálogo público não controla estoque e as fotos dos produtos são assets fixos versionados no projeto.

## Perfis e acesso

- O acesso operacional é feito por contas Supabase Auth previamente autorizadas.
- Existem dois slots de usuário master, reservados no schema privado.
- O usuário precisa estar ativo, ter e-mail confirmado e sessão válida.
- O cadastro público não faz parte do sistema.
- A autorização final ocorre pelo RLS e pelas funções RPC; alterar apenas o perfil visual não concede acesso.

## Regra comercial atual

- A VH Imports não fará controle de estoque no catálogo.
- Não haverá baixa, reserva ou ajuste de estoque para publicar produtos na vitrine.
- As fotos futuras serão incorporadas como assets fixos no código e identificadas no banco por `image_key`.
- O master acessa o painel para informar preço de venda, preço promocional, ordem, destaque e publicação.
- Um produto só aparece na vitrine quando estiver ativo e tiver preço de venda maior que zero.
- Alterações de preço usam a RPC `update_vh_catalog_prices`, são idempotentes e entram na auditoria.
- A vitrine continua sem checkout; o contato é feito manualmente pelo WhatsApp.

## Fluxo de pedido legado

1. A operação seleciona ou cadastra o cliente.
2. Seleciona produtos, marca, categoria, numeração e quantidade.
3. O pedido começa como pendente.
4. Pagamentos entram por `record_order_payment`, com chave idempotente.
5. Parcelamentos geram acordo e parcelas.
6. O pedido pode avançar para vendido, enviado, concluído, cancelado ou devolvido.

Esse fluxo permanece versionado como legado da base Finesse e não é usado pela nova vitrine sem estoque da VH Imports.

## Catálogo fixo e preços

O catálogo é organizado por modelo, marca, categoria, foto fixa, preço de venda, preço promocional, destaque e ordem de exibição. A tabela `vh_catalogo_produtos` não possui quantidade, reserva, custo ou movimentação de estoque.

As marcas iniciais são Nike, Adidas, Asics, New Balance, Puma e Olympikus. O cadastro continua aberto para novas marcas.

As fotos atuais ficam em `src/assets/` e são associadas ao banco pela coluna `image_key`. Para adicionar uma nova foto, o arquivo deve ser versionado, incluído em `src/lib/vhCatalogAssets.js` e registrado por migration/seed. O painel não faz upload nem exclusão de fotos.

O bucket `product-images` e o modelo antigo de imagens continuam disponíveis para os módulos legados, mas não participam do catálogo fixo da VH Imports.

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

As migrations criam tabelas em português, enums, views, RLS, funções transacionais e logs de auditoria. No catálogo VH, a função sensível é a fonte única da atualização de preços e publicação; não há regra de estoque.

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
10. `20260926001000_vh_fixed_catalog.sql`
11. `supabase/seed.sql`

## Estado desta versão

O frontend contém a base operacional migrada da Finesse, o catálogo fixo de testes e a identidade da VH Imports. A conexão real depende de aplicar as migrations no projeto Supabase da VH Imports e preencher as variáveis públicas em `.env.local`.

## Vitrine pública — tema preto e fotos do catálogo

Atualização visual de 25/09/2026:

- A vitrine pública passou a usar o preto como tema principal, com superfícies escuras, texto claro e contraste alto para destacar os produtos.
- O efeito de tipografia em grafite foi removido. Os títulos e palavras de ênfase usam a família condensada `Anton`, sem a fonte dripping/graffiti.
- Quatro fotos reais da pasta compartilhada do catálogo foram incorporadas ao projeto como arquivos locais de alta resolução:
  - `src/assets/catalog_nike-01-hi.jpg`
  - `src/assets/catalog_nike-02-hi.jpg`
  - `src/assets/catalog_nike-03-hi.jpg`
  - `src/assets/catalog_nike-04-hi.jpg`
- As imagens originais têm aproximadamente 1.200 × 1.600 px e são usadas no destaque principal, no primeiro card de produto e na galeria da comunidade.
- As imagens ficam empacotadas pelo Vite em `dist/assets` durante o build; o site não depende de URLs privadas do Google Drive para renderizar essa seleção inicial.
- O preço e o estado de publicação não ficam duplicados no código: o painel grava esses dados em `vh_catalogo_produtos`, e a vitrine consulta a Edge Function `public-catalog`.

Validação realizada com `npm run build` e prévia local em `http://127.0.0.1:4173/?catalog=hi-res`.
