import { useEffect, useMemo, useState } from 'react'
import vhLogo from '../assets/vh-logo-metal.jpg'
import { vhCatalogAssets } from '../lib/vhCatalogAssets'

const WHATSAPP_NUMBER = '5562982593182'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const brandTones = ['sand', 'stone', 'mist', 'clay', 'olive', 'blue']

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

function money(value) { return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function whatsappUrl(product) {
  const message = product ? `Olá, VH Imports! Tenho interesse no modelo ${product.name}, por ${money(product.price)}, que vi no site. Ainda está disponível?` : 'Olá, VH Imports! Vim pelo site e gostaria de conhecer os tênis disponíveis.'
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}
function ArrowIcon() { return <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M3.5 10h12m-5-5 5 5-5 5" /></svg> }
function HeartIcon({ filled = false }) { return <svg aria-hidden="true" viewBox="0 0 24 24" className={filled ? 'is-filled' : ''}><path d="M20.8 8.7c0 5.2-8.8 10.1-8.8 10.1S3.2 13.9 3.2 8.7A4.7 4.7 0 0 1 12 6.3a4.7 4.7 0 0 1 8.8 2.4Z" /></svg> }

export default function Storefront() {
  const [remoteProducts, setRemoteProducts] = useState([])
  const [activeBrand, setActiveBrand] = useState('Todos')
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [catalogAttempt, setCatalogAttempt] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeCard, setActiveCard] = useState(null)
  const [favorites, setFavorites] = useState([])

  useEffect(() => {
    let alive = true
    async function loadCatalog() {
      setLoading(true)
      if (!supabaseUrl || !supabaseAnonKey) { setCatalogError('Configure a conexão pública do Supabase para carregar o catálogo.'); setLoading(false); return }
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/public-catalog`, { headers: { apikey: supabaseAnonKey, Accept: 'application/json' } })
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

  const products = remoteProducts
  const categories = useMemo(() => ['Todos', ...new Set(products.map((product) => product.category).filter(Boolean))], [products])
  const brands = useMemo(() => [...new Set(products.map((product) => product.brand).filter(Boolean))].map((name, index) => ({ id: name.toLowerCase().replace(/\s+/g, '-'), name, wordmark: name.toUpperCase(), detail: 'Modelos selecionados', count: products.filter((product) => product.brand === name).length, tone: brandTones[index % brandTones.length] })), [products])
  const visibleProducts = useMemo(() => products.filter((product) => {
    const brandMatches = activeBrand === 'Todos' || product.brand?.toLowerCase() === activeBrand.toLowerCase()
    const categoryMatches = activeCategory === 'Todos' || product.category?.toLowerCase() === activeCategory.toLowerCase()
    const searchMatches = `${product.name} ${product.brand || ''} ${product.category || ''}`.toLowerCase().includes(search.trim().toLowerCase())
    return brandMatches && categoryMatches && searchMatches
  }), [products, activeBrand, activeCategory, search])
  function selectBrand(brand) { setActiveBrand(brand); document.getElementById('desejados')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  function toggleFavorite(id) { setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }

  return (
    <div className="vh-site">
      <div className="vh-topline"><span>FRETE PARA TODO O BRASIL</span><span>CURADORIA DE TÊNIS IMPORTADOS</span><a href={whatsappUrl()} target="_blank" rel="noreferrer">Atendimento pelo WhatsApp <ArrowIcon /></a></div>
      <header className="vh-header">
        <a className="vh-logo" href="#inicio" aria-label="VH Imports, início"><img src={vhLogo} alt="VH Imports" /><span>VH IMPORTS</span></a>
        <nav className={menuOpen ? 'vh-nav is-open' : 'vh-nav'} aria-label="Navegação principal"><a href="#marcas" onClick={() => setMenuOpen(false)}>Marcas</a><a href="#desejados" onClick={() => setMenuOpen(false)}>Mais desejados</a><a href="#comunidade" onClick={() => setMenuOpen(false)}>Comunidade</a><a href={whatsappUrl()} target="_blank" rel="noreferrer" className="vh-nav-button" onClick={() => setMenuOpen(false)}>Fale com a VH <ArrowIcon /></a></nav>
        <button className="vh-menu-toggle" aria-expanded={menuOpen} aria-label="Abrir menu" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? 'Fechar' : 'Menu'}</button>
      </header>
      <main>
        <section className="vh-hero" id="inicio"><div className="hero-editorial"><span className="vh-kicker">VH IMPORTS <i /> DESDE 2020</span><h1>Seu próximo passo <em>começa aqui.</em></h1><p>Uma curadoria de tênis importados para quem transforma o cotidiano em estilo.</p><div className="hero-actions"><a className="vh-button" href="#desejados">Explorar coleção <ArrowIcon /></a><a className="hero-text-link" href="#marcas">Ver por marca <ArrowIcon /></a></div><div className="hero-meta"><span>01</span><span className="meta-line" /><span>ESTILO · MOVIMENTO · IDENTIDADE</span></div></div><div className="hero-visual"><div className="hero-photo hero-photo-main" /><div className="hero-photo hero-photo-detail" /><div className="hero-sticker">VH<br /><small>IMPORTS</small></div><div className="hero-product-note"><span>EM DESTAQUE</span><strong>Seu estilo não espera.</strong><a href="#desejados">Ver modelos <ArrowIcon /></a></div></div><div className="hero-scroll">SCROLL PARA DESCOBRIR <span /></div></section>
        <div className="vh-marquee" aria-label="VH Imports"><div><span>SEU RITMO</span><i>✳</i><span>SUA MARCA</span><i>✳</i><span>SEU ESTILO</span><i>✳</i><span>SEU RITMO</span><i>✳</i><span>SUA MARCA</span></div></div>
        <section className="vh-section vh-brands" id="marcas"><div className="section-heading"><div><span className="vh-kicker">EXPLORE POR MARCA</span><h2>Seu estilo, <em>sua marca.</em></h2></div><p>Escolha uma marca para encontrar o modelo que acompanha seu ritmo.</p></div><div className="brand-grid">{brands.map((brand, index) => <button key={brand.id} className={`brand-card brand-${brand.tone}`} onClick={() => selectBrand(brand.name)} style={{ '--card-delay': `${index * 70}ms` }}><span className="brand-pill">{brand.name}</span><strong>{brand.wordmark}</strong><div><span>{brand.name}</span><small>{brand.count} modelos <i>·</i> ver coleção <ArrowIcon /></small></div></button>)}</div><button className="under-link" onClick={() => selectBrand('Todos')}>Ver todas as marcas <ArrowIcon /></button></section>
        <section className="vh-section vh-wanted" id="desejados"><div className="section-heading section-heading-products"><div><span className="vh-kicker">A CURADORIA VH</span><h2>Mais <em>desejados.</em></h2></div><div className="heading-side"><p>Modelos com preço definido pelo time VH Imports.</p><button className="under-link" onClick={() => { setActiveBrand('Todos'); setActiveCategory('Todos'); setSearch('') }}>Ver catálogo completo <ArrowIcon /></button></div></div><div className="product-toolbar"><div className="filter-tabs">{categories.map((category) => <button key={category} className={category === activeCategory ? 'is-selected' : ''} onClick={() => { setActiveCategory(category); setSearch('') }}>{category}</button>)}</div><label className="product-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar modelo" aria-label="Buscar modelo" /></label></div>{loading && <div className="catalog-loading"><span /> Atualizando os modelos disponíveis…</div>}{catalogError && !loading && <div className="catalog-empty">{catalogError}</div>}<div className="wanted-grid">{visibleProducts.slice(0, 8).map((product, index) => { const isActive = activeCard === product.id; const isFavorite = favorites.includes(product.id); return <article className={`wanted-card ${isActive ? 'is-active' : ''}`} key={product.id} onClick={() => setActiveCard(isActive ? null : product.id)} style={{ '--card-delay': `${index * 70}ms` }}><div className="wanted-visual"><img className="product-image-primary" src={product.imageUrl} alt={product.name} loading={index > 3 ? 'lazy' : 'eager'} /><img className="product-image-secondary" src={product.altImage || product.imageUrl} alt="" aria-hidden="true" /><span className="product-badge">{product.badge}</span><button className="favorite-button" aria-label={isFavorite ? `Remover ${product.name} dos favoritos` : `Adicionar ${product.name} aos favoritos`} onClick={(event) => { event.stopPropagation(); toggleFavorite(product.id) }}><HeartIcon filled={isFavorite} /></button><a className="visual-cta" href={whatsappUrl(product)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Consultar modelo <ArrowIcon /></a></div><div className="wanted-info"><div><span className="product-brand-pill">{product.brand || 'VH'}</span><span className="product-line">{product.category || 'Sneaker'}</span><h3>{product.name}</h3></div><div className="product-price">{product.oldPrice && <del>{money(product.oldPrice)}</del>}<strong>{money(product.price)}</strong></div></div></article> })}</div>{!loading && !catalogError && !visibleProducts.length && <div className="catalog-empty">Nenhum modelo publicado. O administrador precisa definir o preço e ativar o modelo no painel.</div>}</section>
        <section className="vh-categories"><div className="category-intro"><span className="vh-kicker">ENCONTRE SEU RITMO</span><h2>Para onde<br /><em>você vai?</em></h2><p>Do treino ao rolê, seu próximo par começa por aqui.</p></div><div className="category-grid">{categoryTiles.map((category) => <a href={whatsappUrl()} className={`category-card category-${category.tone}`} key={category.name}><span>{category.name}</span><strong>{category.detail}</strong><ArrowIcon /></a>)}</div></section>
        <section className="vh-community" id="comunidade"><div className="community-heading"><span className="vh-kicker">NOSSA FAMÍLIA</span><h2>Quem usa VH,<br /><em>faz parte.</em></h2><p>Marque <strong>@vhimports.62</strong> para aparecer por aqui.</p></div><div className="family-grid">{familyTiles.map((tile, index) => <a href="https://www.instagram.com/vhimports.62/" target="_blank" rel="noreferrer" className="family-tile" key={tile.label} style={{ '--family-image': `url("${tile.image}")`, '--tile-delay': `${index * 80}ms` }}><span>{tile.label}</span></a>)}</div></section>
        <section className="vh-contact"><div><span className="vh-kicker">VAMOS CONVERSAR</span><h2>O próximo par<br /><em>pode ser o seu.</em></h2></div><a href={whatsappUrl()} target="_blank" rel="noreferrer" className="vh-button light">Falar com a VH Imports <ArrowIcon /></a></section>
      </main>
      <footer className="vh-footer"><a href="#inicio" className="footer-logo"><img src={vhLogo} alt="VH Imports" /><span>VH IMPORTS</span></a><span>Importados com curadoria. Escolhidos para você.</span><span>© {new Date().getFullYear()} VH IMPORTS</span></footer>
    </div>
  )
}
