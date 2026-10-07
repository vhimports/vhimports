import catalogImageFiles from './catalogDriveImages.json'

const catalogAssetUrl = (path) => `${import.meta.env.BASE_URL}src/assets/catalog-drive/${path}`
const catalogBaseAssets = catalogImageFiles.map((path) => [
  `../assets/catalog-drive/${path}`,
  catalogAssetUrl(path),
])

const imagesFor = (prefix, count) => Array.from({ length: count }, (_, index) => {
  const filename = `${prefix}-${String(index + 1).padStart(2, '0')}.jpg`
  const match = catalogBaseAssets.find(([path]) => path.endsWith(`/${filename}`))
  return match?.[1] || ''
}).filter(Boolean)

const catalog38Assets = catalogBaseAssets.filter(([path]) => path.includes('/catalog-38-43/'))

const supplementImages = (...prefixes) => catalog38Assets
  .filter(([path]) => {
    const filename = path.split('/').pop() || ''
    return prefixes.some((prefix) => {
      const suffix = filename.slice(prefix.length + 1)
      return filename.startsWith(`${prefix}-`) && /^\d+\.jpg$/.test(suffix)
    })
  })
  .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
  .map(([, url]) => url)

const sizes = ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43']

const definitions = [
  { slug: 'adidas-adizero-evo', brand: 'Adidas', name: 'Adizero Evo', category: 'Corrida', prefix: 'adidas-adizero-evo', count: 5, supplementPrefixes: ['38-ao-43-adidas-replicas-adizero-evo'], colors: ['Branco / preto', 'Rosa / branco', 'Branco / laranja', 'Laranja / rosa'] },
  { slug: 'adidas-campus', brand: 'Adidas', name: 'Campus', category: 'Lifestyle', prefix: 'adidas-campus', count: 7, colors: ['Marrom / branco', 'Verde / branco', 'Branco / preto', 'Azul / branco', 'Vermelho / azul'] },
  { slug: 'adidas-samba', brand: 'Adidas', name: 'Samba', category: 'Lifestyle', prefix: 'adidas-samba', count: 7, colors: ['Preto / branco', 'Branco / vinho', 'Branco / azul', 'Branco / vermelho'] },
  { slug: 'adidas-forum-low', brand: 'Adidas', name: 'Forum Low', category: 'Lifestyle', supplementPrefixes: ['38-ao-43-adidas-replicas-forum-low'], colors: ['Branco / verde', 'Branco / azul', 'Preto / branco'] },
  { slug: 'adidas-adi2000', brand: 'Adidas', name: 'ADI2000', category: 'Lifestyle', supplementPrefixes: ['38-ao-43-adidas-replicas-adi2000'], colors: ['Preto / branco', 'Bege / preto'] },
  { slug: 'adidas-jellyfish', brand: 'Adidas', name: 'Jellyfish', category: 'Lifestyle', supplementPrefixes: ['38-ao-43-adidas-replicas-adidas-jellyfish'], colors: ['Azul / branco', 'Rosa / branco'] },
  { slug: 'adidas-adios-pro-5', brand: 'Adidas', name: 'Adios Pro 5', category: 'Corrida', supplementPrefixes: ['38-ao-43-adidas-replicas-adios-pro-5'], colors: ['Branco / azul', 'Branco / vermelho'] },
  { slug: 'adidas-adizero-pro-4', brand: 'Adidas', name: 'Adizero Pro 4', category: 'Corrida', supplementPrefixes: ['adidas-replicas-adizero-pro-4'], colors: ['Branco / preto', 'Verde / branco'] },
  { slug: 'adidas-campus-00s', brand: 'Adidas', name: 'Campus 00s', category: 'Lifestyle', supplementPrefixes: ['adidas-replicas-campus-00s'], colors: ['Preto / branco', 'Cinza / branco'] },
  { slug: 'adidas-originals', brand: 'Adidas', name: 'Adidas Originals', category: 'Lifestyle', supplementPrefixes: ['adidas-originals'], colors: ['Branco / preto', 'Preto / branco'] },
  { slug: 'asics', brand: 'Asics', name: 'Asics', category: 'Corrida', prefix: 'asics-asics', count: 2, supplementPrefixes: ['38-ao-43-asics'], colors: ['Cinza / rosa', 'Branco / rosa'] },
  { slug: 'new-balance', brand: 'New Balance', name: 'New Balance', category: 'Lifestyle', prefix: 'new-balance-new-balance', count: 5, supplementPrefixes: ['new-balance'], colors: ['Cinza / branco', 'Cinza / azul', 'Bege / cinza'] },
  { slug: 'air-max-portal', brand: 'Nike', name: 'Air Max Portal', category: 'Lifestyle', supplementPrefixes: ['38-ao-43-air-max-portal'], colors: ['Preto / branco', 'Cinza / branco'] },
  { slug: 'nike-air-force', brand: 'Nike', name: 'Air Force', category: 'Lifestyle', prefix: 'nike-air-force', count: 6, supplementPrefixes: ['38-ao-43-nike-repicas-air-force'], colors: ['Preto / branco', 'Rosa / branco'] },
  { slug: 'nike-air-jordan-1', brand: 'Nike', name: 'Air Jordan 1', category: 'Basquete', prefix: 'nike-air-jordan-1', count: 6, supplementPrefixes: ['38-ao-43-nike-repicas-air-jordan'], colors: ['Rosa / branco / verde'] },
  { slug: 'nike-air-max-95', brand: 'Nike', name: 'Air Max 95', category: 'Lifestyle', supplementPrefixes: ['nike-repicas-air-max-95'], colors: ['Cinza / branco'] },
  { slug: 'nike-air-max-tn', brand: 'Nike', name: 'Air Max TN', category: 'Lifestyle', supplementPrefixes: ['nike-repicas-air-max-tn'], colors: ['Preto / branco', 'Preto / vermelho'] },
  { slug: 'nike-alphafly', brand: 'Nike', name: 'Alphafly', category: 'Corrida', supplementPrefixes: ['nike-repicas-alphafly'], colors: ['Branco / verde', 'Branco / vermelho'] },
  { slug: 'nike-court-vision', brand: 'Nike', name: 'Court Vision', category: 'Lifestyle', supplementPrefixes: ['38-ao-43-nike-repicas-court-vision'], colors: ['Branco / preto', 'Branco / vermelho'] },
  { slug: 'nike-dunk-jumbo', brand: 'Nike', name: 'Dunk Jumbo', category: 'Lifestyle', supplementPrefixes: ['nike-repicas-dunk-jumbo'], colors: ['Branco / preto', 'Cinza / azul'] },
  { slug: 'nike-dunk-twist', brand: 'Nike', name: 'Dunk Twist', category: 'Lifestyle', supplementPrefixes: ['nike-repicas-dunk-twist'], colors: ['Branco / azul'] },
  { slug: 'nike-original', brand: 'Nike', name: 'Nike', category: 'Lifestyle', supplementPrefixes: ['nike-original'], colors: ['Branco / preto', 'Preto / branco'] },
  { slug: 'nike-dunk', brand: 'Nike', name: 'Dunk', category: 'Lifestyle', prefix: 'nike-dunk', count: 30, supplementPrefixes: ['38-ao-43-nike-repicas-dunk', 'nike-repicas-dunk'], colors: ['Azul / branco', 'Marrom / branco', 'Preto / branco', 'Branco / preto', 'Verde / branco', 'Vermelho / preto'] },
  { slug: 'nike-vomero', brand: 'Nike', name: 'Vomero', category: 'Corrida', prefix: 'nike-vomero', count: 2, colors: ['Branco / colorido', 'Branco / roxo'] },
  { slug: 'puma-original', brand: 'Puma', name: 'Puma', category: 'Lifestyle', prefix: 'puma-original-puma-original', count: 5, supplementPrefixes: ['38-ao-43-puma-original'], colors: ['Preto / branco', 'Preto / vermelho', 'Branco / cinza'] },
  { slug: 'puma-replica', brand: 'Puma', name: 'Puma', category: 'Lifestyle', prefix: 'puma-replica-puma-replica', count: 2, supplementPrefixes: ['38-ao-43-puma-replicas'], colors: ['Branco / verde'] },
  { slug: 'fila-original', brand: 'Fila', name: 'Fila', category: 'Lifestyle', supplementPrefixes: ['38-ao-43-fila-original'], colors: ['Branco / preto', 'Branco / azul'] },
  { slug: 'mizuno', brand: 'Mizuno', name: 'Mizuno', category: 'Corrida', supplementPrefixes: ['38-ao-43-mizuno'], colors: ['Preto / branco', 'Cinza / azul'] },
  { slug: 'reserva-original', brand: 'Reserva', name: 'Reserva', category: 'Lifestyle', supplementPrefixes: ['reserva-original'], colors: ['Branco / preto', 'Preto / branco'] },
  { slug: 'vans', brand: 'Vans', name: 'Vans', category: 'Skate', supplementPrefixes: ['38-ao-43-vans'], colors: ['Preto / branco', 'Bege / branco'] },
]

export const driveCatalog = definitions.map((definition) => {
  const baseGallery = definition.prefix ? imagesFor(definition.prefix, definition.count) : []
  const supplementGallery = definition.supplementPrefixes ? supplementImages(...definition.supplementPrefixes) : []
  const gallery = [...baseGallery, ...supplementGallery]
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
