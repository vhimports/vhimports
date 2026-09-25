import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { money } from '../lib/format'
import { convertImageForDownload, downloadName, MAX_SOURCE_IMAGE_BYTES, normalizeImage } from '../lib/imageProcessing'
import { suggestedSalePrice } from '../lib/estimatedProfit'

const blank = { name: '', sku: '', marca_id: '', category_id: '', supplier_id: '', material: 'Tênis importado', purity: '', weight_grams: '', cost_price: '', sale_price: '', promotional_price: '', minimum_stock: '0', description: '', care_instructions: '' }

function currentSalePrice(product) { return Number(product.promotional_price || product.sale_price || 0) }
function estimatedProfit(product) {
  const sale = currentSalePrice(product)
  const cost = Number(product.cost_price || 0)
  return sale > 0 && cost > 0 ? sale - cost : null
}
function estimatedMargin(product) {
  const sale = currentSalePrice(product)
  const profit = estimatedProfit(product)
  return sale > 0 && profit != null ? (profit / sale) * 100 : null
}

export function ProductsPage() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [form, setForm] = useState(blank)
  const [image, setImage] = useState(null)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [downloading, setDownloading] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [stockProduct, setStockProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })
  const fileInput = useRef(null)

  async function load() {
    setLoading(true)
    const [productResult, stockResult, categoryResult, supplierResult, brandResult] = await Promise.all([
      supabase.from('produtos').select('id,name,sku,marca_id,marca:marcas(id,name),category_id,supplier_id,material,purity,weight_grams,cost_price,sale_price,promotional_price,minimum_stock,description,care_instructions,active,created_at,imagens_produtos(storage_path,is_cover)').eq('active', true).order('name'),
      supabase.from('estoque_produtos').select('id,current_stock'),
      supabase.from('categorias').select('id,name').eq('active', true).order('name'),
      supabase.from('fornecedores').select('id,name').eq('active', true).order('name'),
      supabase.from('marcas').select('id,name').eq('active', true).order('sort_order').order('name'),
    ])
    const error = [productResult, stockResult, categoryResult, supplierResult, brandResult].find((result) => result.error)?.error
    if (error) setFeedback({ type: 'error', message: 'Não foi possível carregar o catálogo.' })
    const stocks = new Map((stockResult.data ?? []).map((row) => [row.id, Number(row.current_stock)]))
    const mapped = await Promise.all((productResult.data ?? []).map(async (product) => {
      const cover = product.imagens_produtos?.find((item) => item.is_cover) ?? product.imagens_produtos?.[0]
      let imageUrl = ''
      if (cover?.storage_path) imageUrl = (await supabase.storage.from('product-images').createSignedUrl(cover.storage_path, 3600)).data?.signedUrl || ''
      return { ...product, current_stock: stocks.get(product.id) ?? 0, imageUrl }
    }))
    setProducts(mapped)
    setCategories(categoryResult.data ?? [])
    setSuppliers(supplierResult.data ?? [])
    setBrands(brandResult.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return products
    return products.filter((product) => [product.name, product.sku, product.material, product.marca?.name].some((value) => value?.toLocaleLowerCase('pt-BR').includes(term)))
  }, [products, search])

  const profitSummary = useMemo(() => {
    const eligible = products.filter((product) => estimatedProfit(product) != null)
    const averageProfit = eligible.length ? eligible.reduce((sum, product) => sum + estimatedProfit(product), 0) / eligible.length : null
    const averageMargin = eligible.length ? eligible.reduce((sum, product) => sum + estimatedMargin(product), 0) / eligible.length : null
    const stockProfit = eligible.reduce((sum, product) => sum + estimatedProfit(product) * Number(product.current_stock || 0), 0)
    return { eligibleCount: eligible.length, averageProfit, averageMargin, stockProfit }
  }, [products])

  function update(event) { const { name, value } = event.target; setForm((current) => ({ ...current, [name]: value })) }

  async function save(event) {
    event.preventDefault()
    if (image && image.size > MAX_SOURCE_IMAGE_BYTES) {
      setFeedback({ type: 'error', message: 'A imagem original deve ter no máximo 25 MiB para ser processada.' }); return
    }
    setSaving(true)
    setFeedback({ type: '', message: '' })
    const payload = { name: form.name.trim(), sku: form.sku.trim() || null, marca_id: form.marca_id || null, category_id: form.category_id || null, supplier_id: form.supplier_id || null, material: form.material.trim() || 'Tênis importado', purity: form.purity ? Number(form.purity) : null, weight_grams: form.weight_grams ? Number(form.weight_grams) : null, cost_price: Number(form.cost_price || 0), sale_price: Number(form.sale_price || 0), promotional_price: form.promotional_price ? Number(form.promotional_price) : null, minimum_stock: Number(form.minimum_stock || 0), description: form.description.trim() || null, care_instructions: form.care_instructions.trim() || null }
    const query = editingId ? supabase.from('produtos').update(payload).eq('id', editingId) : supabase.from('produtos').insert(payload)
    const { data, error } = await query.select('id').single()
    if (error) {
      setFeedback({ type: 'error', message: 'Não foi possível salvar o tênis. Verifique SKU, preços e campos obrigatórios.' })
    } else {
      const imageError = image && data?.id ? await uploadImage(data.id, image) : null
      setForm(blank); setImage(null); setShowForm(false); setEditingId(null)
      setFeedback(imageError ? { type: 'error', message: imageError } : { type: 'success', message: 'Tênis salvo. O histórico dos pedidos foi preservado.' }); await load()
    }
    setSaving(false)
  }

  async function uploadImage(productId, file) {
    let normalized
    try {
      normalized = await normalizeImage(file)
    } catch (error) {
      const message = {
        'image-source-too-large': 'A foto não foi enviada: o arquivo original ultrapassa 25 MiB.',
        'image-type-unsupported': 'A foto não foi enviada: escolha um arquivo de imagem.',
        'image-output-too-large': 'A foto não foi enviada: mesmo otimizada, ela continua maior que 5 MiB.',
      }[error.message] || 'A foto não foi enviada: o navegador não conseguiu ler este formato.'
      return `Tênis salvo, mas ${message.charAt(0).toLowerCase()}${message.slice(1)}`
    }
    const path = `${productId}/${crypto.randomUUID()}.webp`
    const upload = await supabase.storage.from('product-images').upload(path, normalized.file, { contentType: normalized.file.type, upsert: false })
    if (upload.error) return 'Tênis salvo, mas a foto otimizada não foi enviada. Use Editar para tentar adicionar a foto novamente.'
    const { error } = await supabase.from('imagens_produtos').insert({ product_id: productId, storage_path: path, is_cover: !editingId, sort_order: 0 })
    if (error) {
      await supabase.storage.from('product-images').remove([path])
      return 'Tênis salvo, mas a foto não foi vinculada. Tente adicionar a foto em Editar.'
    }
    return null
  }

  function editProduct(product) {
    setEditingId(product.id)
    setForm(Object.fromEntries(Object.keys(blank).map((key) => [key, product[key] == null ? '' : String(product[key])])))
    setImage(null); if (fileInput.current) fileInput.current.value = ''
    setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function downloadPhoto(photo, format) {
    const downloadKey = `${photo.storage_path}:${format}`
    setDownloading(downloadKey)
    try {
      const { data, error } = await supabase.storage.from('product-images').download(photo.storage_path)
      if (error) throw error
      const converted = await convertImageForDownload(data, format)
      const url = URL.createObjectURL(converted)
      const link = document.createElement('a')
      link.href = url; link.download = downloadName(photo.storage_path, format)
      document.body.appendChild(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch {
      setFeedback({ type: 'error', message: 'Não foi possível baixar a foto. Verifique sua sessão e tente novamente.' })
    } finally { setDownloading('') }
  }

  async function adjustStock(event) {
    event.preventDefault()
    setSaving(true)
    const data = new FormData(event.currentTarget)
    const size = String(data.get('size') || '').trim()
    const rpc = size ? 'adjust_size_stock' : 'adjust_stock'
    const payload = size
      ? { p_product_id: stockProduct.id, p_size: size, p_quantity: Number(data.get('quantity')), p_direction: data.get('direction'), p_reason: String(data.get('reason')).trim(), p_request_id: crypto.randomUUID() }
      : { p_product_id: stockProduct.id, p_quantity: Number(data.get('quantity')), p_direction: data.get('direction'), p_reason: String(data.get('reason')).trim(), p_request_id: crypto.randomUUID() }
    const { error } = await supabase.rpc(rpc, payload)
    if (error) setFeedback({ type: 'error', message: 'Não foi possível ajustar o estoque. Informe quantidade e motivo.' })
    else { setStockProduct(null); setFeedback({ type: 'success', message: 'Movimentação de estoque registrada.' }); await load() }
    setSaving(false)
  }

  return <div className="page-content"><div className="page-heading"><div><span className="eyebrow">Catálogo</span><h1>Produtos e estoque</h1><p>Cadastre modelos, marcas, preços, imagens, numerações e saldo.</p></div><button className="primary-button page-action" onClick={() => { setEditingId(null); setForm(blank); setImage(null); if (fileInput.current) fileInput.current.value = ''; setShowForm((visible) => !visible) }}>{showForm ? 'Fechar cadastro' : 'Adicionar tênis'} <span>＋</span></button></div>{feedback.message && <div className={`alert ${feedback.type === 'error' ? 'error' : 'success'} inline-alert`}><strong>{feedback.type === 'error' ? 'Atenção' : 'Tudo certo'}</strong><span>{feedback.message}</span></div>}
    <section className="metric-grid profit-metrics"><article className="metric-card gold"><div className="metric-top"><span>Lucro médio por modelo</span><i>↗</i></div><strong>{profitSummary.averageProfit == null ? '—' : money(profitSummary.averageProfit)}</strong><small>{profitSummary.eligibleCount ? `${profitSummary.eligibleCount} produto(s) com custo e preço` : 'Informe custo e preço para calcular'}</small></article><article className="metric-card lavender"><div className="metric-top"><span>Margem média</span><i>%</i></div><strong>{profitSummary.averageMargin == null ? '—' : `${profitSummary.averageMargin.toFixed(1)}%`}</strong><small>Margem estimada no preço vigente</small></article><article className="metric-card peach"><div className="metric-top"><span>Lucro estimado em estoque</span><i>◇</i></div><strong>{profitSummary.eligibleCount ? money(profitSummary.stockProfit) : '—'}</strong><small>Se todo o estoque elegível for vendido</small></article></section>
    {showForm && <div className="suggested-price-note"><strong>Sugestão pela regra de preço VH Imports</strong><span>Custo + 140% do custo + R$ 3,00 de operação = {suggestedSalePrice(form.cost_price) == null ? 'informe o custo do tênis' : money(suggestedSalePrice(form.cost_price))}.</span><small>É somente uma referência; o preço de venda continua sendo informado e confirmado por você.</small></div>}
    {showForm && <form className="panel form-panel" onSubmit={save}><div className="panel-heading"><div><span className="eyebrow">Cadastro de tênis</span><h2>{editingId ? 'Editar tênis' : 'Novo tênis'}</h2></div></div><div className="form-grid"><label>Nome do modelo<input name="name" value={form.name} onChange={update} required placeholder="Ex.: Air Max 1" /></label><label>SKU<input name="sku" value={form.sku} onChange={update} placeholder="Opcional" /></label><label>Marca<select name="marca_id" value={form.marca_id} onChange={update}><option value="">Selecione</option>{brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Categoria<select name="category_id" value={form.category_id} onChange={update}><option value="">Selecione</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Fornecedor<select name="supplier_id" value={form.supplier_id} onChange={update}><option value="">Selecione</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Linha / material<input name="material" value={form.material} onChange={update} /></label><label>Estoque mínimo<input type="number" name="minimum_stock" min="0" step="1" value={form.minimum_stock} onChange={update} /></label><label>Custo de aquisição<input type="number" name="cost_price" min="0" step="0.01" value={form.cost_price} onChange={update} placeholder="0,00" /></label><label>Preço de venda<input type="number" name="sale_price" min="0" step="0.01" value={form.sale_price} onChange={update} required placeholder="0,00" /></label><label>Preço promocional<input type="number" name="promotional_price" min="0" step="0.01" value={form.promotional_price} onChange={update} placeholder="Opcional" /></label><label>Imagem do tênis<input type="file" ref={fileInput} accept="image/*" onChange={(event) => setImage(event.target.files?.[0] ?? null)} /><small className="field-help">A foto será otimizada para WebP, até 2400 px e 5 MiB. Formatos dependem do suporte do navegador.</small></label><label>Descrição<textarea name="description" rows="2" value={form.description} onChange={update} placeholder="Descrição comercial" /></label><label>Cuidados<textarea name="care_instructions" rows="2" value={form.care_instructions} onChange={update} placeholder="Instruções de cuidado" /></label></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Salvando…' : 'Salvar tênis'}</button></div></form>}
    <section className="panel list-panel"><div className="panel-heading"><div><span className="eyebrow">Estoque atual</span><h2>{products.length} {products.length === 1 ? 'tênis ativo' : 'tênis ativos'}</h2></div><label className="search-field"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar modelo, marca ou SKU" /></label></div>{loading ? <div className="loading-row">Carregando catálogo…</div> : filtered.length === 0 ? <div className="empty-table"><span className="empty-icon">◇</span><strong>Nenhum tênis cadastrado</strong><p>Adicione o primeiro modelo para começar o controle de estoque.</p></div> : <div className="product-grid">{filtered.map((product) => { const profit = estimatedProfit(product); const margin = estimatedMargin(product); return <article className="product-card" key={product.id}>{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <div className="product-placeholder">◇</div>}<div className="product-card-body"><div className="product-title"><strong>{product.name}</strong><span>{product.sku || 'Sem SKU'}</span></div><div className="product-prices"><strong>{money(currentSalePrice(product))}</strong><small>Custo {money(product.cost_price)}</small></div><div className="product-profit"><span>Lucro estimado</span><strong>{profit == null ? 'Informe o custo' : money(profit)}</strong><small>{margin == null ? 'Preço e custo necessários' : `${margin.toFixed(1)}% de margem · preço vigente`}</small></div><div className={product.current_stock <= product.minimum_stock ? 'stock-low' : 'stock-ok'}>{product.current_stock} unidade(s) em estoque <small>mín. {product.minimum_stock}</small></div><div className="row-actions"><button className="secondary-button compact-button" disabled={saving} onClick={() => editProduct(product)}>Editar</button><button className="secondary-button compact-button" onClick={() => setStockProduct(product)}>Ajustar estoque</button>{product.imagens_produtos?.map((photo, index) => <span className="download-actions" key={photo.storage_path}><button className="text-button" disabled={!!downloading} onClick={() => downloadPhoto(photo, 'jpg')}>{downloading === `${photo.storage_path}:jpg` ? 'Baixando…' : `Baixar JPG ${index + 1}`}</button><button className="text-button" disabled={!!downloading} onClick={() => downloadPhoto(photo, 'png')}>{downloading === `${photo.storage_path}:png` ? 'Baixando…' : `Baixar PNG ${index + 1}`}</button></span>)}</div></div></article> })}</div>}</section>
    {stockProduct && <div className="dialog-backdrop"><div className="dialog-card"><button className="dialog-close" onClick={() => setStockProduct(null)} aria-label="Fechar">×</button><span className="eyebrow">Movimentação</span><h2>Ajustar estoque</h2><p className="auth-help">{stockProduct.name} · saldo atual {stockProduct.current_stock} unidade(s).</p><form className="auth-form" onSubmit={adjustStock}><label>Numeração<input name="size" placeholder="Opcional, ex.: 39" /></label><label>Operação<select name="direction" defaultValue="in"><option value="in">Entrada</option><option value="out">Saída</option></select></label><label>Quantidade<input name="quantity" type="number" min="1" step="1" required /></label><label>Motivo<input name="reason" minLength="3" required placeholder="Compra, perda, ajuste…" /></label><button className="primary-button" disabled={saving}>{saving ? 'Registrando…' : 'Registrar ajuste'}</button></form></div></div>}
  </div>
}

