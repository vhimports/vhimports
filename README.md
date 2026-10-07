# VH Imports

Sistema interno da VH Imports, loja de tênis importados, construído com o mesmo fluxo operacional do sistema Finesse.

## Módulos implementados

- autenticação por e-mail e senha com dois usuários master;
- dashboard com vendas, estoque, cobranças e metas;
- pedidos manuais, status, pagamentos e parcelamentos;
- clientes, aniversários e campanhas de reativação;
- produtos, marcas, categorias, imagens WebP e estoque;
- lucro estimado e financeiro contínuo;
- calendário de conteúdo para Instagram;
- auditoria e regras transacionais no Supabase;
- vitrine pública separada do painel interno.

## Rodando localmente

1. Instale Node.js 20+.
2. Execute `npm install`.
3. Copie `.env.example` para `.env.local`.
4. Informe somente a URL e a chave publicável do projeto VH Imports no Supabase.
5. Execute `npm run dev`.

Nunca coloque `service_role`, chaves secretas ou dados reais no frontend ou no GitHub.

## Banco de dados

As migrations em `supabase/migrations` devem ser aplicadas em ordem no projeto Supabase da VH Imports. Depois execute `supabase/seed.sql`.

A migration `20260925000900_vh_imports_catalog.sql` adiciona marcas, categorias de tênis e grade de numerações sem remover as regras transacionais da Finesse.

### Projeto configurado

- Project ref: `zbmxehzprydojjfdwupp`.
- Site URL: `https://vhimports.github.io/vhimports/`.
- Redirect do painel: `https://vhimports.github.io/vhimports/painel.html`.
- Bucket privado: `product-images`.
- O ambiente local usa `.env.local`, que não é versionado.
- A chave `service_role` nunca deve ser colocada no frontend, no GitHub ou nesta documentação.

Após a configuração, o banco foi validado com seis marcas, seis categorias, seis categorias financeiras, três contas financeiras e 31 testes automatizados aprovados. A criação dos dois usuários master permanece dependente dos e-mails dos administradores.

## Publicação

O `index.html` compilado é copiado para a raiz pelo build, permitindo publicar a branch `main` pela raiz no GitHub Pages.

## Catálogo fotográfico e fluxo de pedido

As fotos recebidas no Google Drive foram identificadas por marca e modelo e versionadas em
`src/assets/catalog-drive`. Os vídeos foram ignorados. A inspeção cobre as pastas `34 AO 39`
e `38 AO 43`; a segunda faixa possui 13 pastas de marca, subpastas específicas para 7 modelos
Adidas e 9 modelos Nike, além de 337 fotos e vídeos no total. A inspeção encontrou 181 fotos
legíveis; para preservar desempenho, o repositório publica 140 fotos normalizadas da faixa 38–43,
com até seis imagens representativas por pasta/modelo. Os arquivos HEIC que eram JPEG foram
normalizados para `.jpg`.

O catálogo da vitrine agora inclui, além dos modelos anteriores, Forum Low, ADI2000, Jellyfish,
Adios Pro 5, Adizero Pro 4, Campus 00s, Air Max Portal, Air Max 95, Air Max TN, Alphafly,
Court Vision, Dunk Jumbo, Dunk Twist, Fila, Mizuno, Reserva e Vans. Os assets adicionais ficam
em `src/assets/catalog-drive/catalog-38-43` e entram no build via `import.meta.glob`.

Na vitrine, cada card abre uma ficha de produto em vez de enviar diretamente ao WhatsApp.
A ficha apresenta as fotos do mesmo modelo, variações de cor, numerações de 34 a 43 e o
valor cadastrado no Supabase. Quando o preço ainda não foi definido, a tela exibe
`Consulte o valor` e mantém o pedido condicionado à confirmação do estoque. O botão de
WhatsApp inclui o modelo, a numeração escolhida e o preço/aviso correspondente.

O catálogo local funciona como fallback visual enquanto a função pública do Supabase é
consultada. O administrador deve cadastrar preço, estoque e disponibilidade definitivos
no painel antes de divulgar um modelo como disponível.

Na seção `Mais desejados`, a vitrine inicia com oito destaques para preservar a leitura da
página. O botão `Ver catálogo completo` remove esse limite e exibe todos os modelos
publicados, mantendo busca e filtros por categoria ativos. A seleção de uma marca também
abre a coleção completa daquela marca.

Na variação comercial, a seção é apresentada como `Mais vendidos`. Quando o produto possui
preço atual e preço anterior, o card calcula e exibe o desconto em verde, mantém o preço
anterior riscado e mostra a condição de parcelamento em até 12 vezes. Esses valores são
calculados a partir dos dados reais cadastrados no Supabase; produtos sem preço continuam
exibindo `Consulte o valor`.

### Prévia alternativa de layout

A versão preta atual foi preservada no branch `snapshot/black-layout-20261005`.
Para comparar uma proposta mais comercial, inspirada na organização de vitrines de
sneaker shops como a Panela Sneakers, abra:

`https://vhimports.github.io/vhimports/?variant=panelas`

Essa variação mantém o mesmo catálogo, filtros, favoritos, ficha com galeria,
numerações, cores e pedido por WhatsApp. O endereço principal, sem o parâmetro
`variant=panelas`, continua usando o tema preto salvo anteriormente.

### Atualização visual: tema preto e promoções

A variação `?variant=panelas` recebeu um acabamento preto para a loja, com formas
circulares abstratas no fundo, contraste alto e a logo da VH Imports aplicada no
destaque principal. Também foi adicionada a seção `Itens em promoção`, com modelos
variados do catálogo e descontos/parcelamentos demonstrativos para validar o layout.

Os cards de promoção abrem a mesma ficha de produto do catálogo, incluindo galeria,
cores, numerações e pedido pelo WhatsApp. Enquanto não houver preço real no Supabase,
eles exibem `Preço demonstrativo` e o WhatsApp informa que o valor precisa ser
confirmado; substitua esses valores cadastrando `price` e `oldPrice` no catálogo.

## Documentação

Consulte [docs/SISTEMA.md](docs/SISTEMA.md) antes de alterar regras do produto ou do banco.

### Marcas na vitrine

Na seção `Escolha sua marca preferida`, cada card agora usa a logo da marca no destaque
central, com fallback textual para preservar a leitura caso uma logo externa não carregue.
As logos são exibidas em alto contraste no tema preto e continuam abrindo a coleção
completa da marca ao clicar no card.

### Hero com produto real e composição responsiva

O destaque inicial da variação comercial usa fotos reais do catálogo local: o Adidas
Adizero Evo como produto principal e o Adidas Campus como detalhe secundário. Etiqueta
de curadoria, pontos de variação e círculos de movimento adicionam ritmo visual sem
competir com a fotografia.

Em telas pequenas, o selo circular da VH é ocultado para preservar a hierarquia do
produto e evitar o logotipo gigante no fundo. A composição mantém apenas elementos
auxiliares leves, com contraste adaptado ao tema preto e controles de navegação claros.

### Catálogo unificado e direção off-white

Na revisão de 07/10/2026, os rótulos `Original`, `Replica` e `Réplica` deixaram de criar
marcas diferentes. O frontend normaliza esses sufixos e agrupa os produtos pela marca
principal — por exemplo, Puma Original e Puma Replica aparecem juntos em Puma. O mesmo
tratamento vale para Nike Original, Fila Original e Reserva Original, sem alterar os
arquivos de fotos ou os identificadores dos produtos.

As pastas `34 AO 39` e `38 AO 43` do Drive compartilhado foram verificadas. Elas contêm
Adidas, Asics, Fila, New Balance, Nike, Puma, Mizuno, Reserva e Vans, além dos modelos
organizados por faixa de numeração. Não foram encontrados arquivos ou pastas identificáveis
como Prada, Louis Vuitton, Golden Goose, Hugo Boss, Armani ou Mont Blanc; por isso essas
marcas não foram inventadas na vitrine e ficam pendentes de fotos reais no Drive.

A variação `?variant=panelas` agora usa uma paleta off-white editorial: fundo marfim,
cartões claros, preto suave para ações e verde acinzentado como acento. A hierarquia,
galeria, filtros, modal de produto e pedido via WhatsApp permanecem iguais, com contraste
adaptado para desktop e celular.
