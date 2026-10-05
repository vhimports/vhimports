const catalogBase = `${import.meta.env.BASE_URL}src/assets/catalog-drive/`
const imagesFor = (prefix, count) => Array.from({ length: count }, (_, index) => (
  `${catalogBase}${prefix}-${String(index + 1).padStart(2, '0')}.jpg`
))

const sizes = ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43']

const definitions = [
  { slug: 'adidas-adizero-evo', brand: 'Adidas', name: 'Adizero Evo', category: 'Corrida', prefix: 'adidas-adizero-evo', count: 5, colors: ['Branco / preto', 'Rosa / branco', 'Branco / laranja', 'Laranja / rosa'] },
  { slug: 'adidas-campus', brand: 'Adidas', name: 'Campus', category: 'Lifestyle', prefix: 'adidas-campus', count: 7, colors: ['Marrom / branco', 'Verde / branco', 'Branco / preto', 'Azul / branco', 'Vermelho / azul'] },
  { slug: 'adidas-samba', brand: 'Adidas', name: 'Samba', category: 'Lifestyle', prefix: 'adidas-samba', count: 7, colors: ['Preto / branco', 'Branco / vinho', 'Branco / azul', 'Branco / vermelho'] },
  { slug: 'asics', brand: 'Asics', name: 'Asics', category: 'Corrida', prefix: 'asics-asics', count: 2, colors: ['Cinza / rosa', 'Branco / rosa'] },
  { slug: 'new-balance', brand: 'New Balance', name: 'New Balance', category: 'Lifestyle', prefix: 'new-balance-new-balance', count: 5, colors: ['Cinza / branco', 'Cinza / azul', 'Bege / cinza'] },
  { slug: 'nike-air-force', brand: 'Nike', name: 'Air Force', category: 'Lifestyle', prefix: 'nike-air-force', count: 6, colors: ['Preto / branco', 'Rosa / branco'] },
  { slug: 'nike-air-jordan-1', brand: 'Nike', name: 'Air Jordan 1', category: 'Basquete', prefix: 'nike-air-jordan-1', count: 6, colors: ['Rosa / branco / verde'] },
  { slug: 'nike-dunk', brand: 'Nike', name: 'Dunk', category: 'Lifestyle', prefix: 'nike-dunk', count: 30, colors: ['Azul / branco', 'Marrom / branco', 'Preto / branco', 'Branco / preto', 'Verde / branco', 'Vermelho / preto'] },
  { slug: 'nike-vomero', brand: 'Nike', name: 'Vomero', category: 'Corrida', prefix: 'nike-vomero', count: 2, colors: ['Branco / colorido', 'Branco / roxo'] },
  { slug: 'puma-original', brand: 'Puma', name: 'Puma Original', category: 'Lifestyle', prefix: 'puma-original-puma-original', count: 5, colors: ['Preto / branco', 'Preto / vermelho', 'Branco / cinza'] },
  { slug: 'puma-replica', brand: 'Puma Replica', name: 'Puma Replica', category: 'Lifestyle', prefix: 'puma-replica-puma-replica', count: 2, colors: ['Branco / verde'] },
]

export const driveCatalog = definitions.map((definition) => {
  const gallery = imagesFor(definition.prefix, definition.count)
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
