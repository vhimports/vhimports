import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { convertImageForDownload, downloadName } from '../lib/imageProcessing'

const labels = { suggestion: 'Sugestão', approved: 'Aprovado', scheduled: 'Agendado', published: 'Publicado', failed: 'Erro' }
const slotTimes = ['09:00', '11:30', '14:00', '17:00', '20:00']

function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function mondayOf(value) {
  const date = new Date(`${value}T12:00:00`)
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  return localDate(date)
}

function dateLabel(value) { return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(new Date(`${value}T12:00:00`)) }

function dateFromScheduled(value) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
  return `${parts.find((part) => part.type === 'year').value}-${parts.find((part) => part.type === 'month').value}-${parts.find((part) => part.type === 'day').value}`
}

function formatScheduled(value) { return value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Sem data definida' }

export function ContentPage({ session }) {
  const [posts, setPosts] = useState([])
  const [products, setProducts] = useState([])
  const [photoUrls, setPhotoUrls] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [weekStart, setWeekStart] = useState(mondayOf(localDate()))
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ product_id: '', caption: '', hashtags: '', scheduled_for: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState('')
  const [downloadFormat, setDownloadFormat] = useState('jpg')
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  async function load() {
    setLoading(true)
    const [postsResult, productsResult] = await Promise.all([
      supabase.from('publicacoes_conteudo').select('id,product_id,image_path,caption,hashtags,scheduled_for,status,created_at,produtos(name)').order('scheduled_for', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }),
      supabase.from('produtos').select('id,name,imagens_produtos(storage_path,is_cover,sort_order)').eq('active', true).order('name'),
    ])
    const error = [postsResult, productsResult].find((result) => result.error)?.error
    if (error) setFeedback({ type: 'error', message: 'Não foi possível carregar o calendário de conteúdo.' })
    const nextPosts = postsResult.data ?? []
    setPosts(nextPosts); setProducts(productsResult.data ?? [])
    const paths = [...new Set(nextPosts.map((post) => post.image_path).filter(Boolean))]
    const signed = await Promise.all(paths.map(async (path) => [path, (await supabase.storage.from('product-images').createSignedUrl(path, 3600)).data?.signedUrl || '']))
    setPhotoUrls(Object.fromEntries(signed)); setLoading(false)
  }

  useEffect(() => { load() }, [])

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${weekStart}T12:00:00`); date.setDate(date.getDate() + index)
    const key = localDate(date)
    return { key, label: dateLabel(key), posts: posts.filter((post) => post.scheduled_for && dateFromScheduled(post.scheduled_for) === key).sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for)) }
  }), [posts, weekStart])

  function update(event) { const { name, value } = event.target; setForm((current) => ({ ...current, [name]: value })) }

  async function scheduleWeek() {
    setSaving(true); setFeedback({ type: '', message: '' })
    const { data, error } = await supabase.rpc('generate_weekly_content_schedule', { p_week_start: weekStart, p_request_id: crypto.randomUUID() })
    if (error) setFeedback({ type: 'error', message: 'Não foi possível programar a semana. Confira se existem fotos cadastradas.' })
    else { setFeedback({ type: 'success', message: data.missing ? `Programação criada com ${data.created} foto(s). Faltaram ${data.missing} foto(s) únicas para completar 5 por dia.` : 'Semana programada com 5 fotos únicas por dia.' }); await load() }
    setSaving(false)
  }

  async function save(event) {
    event.preventDefault(); setSaving(true); setFeedback({ type: '', message: '' })
    const payload = { product_id: form.product_id || null, caption: form.caption.trim() || null, hashtags: form.hashtags.trim() || null, scheduled_for: form.scheduled_for ? new Date(form.scheduled_for).toISOString() : null }
    const query = editingId ? supabase.from('publicacoes_conteudo').update({ ...payload, status: 'suggestion', approved_by: null }).eq('id', editingId).neq('status', 'published') : supabase.from('publicacoes_conteudo').insert(payload)
    const { error } = await query.select('id').single()
    if (error) setFeedback({ type: 'error', message: 'Não foi possível salvar o conteúdo.' })
    else { setShowForm(false); setEditingId(null); setForm({ product_id: '', caption: '', hashtags: '', scheduled_for: '' }); setFeedback({ type: 'success', message: 'Conteúdo salvo como sugestão para aprovação.' }); await load() }
    setSaving(false)
  }

  async function updateStatus(post, status) {
    setSaving(true)
    const payload = status === 'approved' ? { status, approved_by: session.user.id } : { status }
    const { error } = await supabase.from('publicacoes_conteudo').update(payload).eq('id', post.id)
    if (error) setFeedback({ type: 'error', message: 'Não foi possível atualizar o status.' })
    else { setFeedback({ type: 'success', message: `Conteúdo marcado como ${labels[status].toLocaleLowerCase('pt-BR')}.` }); await load() }
    setSaving(false)
  }

  async function downloadDay(day) {
    const photos = day.posts.filter((post) => post.image_path)
    if (!photos.length) { setFeedback({ type: 'error', message: 'Este dia ainda não tem fotos programadas.' }); return }
    setDownloading(day.key)
    try {
      for (let index = 0; index < photos.length; index += 1) {
        const post = photos[index]
        const { data, error } = await supabase.storage.from('product-images').download(post.image_path)
        if (error) throw error
        const converted = await convertImageForDownload(data, downloadFormat)
        const link = document.createElement('a'); link.href = URL.createObjectURL(converted)
        link.download = `${day.key}-${String(index + 1).padStart(2, '0')}-${downloadName(post.produtos?.name || post.image_path, downloadFormat)}`
        document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(link.href), 10000)
        await new Promise((resolve) => window.setTimeout(resolve, 150))
      }
      setFeedback({ type: 'success', message: `${photos.length} foto(s) de ${day.label} enviadas para download.` })
    } catch { setFeedback({ type: 'error', message: 'Não foi possível baixar todas as fotos. Verifique sua sessão e tente novamente.' }) }
    finally { setDownloading('') }
  }

  function editPost(post) {
    const scheduled = post.scheduled_for ? new Date(post.scheduled_for) : null
    const local = scheduled ? new Date(scheduled.getTime() - scheduled.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''
    setEditingId(post.id); setForm({ product_id: post.product_id || '', caption: post.caption || '', hashtags: post.hashtags || '', scheduled_for: local }); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return <div className="page-content">
    <div className="page-heading"><div><span className="eyebrow">Planejamento</span><h1>Conteúdo Instagram</h1><p>Programe uma semana de fotos sem repetir imagens e baixe o material de cada dia.</p></div><div className="heading-actions"><button className="secondary-button" disabled={saving} onClick={() => { setEditingId(null); setForm({ product_id: '', caption: '', hashtags: '', scheduled_for: '' }); setShowForm((visible) => !visible) }}>{showForm ? 'Fechar conteúdo' : 'Novo conteúdo'} <span>＋</span></button><button className="primary-button page-action" disabled={saving} onClick={scheduleWeek}>{saving ? 'Programando…' : 'Programar esta semana'} <span>✦</span></button></div></div>
    {feedback.message && <div className={`alert ${feedback.type === 'error' ? 'error' : 'success'} inline-alert`}><strong>{feedback.type === 'error' ? 'Atenção' : 'Tudo certo'}</strong><span>{feedback.message}</span></div>}
    <section className="panel weekly-planner"><div className="panel-heading"><div><span className="eyebrow">Agenda semanal</span><h2>Fotos da semana</h2><p className="field-help">A seleção é aleatória no banco. Cada foto só pode aparecer uma vez nesta semana.</p></div><div className="planner-options"><label className="week-picker">Semana iniciando em<input type="date" value={weekStart} onChange={(event) => setWeekStart(mondayOf(event.target.value))} /></label><label className="week-picker">Formato<select value={downloadFormat} onChange={(event) => setDownloadFormat(event.target.value)}><option value="jpg">JPG</option><option value="png">PNG</option></select></label></div></div>{loading ? <div className="loading-row">Carregando agenda…</div> : <div className="week-grid">{days.map((day) => <article className="day-card" key={day.key}><div className="day-card-heading"><div><strong>{day.label}</strong><small>{day.posts.length}/5 fotos</small></div><button className="text-button" disabled={saving || downloading === day.key || !day.posts.length} onClick={() => downloadDay(day)}>{downloading === day.key ? 'Baixando…' : `Baixar ${downloadFormat.toUpperCase()}`}</button></div>{day.posts.length === 0 ? <div className="day-empty">Sem fotos programadas</div> : <div className="day-photo-list">{day.posts.map((post, index) => <div className="day-photo" key={post.id}>{post.image_path && (photoUrls[post.image_path] ? <img src={photoUrls[post.image_path]} alt="" /> : <div className="product-placeholder">◇</div>)}<span><strong>{post.produtos?.name || 'Foto sem produto'}</strong><small>{slotTimes[index] || formatScheduled(post.scheduled_for)} · {labels[post.status] || post.status}</small></span></div>)}</div>}</article>)}</div>}</section>
    {showForm && <form className="panel form-panel" onSubmit={save}><div className="panel-heading"><div><span className="eyebrow">Conteúdo manual</span><h2>{editingId ? 'Editar conteúdo' : 'Nova sugestão'}</h2></div></div><div className="form-grid"><label>Produto<select name="product_id" value={form.product_id} onChange={update}><option value="">Sem produto específico</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Data e hora<input type="datetime-local" name="scheduled_for" value={form.scheduled_for} onChange={update} /></label><label>Legenda<textarea name="caption" rows="3" value={form.caption} onChange={update} placeholder="Texto da publicação" /></label><label>Hashtags<textarea name="hashtags" rows="3" value={form.hashtags} onChange={update} placeholder="#vhimports #tenis" /></label></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Salvando…' : 'Salvar sugestão'}</button></div></form>}
    <section className="content-board"><div className="panel-heading"><div><span className="eyebrow">Histórico</span><h2>{posts.length} {posts.length === 1 ? 'publicação' : 'publicações'}</h2></div></div>{loading ? <div className="panel loading-row">Carregando conteúdo…</div> : posts.length === 0 ? <div className="panel empty-table"><span className="empty-icon">✦</span><strong>Nenhuma publicação criada</strong><p>Programe a semana para selecionar fotos automaticamente.</p></div> : posts.map((post) => <article className="panel content-card" key={post.id}>{post.image_path && photoUrls[post.image_path] && <img className="content-card-image" src={photoUrls[post.image_path]} alt="" />}<div className="content-card-top"><span className={`status-pill status-${post.status}`}>{labels[post.status] || post.status}</span><small>{formatScheduled(post.scheduled_for)}</small></div><h2>{post.produtos?.name || 'Conteúdo livre'}</h2><p>{post.caption || 'Sem legenda cadastrada.'}</p><small className="content-hashtags">{post.hashtags || 'Sem hashtags'}</small><div className="row-actions">{post.status !== 'published' && <button className="secondary-button compact-button" disabled={saving} onClick={() => editPost(post)}>Editar</button>}{post.status === 'suggestion' && <button className="secondary-button compact-button" onClick={() => updateStatus(post, 'approved')} disabled={saving}>Aprovar</button>}{post.status === 'approved' && <button className="primary-button compact-button" onClick={() => updateStatus(post, 'scheduled')} disabled={saving}>Agendar</button>}{post.status === 'scheduled' && <button className="secondary-button compact-button" onClick={() => updateStatus(post, 'published')} disabled={saving}>Marcar publicado</button>}</div></article>)}</section>
  </div>
}
