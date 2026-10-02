# VH Imports — Documento de continuidade

## 1. Objetivo do projeto

Criar um sistema online para a loja de tênis **VH Imports**, inspirado em:

- **Finesse**: fluxo de catálogo, operação da loja, pedidos e organização por produtos.
- **assistrend.online**: referência geral de apresentação e navegação.
- **luxstoree.com.br**: referência de efeitos visuais, transições e interação.

Instagram da loja: [@vhimports.62](https://www.instagram.com/vhimports.62/)

## 2. Catálogo analisado

O catálogo está armazenado nesta pasta do Google Drive:

[Catálogo VH Imports](https://drive.google.com/drive/folders/18tX0c5TRoeFnzL5SyFW3eaYMb77l3und)

A estrutura do Drive é organizada por marcas, categorias e alguns grupos especiais. Foram identificadas pastas como:

- Nike
- Adidas
- Asics
- New Balance
- Mizuno
- Puma
- Vans
- All Star
- Diesel
- Dolce & Gabbana
- EA7 Emporio Armani
- Gucci
- Hugo Boss
- Louis Vuitton
- McQueen
- Oakley
- Ous
- Reserva
- Tênis On
- Otter
- Vert
- Yeezy
- Chinelo Slide
- Sapato Social
- Por encomenda

Também existem subcategorias por modelo. Exemplos:

- Nike: Air Force, Jordan, Jordan 4, Nike Dn, Nike Dunk, Nike Meia e Nike TN.
- Adidas: Adi2000, Adi2000x, Adidas Boss, Campus, Fórum, Samba, Superstar e Bad Bunny.
- New Balance: 9060, 530, 550 e 1906.
- Asics: Gel-Kayano, Gel-Nimbus e Novablast.

Há categorias com numeração explícita, como “34 ao 43” e “38 ao 43”. A pasta “Por encomenda” deve funcionar como um status separado, com prazo e disponibilidade próprios.

## 3. Fotos do catálogo

As imagens analisadas possuem formatos e estilos variados:

- JPG e HEIC;
- fotos de tênis na mão;
- fotos em prateleiras e dentro da loja;
- fotos com fundo real;
- alguns vídeos;
- arquivos com nomes de celular, como `IMG_1194.HEIC` e `PHOTO-2024...`.

Existem imagens leves, por exemplo 159 KB em 1200×1600, e imagens maiores, como 1,4 MB em 3840×2160 e 1,7 MB em 4032×3024.

Próxima etapa recomendada: converter as imagens para WebP, gerar miniaturas e associar manualmente cada imagem a marca, modelo, categoria e numeração.

## 4. Site atual

Site publicado:

[VH Imports — Site publicado](https://vh-imports.gusttavogomes09.chatgpt.site)

Prévia local:

[Prévia local](http://127.0.0.1:4173/)

Arquivo principal do site:

- `dist/index.html`

Configuração de hospedagem:

- `.openai/hosting.json`
- Site estático publicado pelo Sites.

## 5. Funcionalidades já implementadas

- Página inicial da VH Imports.
- Hero com chamada para o catálogo.
- Barra promocional animada.
- Cabeçalho fixo com efeito de blur ao rolar.
- Efeito de parallax no hero.
- Animações de entrada das seções.
- Efeito de hover nos produtos.
- Catálogo de demonstração.
- Filtro por marca e categoria.
- Busca por produto ou marca.
- Ordenação por preço.
- Modal de detalhes do produto.
- Seleção de numeração.
- Favoritos usando armazenamento local do navegador.
- Carrinho usando armazenamento local do navegador.
- Área demonstrativa da loja/painel.
- Botão de contato via WhatsApp.
- Links para Instagram e e-mail.
- Layout responsivo para celular e desktop.

## 6. Estrutura atual de marcas e categorias

O site mostra inicialmente algumas marcas em destaque e permite expandir as demais em “Ver todas as marcas”. Os filtros compactos permitem selecionar:

- Marca;
- Categoria;
- Limpar filtros;
- Abrir o catálogo completo.

Os cards de produtos exibem uma identificação visual da marca e os cards de marcas exibem a logo/wordmark como elemento principal.

## 7. Decisões de UX/UI

O layout foi ajustado para evitar excesso de informação:

- Mostrar somente uma seleção inicial de marcas.
- Ocultar marcas adicionais até o usuário solicitar.
- Usar controles de seleção em vez de dezenas de botões simultâneos.
- Mostrar apenas 8 produtos inicialmente na seção por marca.
- Direcionar o usuário para o catálogo completo por botão.
- Usar mais espaçamento e hierarquia visual entre seções.
- Manter as fotos nos cards de produtos.
- Usar a logo/wordmark no lugar da foto nos cards de marcas.

## 8. Dados de demonstração atuais

O protótipo possui 16 produtos de demonstração, principalmente das marcas:

- Nike;
- Adidas;
- Asics;
- New Balance;
- Mizuno;
- Puma;
- Vans.

Esses produtos ainda devem ser substituídos pelos produtos reais do catálogo do Google Drive. Preços e descrições atuais são apenas conteúdo de demonstração.

## 9. Próximos passos recomendados

### Prioridade 1 — Catálogo real

1. Importar as imagens do Google Drive.
2. Converter JPG/HEIC para WebP.
3. Criar miniaturas para o catálogo.
4. Cadastrar o nome real de cada modelo.
5. Associar imagens por produto.
6. Cadastrar numeração e estoque por tamanho.
7. Separar produtos em estoque de produtos “Por encomenda”.

### Prioridade 2 — Sistema da loja

1. Criar cadastro real de produtos.
2. Criar painel de estoque.
3. Criar controle por tamanho.
4. Criar gestão de pedidos.
5. Criar status de pagamento e envio.
6. Integrar atendimento e fechamento de pedidos pelo WhatsApp.

### Prioridade 3 — Backend

Avaliar Supabase para:

- banco de produtos;
- usuários e administradores;
- pedidos;
- estoque;
- favoritos sincronizados;
- armazenamento das imagens.

As imagens devem ser otimizadas para WebP e organizadas por pastas ou identificadores de produto. O plano gratuito pode atender o protótipo e um volume inicial moderado, mas o consumo deve ser monitorado conforme as imagens e acessos aumentarem.

## 10. Observações importantes para o próximo chat

- Não recriar o site do zero sem antes verificar `dist/index.html`.
- Preservar o endereço publicado e a configuração em `.openai/hosting.json`.
- As imagens atuais dos produtos são referências visuais; ainda não são o catálogo real completo.
- Os cards de marcas já usam logos/wordmarks no lugar das fotos.
- O objetivo imediato é importar e catalogar as fotos reais do Google Drive.
- Não expor tokens, credenciais ou informações privadas de publicação.
