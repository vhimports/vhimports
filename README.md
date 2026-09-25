# VH Imports

Sistema online da VH Imports, loja de tênis importados.

## Status atual

Esta primeira versão é um protótipo navegável e estático, preparado para evoluir para o sistema completo da operação da loja.

- `index.html`: entrada principal na raiz, compatível com GitHub Pages.
- `dist/index.html`: cópia de distribuição usada na prévia local e no Site atual.
- `docs/SISTEMA.md`: escopo, regras de negócio e roadmap.
- `VH_IMPORTS_HANDOFF.md`: contexto completo para continuidade em outro chat.

## Como visualizar localmente

Na pasta do projeto, execute:

```bash
python -m http.server 4173
```

Depois acesse `http://127.0.0.1:4173/`.

## Fluxos disponíveis no protótipo

- Vitrine da loja;
- catálogo por marca e categoria;
- busca e ordenação;
- favoritos;
- carrinho demonstrativo;
- seleção de numeração;
- entrada visual no painel da loja;
- login demonstrativo sem validação de credenciais;
- painel inicial com indicadores e pedidos recentes.

## Publicação no GitHub

O projeto foi preparado com `index.html` na raiz para leitura pelo GitHub Pages. O destino informado foi a organização `https://github.com/vhimports`.

Para concluir o push, é necessário informar ou conectar um repositório específico dentro dessa organização, por exemplo `vhimports/site` ou `vhimports/sistema`.

## Observação

Os produtos, preços e imagens atualmente cadastrados são dados de demonstração. A próxima etapa é importar as imagens reais do catálogo, converter para WebP e cadastrar estoque por tamanho.
