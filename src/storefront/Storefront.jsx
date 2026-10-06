import { useEffect, useMemo, useState } from 'react'
import vhLogo from '../assets/vh-logo-metal.jpg'
import { vhCatalogAssets } from '../lib/vhCatalogAssets'
import { driveCatalog } from '../lib/driveCatalog'

const WHATSAPP_NUMBER = '5562982593182'
const defaultSupabaseUrl = 'https://zbmxehzprydojjfdwupp.supabase.co'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || defaultSupabaseUrl
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const brandTones = ['sand', 'stone', 'mist', 'clay', 'olive', 'blue']

const brandLogoSources = {
  Adidas: 'https://cdn.simpleicons.org/adidas/101214',
  Asics: 'https://cdn.simpleicons.org/asics/101214',
  'New Balance': 'https://cdn.simpleicons.org/newbalance/101214',
  Nike: 'https://cdn.simpleicons.org/nike/101214',
  Puma: 'https://cdn.simpleicons.org/puma/101214',
  'Puma Replica': 'https://cdn.simpleicons.org/puma/101214',
  Fila: 'https://cdn.simpleicons.org/fila/101214',
  Mizuno: 'https://cdn.simpleicons.org/mizuno/101214',
  Reserva: 'https://cdn.simpleicons.org/reserva/101214',
  Vans: 'https://cdn.simpleicons.org/vans/101214',
}

const familyTiles = [
  { label: 'VH no corre', image: 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&w=800&q=85' },
  { label: 'VH na rua', image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=85' },
  { label: 'VH no detalhe', image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=85' },
  { label: 'VH no movimento', image: 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=800&q=85' },
  { label: 'VH no seu ritmo', image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=800&q=85' },
  { label: 'VH em você', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=85' },
]

const categoryTiles = [
  { name: 'Corrida', detail: 'Leveza para ir mais longe.', tone: 'dark' },
  { name: 'Lifestyle', detail: 'Seu uniforme de todos os dias.', tone: 'lime' },
  { name: 'Basquete', detail: 'Presença que chega primeiro.', tone: 'orange' },
  { name: 'Por encomenda', detail: 'O modelo que você procura.', tone: 'blue' },
]

// Valores abaixo são somente uma vitrine de teste até o time VH cadastrar os preços reais no Supabase.
const demoPromotionSeeds = [
  { slug: 'adidas-adizero-evo', price: 699.9, oldPrice: 999.9 },
  { slug: 'nike-air-force', price: 649.9, oldPrice: 899.9 },
  { slug: 'asics', price: 749.9, oldPrice: 999.9 },
  { slug: 'new-balance', price: 799.9, oldPrice: 1099.9 },
  { slug: 'puma-original', price: 599.9, oldPrice: 799.9 },
  { slug: 'vans', price: 549.9, oldPrice: 749.9 },
]

function money(value) { return value == null ? 'Consulte o valor' : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function discountPercent(product) {
  if (product?.oldPrice == null || product?.price == null || Number(product.oldPrice) <= Number(product.price)) return null
  return Math.round((1 - Number(product.price) / Number(product.oldPrice)) * 100)
}
function installment(value) {
  if (value == null) return null
  return money(Number(value) / 12)
}
function whatsappUrl(product, size = '') {
  const price = product?.demoPromotion ? 'valor demonstrativo — confirmar' : product?.price == null ? 'valor a confirmar' : money(product.price)
  const selectedSize = size || 'numeração não escolhida'
  const message = product ? `Olá, VH Imports! Tenho interesse no modelo ${product.name}, ${selectedSize}, por ${price}, que vi no site. Ainda está disponível?` : 'Olá, VH Imports! Vim pelo site e gostaria de conhecer os tênis disponíveis.'
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}
function ArrowIcon() { return <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M3.5 10h12m-5-5 5 5-5 5" /></svg> }
function HeartIcon({ filled = false }) { return <svg aria-hidden="true" viewBox="0 0 24 24" className={filled ? 'is-filled' : ''}><path d="M20.8 8.7c0 5.2-8.8 10.1-8.8 10.1S3.2 13.9 3.2 8.7A4.7 4.7 0 0 1 12 6.3a4.7 4.7 0 0 1 8.8 2.4Z" /></svg> }

export default function Storefront() {
  const panelasVariant = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('variant') === 'panelas'
  const [remoteProducts, setRemoteProducts] = useState([])
  const [activeBrand, setActiveBrand] = useState('Todos')
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [search, setSearch] = useState('')
  const [showFullCatalog, setShowFullCatalog] = useState(false)
  const [loading, setLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [catalogAttempt, setCatalogAttempt] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeCard, setActiveCard] = useState(null)
  const [favorites, setFavorites] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedSize, setSelectedSize] = useState('')

  useEffect(() => {
    let alive = true
    async function loadCatalog() {
      setLoading(true)
      if (!supabaseUrl) { setCatalogError('Configure a conexão pública do Supabase para carregar o catálogo.'); setLoading(false); return }
      try {
        const headers = { Accept: 'application/json' }
        if (supabaseAnonKey) headers.apikey = supabaseAnonKey
        const response = await fetch(`${supabaseUrl}/functions/v1/public-catalog`, { headers })
        if (!response.ok) throw new Error('Catálogo indisponível')
        const result = await response.json()
        if (alive && Array.isArray(result.products)) {
          setRemoteProducts(result.products.map((product) => ({
            ...product,
            imageUrl: vhCatalogAssets[product.imageKey] || '',
            altImage: vhCatalogAssets[product.imageKey] || '',
            badge: product.featured ? 'DESTAQUE' : product.oldPrice ? 'OFERTA' : 'CONSULTE VALOR',
          })))
          setCatalogError('')
        }
      } catch { if (alive) { setRemoteProducts([]); setCatalogError('O catálogo ainda não está disponível. Verifique a conexão com o Supabase.') } } finally { if (alive) setLoading(false) }
    }
    loadCatalog()
    return () => { alive = false }
  }, [catalogAttempt])

  const products = useMemo(() => {
    const normalizedRemote = remoteProducts.map((product) => {
      const driveProduct = driveCatalog.find((item) => item.slug === product.slug)
      return {
        ...product,
        gallery: product.gallery?.length ? product.gallery : [product.imageUrl].filter(Boolean),
        sizes: product.sizes || driveProduct?.sizes || ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43'],
        colors: product.colors || driveProduct?.colors || ['Cor do catálogo'],
      }
    })
    const remoteSlugs = new Set(normalizedRemote.map((product) => product.slug))
    return [...normalizedRemote, ...driveCatalog.filter((product) => !remoteSlugs.has(product.slug))]
  }, [remoteProducts])
  const categories = useMemo(() => ['Todos', ...new Set(products.map((product) => product.category).filter(Boolean))], [products])
  const brands = useMemo(() => [...new Set(products.map((product) => product.brand).filter(Boolean))].map((name, index) => ({ id: name.toLowerCase().replace(/\s+/g, '-'), name, wordmark: name.toUpperCase(), logo: brandLogoSources[name], detail: 'Modelos selecionados', count: products.filter((product) => product.brand === name).length, tone: brandTones[index % brandTones.length] })), [products])
  const visibleProducts = useMemo(() => products.filter((product) => {
    const brandMatches = activeBrand === 'Todos' || product.brand?.toLowerCase() === activeBrand.toLowerCase()
    const categoryMatches = activeCategory === 'Todos' || product.category?.toLowerCase() === activeCategory.toLowerCase()
    const searchMatches = `${product.name} ${product.brand || ''} ${product.category || ''}`.toLowerCase().includes(search.trim().toLowerCase())
    return brandMatches && categoryMatches && searchMatches
  }), [products, activeBrand, activeCategory, search])
  const promotionProducts = useMemo(() => demoPromotionSeeds.map((seed) => {
    const product = products.find((item) => item.slug === seed.slug)
    if (!product) return null
    const hasRealPrice = product.price != null
    return {
      ...product,
      price: hasRealPrice ? product.price : seed.price,
      oldPrice: hasRealPrice ? product.oldPrice : seed.oldPrice,
      badge: hasRealPrice ? (product.badge || 'OFERTA') : 'OFERTA · TESTE',
      demoPromotion: !hasRealPrice,
      description: hasRealPrice ? product.description : 'Preço demonstrativo para validação visual da seção de promoções. Confirme valor e estoque com a VH Imports.',
    }
  }).filter(Boolean), [products])
  function selectBrand(brand) { setActiveBrand(brand); setShowFullCatalog(true); document.getElementById('desejados')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  function toggleFavorite(id) { setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }
  function openProduct(product) {
    setSelectedProduct(product)
    setSelectedImage(0)
    setSelectedSize('')
  }

  return (
    <div className={`vh-site ${panelasVariant ? 'panelas-variant' : ''}`}>
      <div className="vh-topline"><span>FRETE PARA TODO O BRASIL</span><span>CURADORIA DE TÊNIS IMPORTADOS</span><a href={whatsappUrl()} target="_blank" rel="noreferrer">Atendimento pelo WhatsApp <ArrowIcon /></a></div>
      <header className="vh-header">
        <a className="vh-logo" href="#inicio" aria-label="VH Imports, início"><img src={vhLogo} alt="VH Imports" /><span>VH IMPORTS</span></a>
        <nav className={menuOpen ? 'vh-nav is-open' : 'vh-nav'} aria-label="Navegação principal"><a href="#marcas" onClick={() => setMenuOpen(false)}>Marcas</a><a href="#desejados" onClick={() => setMenuOpen(false)}>Mais desejados</a><a href="#promocoes" onClick={() => setMenuOpen(false)}>Promoções</a><a href="#comunidade" onClick={() => setMenuOpen(false)}>Comunidade</a><a href={whatsappUrl()} target="_blank" rel="noreferrer" className="vh-nav-button" onClick={() => setMenuOpen(false)}>Fale com a VH <ArrowIcon /></a></nav>
        <button className="vh-menu-toggle" aria-expanded={menuOpen} aria-label="Abrir menu" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? 'Fechar' : 'Menu'}</button>
      </header>
      <main>
        <section className="vh-hero" id="inicio"><div className="hero-editorial"><span className="vh-kicker">VH IMPORTS <i /> {panelasVariant ? 'SHOP ONLINE' : 'DESDE 2020'}</span><h1>{panelasVariant ? <>Seu próximo <em>par está aqui.</em></> : <>Seu próximo passo <em>começa aqui.</em></>}</h1><p>{panelasVariant ? 'Tênis importados, curadoria urbana e atendimento próximo para você comprar com confiança.' : 'Uma curadoria de tênis importados para quem transforma o cotidiano em estilo.'}</p><div className="hero-actions"><a className="vh-button" href="#desejados">{panelasVariant ? 'Comprar agora' : 'Explorar coleção'} <ArrowIcon /></a><a className="hero-text-link" href="#marcas">Ver por marca <ArrowIcon /></a></div><div className="hero-meta"><span>01</span><span className="meta-line" /><span>{panelasVariant ? 'ORIGINAL · SELECIONADO · VH' : 'ESTILO · MOVIMENTO · IDENTIDADE'}</span></div></div><div className="hero-visual"><div className="hero-photo hero-photo-main" /><div className="hero-photo hero-photo-detail" /><div className="hero-sticker"><img src={vhLogo} alt="Logo VH Imports" /></div><div className="hero-product-note"><span>{panelasVariant ? 'DESTAQUE DA SEMANA' : 'EM DESTAQUE'}</span><strong>{panelasVariant ? 'Seu próximo par.' : 'Seu estilo não espera.'}</strong><a href="#desejados">Ver modelos <ArrowIcon /></a></div></div><div className="hero-scroll">SCROLL PARA DESCOBRIR <span /></div></section>
        <div className="vh-marquee" aria-label="VH Imports"><div><span>SEU RITMO</span><i>✳</i><span>SUA MARCA</span><i>✳</i><span>SEU ESTILO</span><i>✳</i><span>SEU RITMO</span><i>✳</i><span>SUA MARCA</span></div></div>
        <section className="vh-section vh-brands" id="marcas"><div className="section-heading"><div><span className="vh-kicker">EXPLORE POR MARCA</span><h2>Escolha sua <em>marca preferida</em></h2></div><p>Escolha uma marca para encontrar o modelo que acompanha seu ritmo.</p></div><div className="brand-grid">{brands.map((brand, index) => <button key={brand.id} className={`brand-card brand-${brand.tone}`} onClick={() => selectBrand(brand.name)} style={{ '--card-delay': `${index * 70}ms` }}><span className="brand-pill">{brand.name}</span><div className="brand-wordmark" aria-label={`${brand.name} logo`}>{brand.logo && <img src={brand.logo} alt={`${brand.name} logo`} loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none'; const fallback = event.currentTarget.nextElementSibling; if (fallback) fallback.style.display = 'block' }} />}<span className="brand-wordmark-fallback" style={{ display: brand.logo ? 'none' : 'block' }}>{brand.wordmark}</span></div><div><span>{brand.name}</span><small>{brand.count} modelos <i>·</i> ver coleção <ArrowIcon /></small></div></button>)}</div><button className="under-link" onClick={() => selectBrand('Todos')}>Ver todas as marcas <ArrowIcon /></button></section>
        <section className="vh-section vh-wanted" id="desejados"><div className="section-heading section-heading-products"><div><span className="vh-kicker">{panelasVariant ? 'ESCOLHAS DA VH' : 'A CURADORIA VH'}</span><h2>{panelasVariant ? <>Mais <em>vendidos.</em></> : <>Mais <em>desejados.</em></>}</h2></div><div className="heading-side"><p>{panelasVariant ? 'Modelos selecionados para chegar rápido ao seu próximo look.' : 'Modelos com preço definido pelo time VH Imports.'}</p><button className="under-link" onClick={() => { setShowFullCatalog(true); setActiveBrand('Todos'); setActiveCategory('Todos'); setSearch('') }} aria-pressed={showFullCatalog}>Ver catálogo completo <ArrowIcon /></button></div></div><div className="product-toolbar"><div className="filter-tabs">{categories.map((category) => <button key={category} className={category === activeCategory ? 'is-selected' : ''} onClick={() => { setActiveCategory(category); setSearch('') }}>{category}</button>)}</div><label className="product-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar modelo" aria-label="Buscar modelo" /></label></div>{loading && <div className="catalog-loading"><span /> Atualizando os modelos disponíveis…</div>}<div className="wanted-grid">{(showFullCatalog ? visibleProducts : visibleProducts.slice(0, 8)).map((product, index) => { const isActive = activeCard === product.id; const isFavorite = favorites.includes(product.id); const discount = discountPercent(product); return <article className={`wanted-card ${isActive ? 'is-active' : ''}`} key={product.id} onClick={() => { setActiveCard(isActive ? null : product.id); openProduct(product) }} style={{ '--card-delay': `${index * 70}ms` }}><div className="wanted-visual"><img className="product-image-primary" src={product.imageUrl} alt={product.name} loading={index > 3 ? 'lazy' : 'eager'} /><img className="product-image-secondary" src={product.altImage || product.imageUrl} alt="" aria-hidden="true" />{discount ? <span className="product-discount product-discount-badge">- {discount}%</span> : <span className="product-badge">{product.badge}</span>}<button className="favorite-button" aria-label={isFavorite ? `Remover ${product.name} dos favoritos` : `Adicionar ${product.name} aos favoritos`} onClick={(event) => { event.stopPropagation(); toggleFavorite(product.id) }}><HeartIcon filled={isFavorite} /></button><button className="visual-cta" type="button" onClick={(event) => { event.stopPropagation(); openProduct(product) }}>Ver fotos e tamanhos <ArrowIcon /></button></div><div className="wanted-info"><div className="wanted-copy"><span className="product-brand-pill">{product.brand || 'VH'}</span><span className="product-line">{product.category || 'Sneaker'}</span><h3>{product.name}</h3></div><div className="product-price">{product.oldPrice && <del>{money(product.oldPrice)}</del>}<strong>{money(product.price)}</strong>{product.price != null && <span className="product-installment">▭ Até 12x de {installment(product.price)}</span>}</div></div></article> })}</div>{!loading && !catalogError && !visibleProducts.length && <div className="catalog-empty">Nenhum modelo publicado. O administrador precisa definir o preço e ativar o modelo no painel.</div>}</section>
        <section className="vh-section vh-promotions" id="promocoes"><div className="section-heading section-heading-products"><div><span className="vh-kicker">OFERTAS VH</span><h2>Itens em <em>promoção.</em></h2></div><div className="heading-side"><p>Modelos variados para testar a nova vitrine. Os valores marcados como teste ainda serão substituídos pelo cadastro real.</p><button className="under-link" onClick={() => { setShowFullCatalog(true); setActiveBrand('Todos'); setActiveCategory('Todos'); setSearch(''); document.getElementById('desejados')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>Ver catálogo completo <ArrowIcon /></button></div></div><div className="promotion-grid">{promotionProducts.map((product, index) => { const isFavorite = favorites.includes(product.id); const discount = discountPercent(product); return <article className="promotion-card" key={'promotion-' + product.id} onClick={() => openProduct(product)} style={{ '--card-delay': (index * 70) + 'ms' }}><div className="promotion-visual"><img className="product-image-primary" src={product.imageUrl} alt={product.name} loading={index > 3 ? 'lazy' : 'eager'} />{discount ? <span className="product-discount product-discount-badge">- {discount}%</span> : <span className="product-badge">{product.badge}</span>}<button className="favorite-button" aria-label={isFavorite ? 'Remover ' + product.name + ' dos favoritos' : 'Adicionar ' + product.name + ' aos favoritos'} onClick={(event) => { event.stopPropagation(); toggleFavorite(product.id) }}><HeartIcon filled={isFavorite} /></button><button className="visual-cta" type="button" onClick={(event) => { event.stopPropagation(); openProduct(product) }}>Ver fotos e tamanhos <ArrowIcon /></button></div><div className="promotion-info"><div><span className="product-brand-pill">{product.brand || 'VH'}</span><span className="product-line">{product.category || 'Sneaker'}</span><h3>{product.name}</h3></div><div className="product-price">{product.oldPrice && <del>{money(product.oldPrice)}</del>}<strong>{money(product.price)}</strong>{product.price != null && <span className="product-installment">▭ Até 12x de {installment(product.price)}</span>}</div>{product.demoPromotion && <small className="promotion-demo-note">Preço demonstrativo</small>}</div></article> })}</div>{!promotionProducts.length && <div className="catalog-empty">Adicione produtos no catálogo para preencher as promoções.</div>}</section>
        <section className="vh-categories"><div className="category-intro"><span className="vh-kicker">ENCONTRE SEU RITMO</span><h2>Para onde<br /><em>você vai?</em></h2><p>Do treino ao rolê, seu próximo par começa por aqui.</p></div><div className="category-grid">{categoryTiles.map((category) => <a href={whatsappUrl()} className={`category-card category-${category.tone}`} key={category.name}><span>{category.name}</span><strong>{category.detail}</strong><ArrowIcon /></a>)}</div></section>
        <section className="vh-community" id="comunidade"><div className="community-heading"><span className="vh-kicker">NOSSA FAMÍLIA</span><h2>Quem usa VH,<br /><em>faz parte.</em></h2><p>Marque <strong>@vhimports.62</strong> para aparecer por aqui.</p></div><div className="family-grid">{familyTiles.map((tile, index) => <a href="https://www.instagram.com/vhimports.62/" target="_blank" rel="noreferrer" className="family-tile" key={tile.label} style={{ '--family-image': `url("${tile.image}")`, '--tile-delay': `${index * 80}ms` }}><span>{tile.label}</span></a>)}</div></section>
        <section className="vh-contact"><div><span className="vh-kicker">VAMOS CONVERSAR</span><h2>O próximo par<br /><em>pode ser o seu.</em></h2></div><a href={whatsappUrl()} target="_blank" rel="noreferrer" className="vh-button light">Falar com a VH Imports <ArrowIcon /></a></section>
      </main>
      {selectedProduct && <div className="product-modal-backdrop" role="presentation" onClick={() => setSelectedProduct(null)}><section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title" onClick={(event) => event.stopPropagation()}><button className="product-modal-close" aria-label="Fechar detalhes" onClick={() => setSelectedProduct(null)}>×</button><div className="product-modal-gallery"><div className="product-modal-main"><img src={(selectedProduct.gallery || [selectedProduct.imageUrl])[selectedImage] || selectedProduct.imageUrl} alt={selectedProduct.name} /></div><div className="product-modal-thumbs">{(selectedProduct.gallery || [selectedProduct.imageUrl]).map((image, index) => <button key={image} type="button" className={selectedImage === index ? 'is-selected' : ''} onClick={() => setSelectedImage(index)}><img src={image} alt={`${selectedProduct.name} foto ${index + 1}`} /></button>)}</div></div><div className="product-modal-copy"><span className="product-brand-pill">{selectedProduct.brand}</span><span className="product-line">{selectedProduct.category || 'Sneaker'}</span><h2 id="product-modal-title">{selectedProduct.name}</h2><p>{selectedProduct.description || 'Selecione a numeração e fale com a VH Imports para confirmar disponibilidade.'}</p><div className="product-modal-price">{money(selectedProduct.price)}{selectedProduct.oldPrice && <del>{money(selectedProduct.oldPrice)}</del>}</div><div className="product-modal-block"><span>Numeração disponível</span><div className="size-options">{(selectedProduct.sizes || []).map((size) => <button key={size} type="button" className={selectedSize === size ? 'is-selected' : ''} onClick={() => setSelectedSize(size)}>{size}</button>)}</div></div><div className="product-modal-block"><span>Cores / variações</span><div className="color-options">{(selectedProduct.colors || []).map((color) => <span key={color}>{color}</span>)}</div></div><a className="vh-button product-modal-whatsapp" href={whatsappUrl(selectedProduct, selectedSize)} target="_blank" rel="noreferrer">Pedir pelo WhatsApp <ArrowIcon /></a><small>O pedido final depende da confirmação do estoque com a VH Imports.</small></div></section></div>}
      <footer className="vh-footer"><a href="#inicio" className="footer-logo"><img src={vhLogo} alt="VH Imports" /><span>VH IMPORTS</span></a><span>Importados com curadoria. Escolhidos para você.</span><span>© {new Date().getFullYear()} VH IMPORTS</span></footer>
    </div>
  )
}





