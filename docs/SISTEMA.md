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
  - `src/assets/catalog_nike-01-hi.jpg`
  - `src/assets/catalog_nike-02-hi.jpg`
  - `src/assets/catalog_nike-03-hi.jpg`
  - `src/assets/catalog_nike-04-hi.jpg`
- As imagens originais têm aproximadamente 1.200 × 1.600 px e são usadas no destaque principal, no primeiro card de produto e na galeria da comunidade.
- As imagens ficam empacotadas pelo Vite em `dist/assets` durante o build; o site não depende de URLs privadas do Google Drive para renderizar essa seleção inicial.

Validação realizada com `npm run build` e prévia local em `http://127.0.0.1:4173/?catalog=hi-res`.

## Auditoria do catálogo do Google Drive — faixa 38 a 43

Em 05/10/2026 foram verificadas todas as pastas da pasta compartilhada do catálogo:

- `34 AO 39`: conjunto já publicado anteriormente, com 77 fotos locais.
- `38 AO 43`: 13 pastas de marca; as pastas `ADIDAS REPLICAS` e `NIKE REPICAS` possuem,
  respectivamente, 7 e 9 subpastas de modelos.
- O inventário da faixa 38–43 contém 337 mídias, sendo 181 fotos legíveis identificadas. A
  publicação mantém até seis imagens representativas por pasta/modelo, totalizando 140 arquivos
  JPG em `src/assets/catalog-drive/catalog-38-43`; os vídeos foram deliberadamente ignorados.
- As fotos com extensão HEIC foram verificadas pelo conteúdo. Quando eram JPEGs apenas com
  extensão HEIC, foram renomeadas para JPG; HEIC real deve ser convertido antes de ser usado
  em navegador.

Modelos/pastas incorporados à vitrine: Forum Low, ADI2000, Adidas Jellyfish, Adios Pro 5,
Adizero Evo, Adizero Pro 4, Campus 00s, Adidas Originals, Air Max Portal, Air Force,
Air Jordan 1, Air Max 95, Air Max TN, Alphafly, Court Vision, Dunk, Dunk Jumbo, Dunk Twist,
Nike Original, Asics, New Balance, Fila Original, Mizuno, Puma Original, Puma Replica,
Reserva Original e Vans. A vitrine mantém os modelos já cadastrados da primeira faixa e passa
a enriquecer a galeria dos modelos repetidos com as fotos da segunda faixa.

O agrupamento é feito em `src/lib/driveCatalog.js` por prefixos de pasta, usando
`import.meta.glob` para empacotar os arquivos automaticamente. Cada ficha continua abrindo
uma galeria própria, mostrando cores, grade 34–43 e o pedido por WhatsApp; preço e estoque
continuam condicionados ao cadastro/consulta no Supabase.

### Fluxo de exibição do catálogo

A vitrine inicia com oito produtos em destaque na seção `Mais desejados`, reduzindo a
densidade visual da primeira leitura. O botão `Ver catálogo completo` define o estado de
catálogo completo, remove o limite e renderiza todos os modelos disponíveis. Busca e filtros
por categoria continuam aplicados sobre o conjunto completo. Ao selecionar uma marca, o
estado também abre todos os modelos daquela marca. Essa regra está implementada em
`src/storefront/Storefront.jsx` e foi validada no site publicado com a grade passando de 8
para 30 modelos.

### Variação comercial para comparação

O layout original preto foi preservado no branch GitHub
`snapshot/black-layout-20261005`. A vitrine também possui uma alternativa visual ativada
por `?variant=panelas`, com cabeçalho comercial fixo, hero mais direto, cards claros,
grade de produtos com maior foco em preço e espaçamento de loja online. A variação reutiliza
os mesmos dados e regras do catálogo: filtros, busca, favoritos, galeria de fotos,
numerações, cores e encaminhamento do pedido pelo WhatsApp.

Prévia publicada: `https://vhimports.github.io/vhimports/?variant=panelas`.
Sem esse parâmetro, a URL principal continua exibindo a versão preta anterior.

### Campo de preço na seção Mais vendidos

Na variação `panelas`, os cards da seção `Mais vendidos` exibem o desconto calculado a
partir de `oldPrice` e `price`, o valor anterior riscado, o preço atual e uma condição
visual de parcelamento em até 12 vezes. A vitrine não cria preços fictícios: se o Supabase
não tiver preço definido, o card permanece como `Consulte o valor`. O cálculo e a marcação
estão em `src/storefront/Storefront.jsx`, com a apresentação em `src/storefront.css`.

## Supabase VH Imports — configuração inicial

Configuração aplicada no projeto Supabase da VH Imports em 25/09/2026:

- Project ref: `zbmxehzprydojjfdwupp`.
- Projeto em estado saudável e separado da operação Finesse.
- As nove migrations foram executadas em ordem, incluindo segurança, operações, cobranças, dashboard, conteúdo semanal, metas e catálogo de marcas/numerações.
- `supabase/seed.sql` aplicado com seis marcas, seis categorias, seis categorias financeiras e três contas financeiras padrão.
- Bucket privado `product-images` criado com suporte a JPEG, PNG e WebP e limite de 5 MiB.
- Site URL configurada para `https://vhimports.github.io/vhimports/`.
- Redirect URLs configuradas para o painel publicado e para os ambientes locais de desenvolvimento.
- O frontend local usa `.env.local`, arquivo ignorado pelo Git, com a URL e a chave pública do projeto. Nenhuma `service_role` é usada no navegador.

Pendência operacional: criar a primeira conta de administrador em Supabase Auth e provisioná-la como master após o e-mail do responsável ser definido. O `seed.sql` não cria usuários nem dados reais de clientes.

Validação pós-configuração: contagens confirmadas no banco (`marcas=6`, `categorias=6`, `categorias_financeiras=6`, `contas_financeiras=3`, `bucket_privado=1`) e 31 testes automatizados aprovados com `npm test`.
