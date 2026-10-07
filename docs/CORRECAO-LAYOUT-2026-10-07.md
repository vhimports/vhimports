# Correção de publicação e layout — 07/10/2026

## Problema confirmado

A folha publicada `assets/index-offwhite-v2.css` estava incompleta. Além disso, o HTML público carregava um JavaScript antigo, incompatível com a folha de estilos do novo layout. Isso removia regras dos cards/breakpoints e deixava o destaque com conteúdo desalinhado.

## Correções

- Publicar juntos o HTML, o JavaScript e o CSS gerados no mesmo build Vite, evitando combinações de versões incompatíveis.
- Resolver as fotos do catálogo por caminhos públicos dos arquivos que já estão versionados em `src/assets/catalog-drive`. Um manifesto de nomes mantém as galerias e evita gerar cópias hash de aproximadamente 188 MB.
- Corrigir a largura do destaque no celular: o contêiner com fotos absolutas encolhia até zero dentro da coluna flex; agora usa `align-self: stretch`.
- Tornar a vitrine off-white o padrão também ao acessar o endereço sem parâmetros. A versão anterior continua acessível com `?variant=original`.
- Publicar todos os assets do build correspondente (cerca de 1,2 MB), sem duplicar as fotos originais do catálogo.

## Validação antes de publicar

- Build Vite concluído; 32 testes automatizados aprovados.
- Arquivo original do catálogo conferido no GitHub Pages (1284 × 1333 px); os caminhos relativos `./src/assets/catalog-drive/...` apontam para fotos já versionadas no repositório.
- Celular 390 × 844: duas colunas, fundo off-white, imagem principal com largura positiva e sem overflow horizontal.
- Desktop 1440 × 900: quatro colunas, fundo off-white e sem overflow horizontal.
- Catálogo completo: 30 modelos.
- Detalhes: galeria troca de imagem, tamanho 40 incluído no link de WhatsApp e fechamento do modal funcional. Nenhuma mensagem foi enviada.

## Limitações existentes

Algumas logos externas do Simple Icons não estão disponíveis e o site apresenta o nome da marca como alternativa. As marcas sinalizadas como “fotos em breve” e os preços demonstrativos mantêm esse estado. Esta correção não confirma estoque, autenticidade ou valores comerciais.

## Publicação desta correção

O HTML raiz e os assets publicados são gerados em conjunto com `npm run build`. Após a publicação, verificar o site real em celular e desktop e aguardar o GitHub Pages atualizar o conteúdo.
