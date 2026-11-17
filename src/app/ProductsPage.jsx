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

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function slugify(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function currentPrice(product) {
  return Number(product.promotional_price || product.sale_price || 0)
}

async function uploadProductPhoto(file, slugHint) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Envie uma foto em JPEG, PNG ou WebP.')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('A foto deve ter até 5 MB.')
  }
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `uploads/${slugify(slugHint) || 'modelo'}-${Date.now()}.${extension}`
  const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: false, contentType: file.type })
  if (error) throw new Error('Não foi possível enviar a foto. Tente novamente.')
  return path
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
  const [showArchived, setShowArchived] = useState(false)
  const [archivingId, setArchivingId] = useState(null)

  const [newPhotoMode, setNewPhotoMode] = useState('fixed')
  const [newPhotoFile, setNewPhotoFile] = useState(null)
  const [editPhotoMode, setEditPhotoMode] = useState('fixed')
  const [editPhotoKey, setEditPhotoKey] = useState(vhCatalogAssetOptions[0]?.key || '')
  const [editPhotoFile, setEditPhotoFile] = useState(null)
  const [savingPhoto, setSavingPhoto] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('vh_catalogo_produtos')
      .select('id,slug,name,brand,category,image_key,image_path,description,sale_price,promotional_price,active,featured,sort_order,archived_at')
      .order('sort_order')
      .order('name')

    if (error) {
      setFeedback({ type: 'error', message: 'Não foi possível carregar o catálogo fixo.' })
      setProducts([])
      setLoading(false)
      return
    }

    const rows = data ?? []
    const uploadedPaths = [...new Set(rows.map((product) => product.image_path).filter(Boolean))]
    const signedUrlByPath = new Map()
    if (uploadedPaths.length > 0) {
      const { data: signedUrls } = await supabase.storage.from('product-images').createSignedUrls(uploadedPaths, 3600)
      for (const entry of signedUrls ?? []) {
        if (entry.path && entry.signedUrl) signedUrlByPath.set(entry.path, entry.signedUrl)
      }
    }

    setProducts(rows.map((product) => ({
      ...product,
      imageUrl: (product.image_path && signedUrlByPath.get(product.image_path)) || vhCatalogAssets[product.image_key] || '',
    })))
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const visibleProducts = useMemo(
    () => products.filter((product) => (showArchived ? Boolean(product.archived_at) : !product.archived_at)),
    [products, showArchived],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return visibleProducts
    return visibleProducts.filter((product) => [product.name, product.brand, product.category, product.slug]
      .some((value) => value?.toLocaleLowerCase('pt-BR').includes(term)))
  }, [visibleProducts, search])

  const activeProducts = useMemo(() => products.filter((product) => !product.archived_at), [products])
  const publishedCount = activeProducts.filter((product) => product.active).length
  const archivedCount = products.length - activeProducts.length
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
    setEditPhotoMode('fixed')
    setEditPhotoKey(product.image_key || vhCatalogAssetOptions[0]?.key || '')
    setEditPhotoFile(null)
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
    setNewPhotoMode('fixed')
    setNewPhotoFile(null)
    setCreating(true)
    setFeedback({ type: '', message: '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function closeCreate() {
    setCreating(false)
    setNewForm(newBlank)
    setNewPhotoFile(null)
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
      if (!slug || !Number.isFinite(salePrice) || salePrice < 0 || !Number.isFinite(sortOrder) || sortOrder < 0) {
        throw new Error('Informe nome, marca, preço normal e ordem válidos.')
      }
      if (newPhotoMode === 'upload' && !newPhotoFile) {
        throw new Error('Selecione o arquivo da foto nova para enviar.')
      }
      if (newPhotoMode === 'fixed' && !newForm.image_key) {
        throw new Error('Escolha uma foto já cadastrada no projeto.')
      }

      let imagePath = null
      if (newPhotoMode === 'upload' && newPhotoFile) {
        imagePath = await uploadProductPhoto(newPhotoFile, slug)
      }

      const { error } = await supabase.rpc('create_vh_catalog_product', {
        p_slug: slug,
        p_name: newForm.name.trim(),
        p_brand: newForm.brand.trim(),
        p_category: newForm.category.trim(),
        p_image_key: newPhotoMode === 'fixed' ? newForm.image_key : null,
        p_image_path: imagePath,
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

  async function savePhoto() {
    if (!editingProduct) return
    setSavingPhoto(true)
    setFeedback({ type: '', message: '' })
    try {
      if (editPhotoMode === 'upload' && !editPhotoFile) {
        throw new Error('Selecione o arquivo da nova foto para enviar.')
      }
      let imagePath = null
      if (editPhotoMode === 'upload' && editPhotoFile) {
        imagePath = await uploadProductPhoto(editPhotoFile, editingProduct.slug)
      }
      const { error } = await supabase.rpc('update_vh_catalog_photo', {
        p_product_id: editingProduct.id,
        p_image_key: editPhotoMode === 'fixed' ? editPhotoKey : null,
        p_image_path: imagePath,
        p_request_id: crypto.randomUUID(),
      })
      if (error) throw error
      setEditPhotoFile(null)
      setFeedback({ type: 'success', message: 'Foto do modelo atualizada.' })
      await load()
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Não foi possível trocar a foto.' })
    } finally {
      setSavingPhoto(false)
    }
  }

  async function archiveProduct(product) {
    if (!window.confirm(`Arquivar "${product.name}"? Ele sai da vitrine, mas continua salvo e pode ser restaurado depois.`)) return
    setArchivingId(product.id)
    setFeedback({ type: '', message: '' })
    try {
      const { error } = await supabase.rpc('archive_vh_catalog_product', {
        p_product_id: product.id,
        p_request_id: crypto.randomUUID(),
      })
      if (error) throw error
      setFeedback({ type: 'success', message: `"${product.name}" foi arquivado e saiu da vitrine.` })
      if (editingProduct?.id === product.id) closeForm()
      await load()
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Não foi possível arquivar o modelo.' })
    } finally {
      setArchivingId(null)
    }
  }

  async function restoreProduct(product) {
    setArchivingId(product.id)
    setFeedback({ type: '', message: '' })
    try {
      const { error } = await supabase.rpc('restore_vh_catalog_product', {
        p_product_id: product.id,
        p_request_id: crypto.randomUUID(),
      })
      if (error) throw error
      setFeedback({ type: 'success', message: `"${product.name}" foi restaurado como rascunho. Revise preço e publicação.` })
      await load()
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Não foi possível restaurar o modelo.' })
    } finally {
      setArchivingId(null)
    }
  }

  return <div className="page-content">
    <div className="page-heading">
      <div>
        <span className="eyebrow">Catálogo fixo</span>
        <h1>Produtos e preços</h1>
        <p>Cadastre modelos com foto fixa ou enviada na hora, e controle preço, promoção e publicação na vitrine.</p>
      </div><button className="primary-button page-action" type="button" onClick={openCreate}>＋ Novo modelo</button>
    </div>
    {feedback.message && <div className={`alert ${feedback.type === 'error' ? 'error' : 'success'} inline-alert`} role="alert"><strong>{feedback.type === 'error' ? 'Atenção' : 'Tudo certo'}</strong><span>{feedback.message}</span></div>}

    {creating && <form className="panel form-panel quick-product-form" onSubmit={saveNew}>
      <div className="panel-heading"><div><span className="eyebrow">Cadastro rápido</span><h2>Novo modelo</h2><p>Escolha uma foto já versionada no projeto ou envie uma foto nova. O identificador será criado automaticamente pela marca e pelo nome.</p></div><button type="button" className="secondary-button" onClick={closeCreate}>Cancelar</button></div>
      <div className="form-grid">
        <label>Nome do modelo<input name="name" required value={newForm.name} onChange={updateNew} placeholder="Ex.: Campus 00s" /></label>
        <label>Marca<input name="brand" list="vh-brand-options" required value={newForm.brand} onChange={updateNew} placeholder="Ex.: Adidas" /></label>
        <label>Categoria<input name="category" list="vh-category-options" required value={newForm.category} onChange={updateNew} placeholder="Ex.: Lifestyle" /></label>
        <label>Preço normal (de)<input type="number" name="sale_price" min="0" step="0.01" required value={newForm.sale_price} onChange={updateNew} placeholder="0,00" /></label>
        <label>Preço promocional (por)<input type="number" name="promotional_price" min="0" step="0.01" value={newForm.promotional_price} onChange={updateNew} placeholder="Opcional" /></label>
        <label>Ordem na vitrine<input type="number" name="sort_order" min="0" step="1" value={newForm.sort_order} onChange={updateNew} /></label>
        <label className="checkbox-label"><input type="checkbox" name="active" checked={newForm.active} onChange={updateNew} /> Publicar na vitrine</label>
        <label className="checkbox-label"><input type="checkbox" name="featured" checked={newForm.featured} onChange={updateNew} /> Destacar modelo</label>
      </div>
      <div className="photo-source-toggle" role="radiogroup" aria-label="Origem da foto">
        <label className="checkbox-label"><input type="radio" name="newPhotoMode" checked={newPhotoMode === 'fixed'} onChange={() => setNewPhotoMode('fixed')} /> Foto já no catálogo</label>
        <label className="checkbox-label"><input type="radio" name="newPhotoMode" checked={newPhotoMode === 'upload'} onChange={() => setNewPhotoMode('upload')} /> Enviar foto nova</label>
      </div>
      {newPhotoMode === 'fixed'
        ? <label>Foto fixa<select name="image_key" value={newForm.image_key} onChange={updateNew}>{vhCatalogAssetOptions.map((asset) => <option key={asset.key} value={asset.key}>{asset.key}</option>)}</select></label>
        : <label>Arquivo da foto (JPEG, PNG ou WebP, até 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setNewPhotoFile(event.target.files?.[0] || null)} /></label>}
      <label className="wide-field">Descrição<textarea name="description" rows="3" value={newForm.description} onChange={updateNew} placeholder="Informação curta para a página do produto (opcional)" /></label>
      <datalist id="vh-brand-options">{brandOptions.map((brand) => <option key={brand} value={brand} />)}</datalist><datalist id="vh-category-options">{categoryOptions.map((category) => <option key={category} value={category} />)}</datalist>
      <p className="field-help">Para aparecer no site, informe o preço normal e marque “Publicar na vitrine”. Se preencher o promocional, o preço normal será exibido como valor anterior.</p>
      <div className="form-actions"><button className="primary-button" disabled={saving}>{saving ? 'Cadastrando…' : 'Cadastrar modelo'}</button></div>
    </form>}

    <section className="metric-grid profit-metrics">
      <article className="metric-card gold"><div className="metric-top"><span>Modelos ativos</span><i>◇</i></div><strong>{loading ? '—' : activeProducts.length}</strong><small>Cadastrados e não arquivados</small></article>
      <article className="metric-card lavender"><div className="metric-top"><span>Publicados</span><i>↗</i></div><strong>{loading ? '—' : publishedCount}</strong><small>Modelos com preço e publicação ativos</small></article>
      <article className="metric-card blue"><div className="metric-top"><span>Sem preço</span><i>R$</i></div><strong>{loading ? '—' : activeProducts.filter((product) => !Number(product.sale_price)).length}</strong><small>Preencha antes de publicar</small></article>
      <article className="metric-card"><div className="metric-top"><span>Arquivados</span><i>⌫</i></div><strong>{loading ? '—' : archivedCount}</strong><small>Fora da vitrine, podem ser restaurados</small></article>
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
      <p className="field-help">A publicação exige preço de venda maior que zero.</p>
      <div className="form-actions">
        <button className="primary-button" disabled={saving}>{saving ? 'Salvando…' : 'Salvar valores'}</button>
        <button type="button" className="secondary-button" disabled={archivingId === editingProduct.id} onClick={() => archiveProduct(editingProduct)}>{archivingId === editingProduct.id ? 'Arquivando…' : 'Arquivar modelo'}</button>
      </div>

      <div className="panel-heading photo-swap-heading"><div><span className="eyebrow">Foto do modelo</span><h3>Trocar foto</h3></div></div>
      <div className="photo-source-toggle" role="radiogroup" aria-label="Origem da nova foto">
        <label className="checkbox-label"><input type="radio" name="editPhotoMode" checked={editPhotoMode === 'fixed'} onChange={() => setEditPhotoMode('fixed')} /> Escolher foto já no catálogo</label>
        <label className="checkbox-label"><input type="radio" name="editPhotoMode" checked={editPhotoMode === 'upload'} onChange={() => setEditPhotoMode('upload')} /> Enviar foto nova</label>
      </div>
      {editPhotoMode === 'fixed'
        ? <label>Foto fixa<select value={editPhotoKey} onChange={(event) => setEditPhotoKey(event.target.value)}>{vhCatalogAssetOptions.map((asset) => <option key={asset.key} value={asset.key}>{asset.key}</option>)}</select></label>
        : <label>Arquivo da foto (JPEG, PNG ou WebP, até 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setEditPhotoFile(event.target.files?.[0] || null)} /></label>}
      <div className="form-actions"><button type="button" className="secondary-button" disabled={savingPhoto} onClick={savePhoto}>{savingPhoto ? 'Enviando…' : 'Salvar nova foto'}</button></div>
    </form>}

    <section className="panel list-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">{showArchived ? 'Arquivados' : 'Fotos versionadas'}</span><h2>{filtered.length} {filtered.length === 1 ? 'modelo' : 'modelos'}</h2></div>
        <div className="list-panel-actions">
          <label className="checkbox-label"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Mostrar arquivados</label>
          <label className="search-field"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar modelo, marca ou categoria" /></label>
        </div>
      </div>
      {loading ? <div className="loading-row">Carregando catálogo…</div> : filtered.length === 0 ? <div className="empty-table"><span className="empty-icon">◇</span><strong>Nenhum modelo encontrado</strong><p>{showArchived ? 'Nenhum modelo arquivado no momento.' : 'Cadastre o próximo modelo pelo botão “Novo modelo”.'}</p></div> : <div className="product-grid">{filtered.map((product) => <article className="product-card" key={product.id}>
        {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <div className="product-placeholder">Foto fixa não mapeada</div>}
        <div className="product-card-body"><div className="product-title"><strong>{product.name}</strong><span>{product.brand} · {product.category}</span></div><div className="product-prices"><strong>{currentPrice(product) ? money(currentPrice(product)) : 'Preço pendente'}</strong>{product.promotional_price ? <small>De {money(product.sale_price)}</small> : <small>Preço definido pelo master</small>}</div><div className={product.archived_at ? 'stock-low' : product.active ? 'stock-ok' : 'stock-low'}>{product.archived_at ? 'Arquivado' : product.active ? 'Publicado na vitrine' : 'Rascunho'}{product.featured ? ' · Destaque' : ''}</div><div className="row-actions">{product.archived_at
          ? <button type="button" className="secondary-button compact-button" disabled={archivingId === product.id} onClick={() => restoreProduct(product)}>{archivingId === product.id ? 'Restaurando…' : 'Restaurar'}</button>
          : <>
              <button type="button" className="secondary-button compact-button" disabled={saving} onClick={() => editProduct(product)}>Editar valores</button>
              <button type="button" className="secondary-button compact-button" disabled={archivingId === product.id} onClick={() => archiveProduct(product)}>{archivingId === product.id ? 'Arquivando…' : 'Arquivar'}</button>
            </>}</div></div>
      </article>)}</div>}
    </section>
  </div>
}
