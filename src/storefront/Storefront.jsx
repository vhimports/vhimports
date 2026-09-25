import { useEffect, useMemo, useState } from 'react'

const WHATSAPP_NUMBER = '5562982593182'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const fallbackImage = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1600&q=85'

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function whatsappUrl(product) {
  const message = product
    ? product.currentStock > 0
      ? `Olá, VH Imports! Tenho interesse no modelo ${product.name}, por ${money(product.price)}, que vi no site. Ainda está disponível?`
      : `Olá, VH Imports! Vi o modelo ${product.name} no site e gostaria de saber se haverá reposição.`
    : 'Olá, VH Imports! Vim pelo site e gostaria de conhecer os tênis disponíveis.'
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

function ArrowIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M3.5 10h12m-5-5 5 5-5 5" /></svg>
}

export default function Storefront() {
  const [products, setProducts] = useState([])
  const [categoryOptions, setCategoryOptions] = useState([])
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [catalogError, setCatalogError] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [catalogAttempt, setCatalogAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    async function loadCatalog() {
      setLoading(true)
      setCatalogError(false)
      if (!supabaseUrl || !supabaseAnonKey) {
        setCatalogError(true)
        setLoading(false)
        return
      }
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/public-catalog`, {
          headers: { apikey: supabaseAnonKey, Accept: 'application/json' },
        })
        if (!response.ok) throw new Error('Catálogo indisponível')
        const result = await response.json()
        if (alive) {
          const nextProducts = Array.isArray(result.products) ? result.products : []
          setProducts(nextProducts)
          setCategoryOptions([...new Set(nextProducts.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')))
        }
      } catch {
        if (alive) setCatalogError(true)
      } finally {
        if (alive) setLoading(false)
      }
    }
    loadCatalog()
    return () => { alive = false }
  }, [catalogAttempt])

  const visibleProducts = useMemo(() => products.filter((product) => {
    const categoryMatches = activeCategory === 'Todos' || product.category?.toLocaleLowerCase('pt-BR') === activeCategory.toLocaleLowerCase('pt-BR')
    const searchMatches = `${product.name} ${product.category || ''} ${product.description || ''}`.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))
    return categoryMatches && searchMatches
  }), [products, activeCategory, search])

  const featured = products.find((product) => product.imageUrl) || null

  return (
    <div className="storefront">
      <div className="store-topline"><span>VH IMPORTS · ESTILO PARA ACOMPANHAR VOCÊ</span><a href={whatsappUrl()} target="_blank" rel="noreferrer">Atendimento pelo WhatsApp <ArrowIcon /></a></div>
      <header className="store-header">
        <a className="store-brand" href="#inicio" aria-label="VH Imports, início"><span className="brand-mark">VH</span><span>VH imports<small>TÊNIS · CURADORIA URBANA</small></span></a>
        <button className="store-menu-toggle" aria-expanded={menuOpen} aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Fechar' : 'Menu'}</button>
        <nav className={menuOpen ? 'store-nav is-open' : 'store-nav'} aria-label="Navegação principal">
          <a href="#colecao" onClick={() => setMenuOpen(false)}>Coleção</a><a href="#essencia" onClick={() => setMenuOpen(false)}>Nossa essência</a>
          <a className="store-nav-cta" href={whatsappUrl()} target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)}>Fale com a VH Imports <ArrowIcon /></a>
        </nav>
      </header>

      <main>
        <section className="store-hero" id="inicio">
          <div className="hero-copy">
            <span className="store-eyebrow"><i /> TÊNIS QUE CONTAM A SUA HISTÓRIA</span>
            <h1>O detalhe que<br />faz <em>ser você.</em></h1>
            <p>Modelos importados para os dias comuns, os momentos especiais e tudo que merece ser lembrado.</p>
            <div className="hero-links"><a className="store-button" href="#colecao">Descubra a coleção <ArrowIcon /></a><span>Design atemporal · Brilho para sempre</span></div>
            <div className="hero-footnote"><span>01 — 06</span><span className="hero-rule" /><span>VH IMPORTS · SNEAKERS</span></div>
          </div>
          <div className="hero-art" style={{ '--hero-image': `url("${featured?.imageUrl || fallbackImage}")` }}>
            <div className="hero-art-overlay" /><span className="hero-caption">IMPORTADOS · EDIÇÃO LIMITADA</span><span className="hero-vertical">VH IMPORTS</span>
            {featured && <div className="featured-tag"><span>EM DESTAQUE</span><strong>{featured.name}</strong><small>{money(featured.price)}</small></div>}
          </div>
          <span className="hero-side-note">FEITO PARA DURAR. ESCOLHIDO POR VOCÊ.</span>
        </section>

        <section className="store-marquee" aria-label="Sobre a VH Imports"><span>TÊNIS IMPORTADOS</span><i>✳</i><span>ESTILO EM CADA PASSO</span><i>✳</i><span>FEITO PARA DURAR</span><i>✳</i><span>TÊNIS IMPORTADOS</span></section>

        <section className="collection-section" id="colecao">
            <div className="section-intro"><div><span className="store-eyebrow">A CURADORIA VH IMPORTS</span><h2>Encontre o seu <em>próximo modelo.</em></h2></div><p>Modelos para combinar com quem você é — e com todos os estilos que ainda vai descobrir.</p></div>
          <div className="collection-toolbar">
            <div className="category-tabs" role="group" aria-label="Filtrar por categoria">{['Todos', ...categoryOptions].map((category) => <button key={category} className={activeCategory === category ? 'category-tab active' : 'category-tab'} onClick={() => setActiveCategory(category)}>{category}</button>)}</div>
            <label className="store-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar modelos" aria-label="Buscar modelos" /></label>
          </div>

          {loading ? <div className="catalog-state"><span className="catalog-spinner" />Preparando a coleção para você…</div> : catalogError ? <div className="catalog-state catalog-error"><span>O catálogo está passando por uma atualização.</span><p>Enquanto isso, fale com a gente para conhecer os modelos disponíveis.</p><a className="store-button" href={whatsappUrl()} target="_blank" rel="noreferrer">Chamar no WhatsApp <ArrowIcon /></a><button className="catalog-retry" onClick={() => setCatalogAttempt((attempt) => attempt + 1)}>Tentar carregar novamente</button></div> : visibleProducts.length ? <div className="store-product-grid">{visibleProducts.map((product, index) => <article className="store-product" key={product.id}>
            <a className="store-product-image" href={whatsappUrl(product)} target="_blank" rel="noreferrer" aria-label={`Consultar ${product.name} pelo WhatsApp`}>
              {product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading={index > 3 ? 'lazy' : 'eager'} /> : <div className="product-image-fallback"><span>VH</span><small>VH IMPORTS · SNEAKERS</small></div>}
              <span className={product.currentStock > 0 ? 'product-status' : 'product-status sold-out'}>{product.currentStock > 0 ? 'Disponível' : 'Esgotada'}</span><span className="product-image-arrow"><ArrowIcon /></span>
            </a>
            <div className="store-product-info"><div><span className="product-category">{product.brand || product.category || 'VH IMPORTS'}</span><h3>{product.name}</h3></div><strong>{money(product.price)}</strong></div>
            <a className="product-cta" href={whatsappUrl(product)} target="_blank" rel="noreferrer">{product.currentStock > 0 ? 'Consultar pelo WhatsApp' : 'Consultar reposição'} <ArrowIcon /></a>
          </article>)}</div> : <div className="catalog-state">{products.length ? 'Nenhum modelo encontrado. Tente outra busca ou categoria.' : 'Em breve, novidades por aqui.'}</div>}
          {catalogError && <p className="catalog-note">Os modelos esgotados continuam visíveis quando o catálogo está conectado. O estoque é atualizado somente pelo painel VH Imports.</p>}
        </section>

        <section className="brand-story" id="essencia"><div className="story-image" style={{ backgroundImage: `url("${fallbackImage}")` }}><span>VH IMPORTS · SNEAKERS</span></div><div className="story-copy"><span className="store-eyebrow">NOSSA ESSÊNCIA</span><h2>Seu estilo.<br /><em>Do seu jeito.</em></h2><p>Acreditamos que um bom tênis acompanha a vida real: o presente que você se dá, o detalhe que muda o dia e a lembrança que fica.</p><a href={whatsappUrl()} target="_blank" rel="noreferrer" className="story-link">Vamos encontrar o seu? <ArrowIcon /></a><div className="story-signature">VH Imports <span>TÊNIS IMPORTADOS</span></div></div></section>

        <section className="store-contact"><span className="store-eyebrow">UMA CONVERSA, UMA JOIA, UMA HISTÓRIA</span><h2>Estamos aqui<br />para <em>ajudar você.</em></h2><a className="store-button light" href={whatsappUrl()} target="_blank" rel="noreferrer">Fale com a VH Imports <ArrowIcon /></a><span className="contact-note">Atendimento humano, pelo WhatsApp.</span></section>
      </main>

      <footer className="store-footer"><a className="footer-brand" href="#inicio">VH imports<small>TÊNIS · CURADORIA URBANA</small></a><span>Feito para você. Feito para durar.</span><span>© {new Date().getFullYear()} VH IMPORTS</span></footer>
    </div>
  )
}
