import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { money } from '../lib/format'
import { vhCatalogAssets } from '../lib/vhCatalogAssets'

const blank = {
  sale_price: '',
  promotional_price: '',
  active: false,
  featured: false,
  sort_order: '0',
}

function currentPrice(product) {
  return Number(product.promotional_price || product.sale_price || 0)
}

export function ProductsPage() {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(blank)
  const [editingProduct, setEditingProduct] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('vh_catalogo_produtos')
      .select('id,slug,name,brand,category,image_key,description,sale_price,promotional_price,active,featured,sort_order')
      .order('sort_order')
      .order('name')

    if (error) {
      setFeedback({ type: 'error', message: 'Não foi possível carregar o catálogo fixo.' })
      setProducts([])
    } else {
      setProducts((data ?? []).map((product) => ({
        ...product,
        imageUrl: vhCatalogAssets[product.image_key] || '',
      })))
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return products
    return products.filter((product) => [product.name, product.brand, product.category, product.slug]
      .some((value) => value?.toLocaleLowerCase('pt-BR').includes(term)))
  }, [products, search])

  const publishedCount = products.filter((product) => product.active).length

  function update(event) {
    const { name, value, type, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  function editProduct(product) {
    setEditingProduct(product)
    setForm({
      sale_price: product.sale_price == null ? '' : String(product.sale_price),
      promotional_price: product.promotional_price == null ? '' : String(product.promotional_price),
      active: Boolean(product.active),
      featured: Boolean(product.featured),
      sort_order: String(product.sort_order ?? 0),
    })
    setFeedback({ type: '', message: '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function closeForm() {
    setEditingProduct(null)
    setForm(blank)
  }

  async function save(event) {
    event.preventDefault()
    if (!editingProduct) return
    setSaving(true)
    setFeedback({ type: '', message: '' })
    try {
      const salePrice = Number(form.sale_price)
      const promotionalPrice = form.promotional_price === '' ? null : Number(form.promotional_price)
      const sortOrder = Number(form.sort_order)
      if (!Number.isFinite(salePrice) || salePrice < 0 || !Number.isInteger(sortOrder) || sortOrder < 0) {
        throw new Error('Informe preço e ordem válidos.')
      }
      const { error } = await supabase.rpc('update_vh_catalog_prices', {
        p_product_id: editingProduct.id,
        p_sale_price: salePrice,
        p_promotional_price: promotionalPrice,
        p_active: Boolean(form.active),
        p_featured: Boolean(form.featured),
        p_sort_order: sortOrder,
        p_request_id: crypto.randomUUID(),
      })
      if (error) throw error
      closeForm()
      setFeedback({ type: 'success', message: 'Valores do produto atualizados com auditoria.' })
      await load()
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Não foi possível atualizar os valores.' })
    } finally {
      setSaving(false)
    }
  }

  return <div className="page-content">
    <div className="page-heading">
      <div>
        <span className="eyebrow">Catálogo fixo</span>
        <h1>Produtos e preços</h1>
        <p>As fotos são fixas no projeto. Aqui o master controla os valores e a publicação na vitrine.</p>
      </div>
    </div>
    {feedback.message && <div className={`alert ${feedback.type === 'error' ? 'error' : 'success'} inline-alert`} role="alert"><strong>{feedback.type === 'error' ? 'Atenção' : 'Tudo certo'}</strong><span>{feedback.message}</span></div>}

    <section className="metric-grid profit-metrics">
      <article className="metric-card gold"><div className="metric-top"><span>Modelos cadastrados</span><i>◇</i></div><strong>{loading ? '—' : products.length}</strong><small>Fotos fixas disponíveis no painel</small></article>
      <article className="metric-card lavender"><div className="metric-top"><span>Publicados</span><i>↗</i></div><strong>{loading ? '—' : publishedCount}</strong><small>Modelos com preço e publicação ativos</small></article>
      <article className="metric-card blue"><div className="metric-top"><span>Sem preço</span><i>R$</i></div><strong>{loading ? '—' : products.filter((product) => !Number(product.sale_price)).length}</strong><small>Preencha antes de publicar</small></article>
    </section>

    {editingProduct && <form className="panel form-panel" onSubmit={save}>
      <div className="panel-heading"><div><span className="eyebrow">Editar valores</span><h2>{editingProduct.name}</h2><p>{editingProduct.brand} · {editingProduct.category}</p></div><button type="button" className="secondary-button" onClick={closeForm}>Cancelar</button></div>
      <div className="form-grid">
        <label>Preço de venda<input type="number" name="sale_price" min="0" step="0.01" required value={form.sale_price} onChange={update} placeholder="0,00" /></label>
        <label>Preço promocional<input type="number" name="promotional_price" min="0" step="0.01" value={form.promotional_price} onChange={update} placeholder="Opcional" /></label>
        <label>Ordem na vitrine<input type="number" name="sort_order" min="0" step="1" value={form.sort_order} onChange={update} /></label>
        <label className="checkbox-label"><input type="checkbox" name="active" checked={form.active} onChange={update} /> Publicar na vitrine</label>
        <label className="checkbox-label"><input type="checkbox" name="featured" checked={form.featured} onChange={update} /> Destacar modelo</label>
      </div>
      <p className="field-help">A publicação exige preço de venda maior que zero. Nenhum estoque, upload ou alteração de foto é feito por esta tela.</p>
      <div className="form-actions"><button className="primary-button" disabled={saving}>{saving ? 'Salvando…' : 'Salvar valores'}</button></div>
    </form>}

    <section className="panel list-panel">
      <div className="panel-heading"><div><span className="eyebrow">Fotos versionadas</span><h2>{products.length} {products.length === 1 ? 'modelo' : 'modelos'}</h2></div><label className="search-field"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar modelo, marca ou categoria" /></label></div>
      {loading ? <div className="loading-row">Carregando catálogo…</div> : filtered.length === 0 ? <div className="empty-table"><span className="empty-icon">◇</span><strong>Nenhum modelo encontrado</strong><p>Adicione a próxima foto ao código e registre-a em uma migration antes de testar.</p></div> : <div className="product-grid">{filtered.map((product) => <article className="product-card" key={product.id}>
        {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <div className="product-placeholder">Foto fixa não mapeada</div>}
        <div className="product-card-body"><div className="product-title"><strong>{product.name}</strong><span>{product.brand} · {product.category}</span></div><div className="product-prices"><strong>{currentPrice(product) ? money(currentPrice(product)) : 'Preço pendente'}</strong>{product.promotional_price ? <small>De {money(product.sale_price)}</small> : <small>Preço definido pelo master</small>}</div><div className={product.active ? 'stock-ok' : 'stock-low'}>{product.active ? 'Publicado na vitrine' : 'Rascunho'}{product.featured ? ' · Destaque' : ''}</div><div className="row-actions"><button type="button" className="secondary-button compact-button" disabled={saving} onClick={() => editProduct(product)}>Editar valores</button></div></div>
      </article>)}</div>}
    </section>
  </div>
}
