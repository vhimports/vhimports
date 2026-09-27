# VH Imports

Sistema interno da VH Imports, loja de tênis importados, construído com o mesmo fluxo operacional do sistema Finesse.

## Módulos implementados

- autenticação por e-mail e senha com dois usuários master;
- dashboard com vendas, cobranças e metas;
- pedidos manuais, status, pagamentos e parcelamentos;
- clientes, aniversários e campanhas de reativação;
- catálogo fixo de produtos, marcas, categorias e preços administráveis;
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

A migration `20260926001000_vh_fixed_catalog.sql` cria o catálogo fixo da VH Imports. As fotos são assets versionados em `src/assets/`; o master altera preço, promoção e publicação no painel. O catálogo não possui controle de estoque.

## Publicação

O `index.html` compilado é copiado para a raiz pelo build, permitindo publicar a branch `main` pela raiz no GitHub Pages.

## Documentação

Consulte [docs/SISTEMA.md](docs/SISTEMA.md) antes de alterar regras do produto ou do banco.
