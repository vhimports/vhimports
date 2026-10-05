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
Adidas e 9 modelos Nike, além de 337 fotos e vídeos no total. Para preservar desempenho, o
repositório publica 181 fotos normalizadas da faixa 38–43, com até seis imagens representativas
por pasta/modelo. Os arquivos HEIC que eram JPEG foram normalizados para `.jpg`.

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

## Documentação

Consulte [docs/SISTEMA.md](docs/SISTEMA.md) antes de alterar regras do produto ou do banco.
