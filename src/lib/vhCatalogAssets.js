import nike01 from '../assets/catalog_nike-01-hi.jpg'
import nike02 from '../assets/catalog_nike-02-hi.jpg'
import nike03 from '../assets/catalog_nike-03-hi.jpg'
import nike04 from '../assets/catalog_nike-04-hi.jpg'

// As fotos da vitrine são fixas e versionadas junto com o código.
// O banco armazena apenas esta chave para permitir que o administrador edite
// preço, promoção e publicação sem fazer upload de imagem pelo painel.
export const vhCatalogAssets = Object.freeze({
  'catalog_nike-01-hi': nike01,
  'catalog_nike-02-hi': nike02,
  'catalog_nike-03-hi': nike03,
  'catalog_nike-04-hi': nike04,
})
