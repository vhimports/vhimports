# Sistema VH Imports

## Objetivo

Criar um sistema de operação e vendas para a VH Imports, mantendo a apresentação da vitrine e evoluindo para um painel administrativo semelhante ao fluxo de sistemas de loja como a Finesse.

## Perfis previstos

### Cliente

- navegar por marcas;
- navegar por categorias e modelos;
- consultar fotos, preço e numeração;
- favoritar produtos;
- adicionar itens ao carrinho;
- solicitar atendimento pelo WhatsApp;
- acompanhar pedidos em uma etapa posterior.

### Operação da loja

- acessar o painel por login;
- cadastrar e editar produtos;
- organizar marcas e categorias;
- controlar estoque por numeração;
- diferenciar estoque imediato de produto por encomenda;
- acompanhar pedidos;
- atualizar pagamento, separação, envio e conclusão.

## Regras de negócio iniciais

### Produto

Cada produto deverá possuir:

- marca;
- categoria;
- nome do modelo;
- descrição;
- preço atual;
- preço anterior opcional;
- imagens da galeria;
- vídeo opcional;
- numerações disponíveis;
- quantidade por numeração;
- status de disponibilidade;
- indicação de destaque, novidade ou oferta.

### Disponibilidade

Estados previstos:

- `Em estoque`: produto disponível para separação imediata.
- `Por encomenda`: produto depende de compra ou chegada futura; deve mostrar prazo específico.
- `Esgotado`: produto permanece no catálogo, mas não pode ser adicionado ao carrinho.

### Pedido

Fluxo inicial previsto:

1. Carrinho criado pelo cliente.
2. Seleção de tamanho.
3. Conferência de disponibilidade.
4. Solicitação ou checkout.
5. Pagamento pendente ou aprovado.
6. Pedido em separação.
7. Pedido enviado.
8. Pedido concluído ou cancelado.

Status sugeridos:

- `Aguardando pagamento`;
- `Pago`;
- `Separando`;
- `Enviado`;
- `Concluído`;
- `Cancelado`.

### Estoque por tamanho

O estoque não deve ser controlado apenas no nível do produto. Cada variação de tamanho deverá possuir quantidade própria. Um produto só pode ser vendido quando a numeração selecionada estiver disponível.

## Estrutura do catálogo

O catálogo real foi organizado no Google Drive por marcas e linhas. O sistema deverá preservar essa lógica:

- marca como agrupador principal;
- categoria ou modelo como segundo nível;
- produto e variações como terceiro nível;
- imagens e vídeos associados ao produto;
- numeração e estoque associados à variação.

Marcas e coleções identificadas incluem Nike, Adidas, Asics, New Balance, Mizuno, Puma, Vans, All Star, Diesel, Dolce & Gabbana, EA7 Emporio Armani, Gucci, Hugo Boss, Louis Vuitton, McQueen, Oakley, Ous, Reserva, Tênis On, Otter, Vert, Yeezy, Chinelo Slide, Sapato Social e Por encomenda.

## Login atual

A tela de login já foi criada no protótipo para visualização do fluxo.

- Não há autenticação real.
- Não existem credenciais cadastradas.
- O formulário aceita qualquer e-mail e senha preenchidos.
- Após o envio, o usuário entra no painel demonstrativo.
- A autenticação real deverá ser implementada antes do uso em produção.

## Painel atual

O painel demonstrativo contém:

- pedidos hoje;
- faturamento;
- produtos ativos;
- pedidos aguardando envio;
- lista de pedidos recentes.

Esses números são fictícios e devem ser substituídos por dados persistidos no backend.

## Persistência planejada

O Supabase pode ser usado para:

- banco de produtos;
- usuários e permissões;
- pedidos;
- itens de pedido;
- estoque por tamanho;
- favoritos sincronizados;
- armazenamento de imagens.

As imagens devem ser convertidas para WebP, receber miniaturas e ser organizadas com identificadores estáveis de produto.

## Roadmap técnico

### Fase 1 — Protótipo visual

- vitrine;
- marcas e categorias;
- filtros;
- carrinho local;
- favoritos locais;
- login demonstrativo;
- painel demonstrativo.

### Fase 2 — Catálogo real

- importar imagens do Drive;
- catalogar modelos;
- cadastrar preços reais;
- cadastrar numerações;
- cadastrar estoque;
- separar produtos em estoque e por encomenda.

### Fase 3 — Backend

- Supabase Auth;
- tabelas de produtos, variações, pedidos e usuários;
- Storage para imagens;
- regras de acesso para administração;
- sincronização do catálogo.

### Fase 4 — Operação

- gestão de pedidos;
- alteração de status;
- baixa de estoque;
- relatórios;
- integração com WhatsApp e pagamento.

## Publicação

O arquivo de entrada do site é `index.html` na raiz do projeto, conforme solicitado para leitura pelo GitHub Pages.

O destino informado é a organização:

`https://github.com/vhimports`

Ainda é necessário definir ou conectar o nome exato do repositório dentro da organização para concluir o push automático.
