import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { money } from '../lib/format'
import { vhCatalogAssets, vhCatalogAssetOptions } from '../lib/vhCatalogAssets'

const blank = {
  sale_price: '',
  promotional_price: '',
  active: false,
  featured: false,
  sort_order: '0',
}

const newBlank = {
  name: '',
  brand: '',
  category: 'Lifestyle',
  image_key: vhCatalogAssetOptions[0]?.key || '',
  description: '',
  sale_price: '',
  promotional_price: '',
  active: false,
  featured: false,
  sort_order: '0',
}

function slugify(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function currentPrice(product) {
  return Number(product.promotional_price || product.sale_price || 0)
}

export function ProductsPage() {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(blank)
  const [newForm, setNewForm] = useState(newBlank)
  const [editingProduct, setEditingProduct] = useState(null)
  const [creating, setCreating] = useState(false)
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
  const brandOptions = useMemo(() => [...new Set(['Adidas', 'Nike', 'Asics', 'New Balance', 'Puma', 'Fila', 'Mizuno', 'Reserva', 'Vans', ...products.map((product) => product.brand).filter(Boolean)])].sort(), [products])
  const categoryOptions = useMemo(() => [...new Set(['Corrida', 'Lifestyle', 'Basquete', 'Treino', 'Casual', 'Skate', ...products.map((product) => product.category).filter(Boolean)])].sort(), [products])

  function update(event) {
    const { name, value, type, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  function editProduct(product) {
    setCreating(false)
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

  function openCreate() {
    setEditingProduct(null)
    setNewForm({ ...newBlank, image_key: vhCatalogAssetOptions[0]?.key || '' })
    setCreating(true)
    setFeedback({ type: '', message: '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function closeCreate() {
    setCreating(false)
    setNewForm(newBlank)
  }

  function updateNew(event) {
    const { name, value, type, checked } = event.target
    setNewForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  async function saveNew(event) {
    event.preventDefault()
    setSaving(true)
    setFeedback({ type: '', message: '' })
    try {
      const salePrice = Number(newForm.sale_price)
      const promotionalPrice = newForm.promotional_price === '' ? null : Number(newForm.promotional_price)
      const sortOrder = Number(newForm.sort_order || 0)
      const slug = `${slugify(newForm.brand)}-${slugify(newForm.name)}`
      if (!slug || !newForm.image_key || !Number.isFinite(salePrice) || salePrice < 0 || !Number.isFinite(sortOrder) || sortOrder < 0) {
        throw new Error('Informe nome, marca, foto fixa, preço normal e ordem válidos.')
      }
      const { error } = await supabase.rpc('create_vh_catalog_product', {
        p_slug: slug,
        p_name: newForm.name.trim(),
        p_brand: newForm.brand.trim(),
        p_category: newForm.category.trim(),
        p_image_key: newForm.image_key,
        p_description: newForm.description.trim(),
        p_sale_price: salePrice,
        p_promotional_price: promotionalPrice,
        p_active: Boolean(newForm.active),
        p_featured: Boolean(newForm.featured),
        p_sort_order: sortOrder,
        p_request_id: crypto.randomUUID(),
      })
      if (error) throw error
      closeCreate()
      setFeedback({ type: 'success', message: 'Novo modelo cadastrado e pronto para a vitrine.' })
      await load()
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Não foi possível cadastrar o modelo.' })
    } finally {
      setSaving(false)
    }
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
        <p>Cadastre modelos usando fotos fixas e controle preço, promoção e publicação na vitrine.</p>
      </div><button className="primary-button page-action" type="button" onClick={openCreate}>＋ Novo modelo</button>
    </div>
    {feedback.message && <div className={`alert ${feedback.type === 'error' ? 'error' : 'success'} inline-alert`} role="alert"><strong>{feedback.type === 'error' ? 'Atenção' : 'Tudo certo'}</strong><span>{feedback.message}</span></div>}

    {creating && <form className="panel form-panel quick-product-form" onSubmit={saveNew}>
      <div className="panel-heading"><div><span className="eyebrow">Cadastro rápido</span><h2>Novo modelo</h2><p>Escolha uma foto que já esteja versionada no projeto. O identificador será criado automaticamente pela marca e pelo nome.</p></div><button type="button" className="secondary-button" onClick={closeCreate}>Cancelar</button></div>
      <div className="form-grid">
        <label>Nome do modelo<input name="name" required value={newForm.name} onChange={updateNew} placeholder="Ex.: Campus 00s" /></label>
        <label>Marca<input name="brand" list="vh-brand-options" required value={newForm.brand} onChange={updateNew} placeholder="Ex.: Adidas" /></label>
        <label>Categoria<input name="category" list="vh-category-options" required value={newForm.category} onChange={updateNew} placeholder="Ex.: Lifestyle" /></label>
        <label>Foto fixa<select name="image_key" required value={newForm.image_key} onChange={updateNew}>{vhCatalogAssetOptions.map((asset) => <option key={asset.key} value={asset.key}>{asset.key}</option>)}</select></label>
        <label>Preço normal (de)<input type="number" name="sale_price" min="0" step="0.01" required value={newForm.sale_price} onChange={updateNew} placeholder="0,00" /></label>
        <label>Preço promocional (por)<input type="number" name="promotional_price" min="0" step="0.01" value={newForm.promotional_price} onChange={updateNew} placeholder="Opcional" /></label>
        <label>Ordem na vitrine<input type="number" name="sort_order" min="0" step="1" value={newForm.sort_order} onChange={updateNew} /></label>
        <label className="checkbox-label"><input type="checkbox" name="active" checked={newForm.active} onChange={updateNew} /> Publicar na vitrine</label>
        <label className="checkbox-label"><input type="checkbox" name="featured" checked={newForm.featured} onChange={updateNew} /> Destacar modelo</label>
      </div>
      <label className="wide-field">Descrição<textarea name="description" rows="3" value={newForm.description} onChange={updateNew} placeholder="Informação curta para a página do produto (opcional)" /></label>
      <datalist id="vh-brand-options">{brandOptions.map((brand) => <option key={brand} value={brand} />)}</datalist><datalist id="vh-category-options">{categoryOptions.map((category) => <option key={category} value={category} />)}</datalist>
      <p className="field-help">Para aparecer no site, informe o preço normal e marque “Publicar na vitrine”. Se preencher o promocional, o preço normal será exibido como valor anterior.</p>
      <div className="form-actions"><button className="primary-button" disabled={saving}>{saving ? 'Cadastrando…' : 'Cadastrar modelo'}</button></div>
    </form>}

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
