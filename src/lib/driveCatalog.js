const catalogFiles = import.meta.glob('../assets/catalog-drive/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
})

const imagesFor = (prefix) => Object.entries(catalogFiles)
  .filter(([path]) => path.includes(`/${prefix}-`))
  .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
  .map(([, url]) => url)

const sizes = ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43']

const definitions = [
  { slug: 'adidas-adizero-evo', brand: 'Adidas', name: 'Adizero Evo', category: 'Corrida', prefix: 'adidas-adizero-evo', colors: ['Branco / preto', 'Rosa / branco', 'Branco / laranja', 'Laranja / rosa'] },
  { slug: 'adidas-campus', brand: 'Adidas', name: 'Campus', category: 'Lifestyle', prefix: 'adidas-campus', colors: ['Marrom / branco', 'Verde / branco', 'Branco / preto', 'Azul / branco', 'Vermelho / azul'] },
  { slug: 'adidas-samba', brand: 'Adidas', name: 'Samba', category: 'Lifestyle', prefix: 'adidas-samba', colors: ['Preto / branco', 'Branco / vinho', 'Branco / azul', 'Branco / vermelho'] },
  { slug: 'asics', brand: 'Asics', name: 'Asics', category: 'Corrida', prefix: 'asics-asics', colors: ['Cinza / rosa', 'Branco / rosa'] },
  { slug: 'new-balance', brand: 'New Balance', name: 'New Balance', category: 'Lifestyle', prefix: 'new-balance-new-balance', colors: ['Cinza / branco', 'Cinza / azul', 'Bege / cinza'] },
  { slug: 'nike-air-force', brand: 'Nike', name: 'Air Force', category: 'Lifestyle', prefix: 'nike-air-force', colors: ['Preto / branco', 'Rosa / branco'] },
  { slug: 'nike-air-jordan-1', brand: 'Nike', name: 'Air Jordan 1', category: 'Basquete', prefix: 'nike-air-jordan-1', colors: ['Rosa / branco / verde'] },
  { slug: 'nike-dunk', brand: 'Nike', name: 'Dunk', category: 'Lifestyle', prefix: 'nike-dunk', colors: ['Azul / branco', 'Marrom / branco', 'Preto / branco', 'Branco / preto', 'Verde / branco', 'Vermelho / preto'] },
  { slug: 'nike-vomero', brand: 'Nike', name: 'Vomero', category: 'Corrida', prefix: 'nike-vomero', colors: ['Branco / colorido', 'Branco / roxo'] },
  { slug: 'puma-original', brand: 'Puma', name: 'Puma Original', category: 'Lifestyle', prefix: 'puma-original-puma-original', colors: ['Preto / branco', 'Preto / vermelho', 'Branco / cinza'] },
  { slug: 'puma-replica', brand: 'Puma Replica', name: 'Puma Replica', category: 'Lifestyle', prefix: 'puma-replica-puma-replica', colors: ['Branco / verde'] },
]

export const driveCatalog = definitions.map((definition) => {
  const gallery = imagesFor(definition.prefix)
  return {
    ...definition,
    id: `drive-${definition.slug}`,
    imageUrl: gallery[0] || '',
    altImage: gallery[1] || gallery[0] || '',
    gallery,
    sizes,
    price: null,
    oldPrice: null,
    badge: 'CATÁLOGO VH',
    description: 'Fotos reais do catálogo VH Imports. Consulte o valor e confirme a disponibilidade da cor e da numeração pelo WhatsApp.',
  }
})
