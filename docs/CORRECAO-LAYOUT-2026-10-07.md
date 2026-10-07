# Correção de publicação e layout — 07/10/2026

## Problema confirmado

A folha publicada `assets/index-offwhite-v2.css` era interpretada pelo navegador com apenas as regras iniciais. As regras dos cards e dos breakpoints não eram aplicadas, deixando o catálogo com altura excessiva. A prévia local em outra porta também não representava necessariamente o build atual.

## Correções

- Substituir no `index.html` da raiz a referência à folha truncada por uma folha de estilos íntegra, com URL versionada e seletores compatíveis com a aplicação já publicada.
- Corrigir no código-fonte a resolução das fotos do catálogo para builds de produção, usando as URLs que o Vite gera para os arquivos importados.
- Corrigir a largura do destaque no celular: o contêiner com fotos absolutas encolhia até zero dentro da coluna flex; agora usa `align-self: stretch`.
- Tornar a vitrine off-white o padrão também ao acessar o endereço sem parâmetros. A versão anterior continua acessível com `?variant=original`.
- Manter o JavaScript e os assets já publicados sem alterações nesta correção visual; isso evita duplicar cerca de 180 MB de fotos em novos arquivos com hash.

## Validação antes de publicar

- Build Vite concluído; 31 testes automatizados existentes aprovados na análise anterior.
- Build de produção servido na porta 4180 para conferir exatamente os arquivos gerados.
- Celular 390 × 844: duas colunas, fundo off-white, imagem principal com largura positiva e sem overflow horizontal.
- Desktop 1440 × 900: quatro colunas, fundo off-white e sem overflow horizontal.
- Catálogo completo: 30 modelos.
- Detalhes: galeria troca de imagem, tamanho 40 incluído no link de WhatsApp e fechamento do modal funcional. Nenhuma mensagem foi enviada.

## Limitações existentes

Algumas logos externas do Simple Icons não estão disponíveis e o site apresenta o nome da marca como alternativa. As marcas sinalizadas como “fotos em breve” e os preços demonstrativos mantêm esse estado. Esta correção não confirma estoque, autenticidade ou valores comerciais.

## Publicação desta correção

O CSS íntegro gerado pelo build local é publicado como um novo arquivo em `assets/`; a raiz `index.html` aponta para ele por último. As mudanças de resolução de imagens e comportamento padrão off-white permanecem no código-fonte e entram no próximo build completo. Não editar manualmente o CSS minificado.
