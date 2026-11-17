import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const blank = { title: '', detail: '', tone: 'dark', sort_order: '0', active: true }

const toneOptions = [
  { value: 'dark', label: 'Escuro' },
  { value: 'lime', label: 'Verde-lima' },
  { value: 'orange', label: 'Laranja' },
  { value: 'blue', label: 'Azul' },
]

export function SectionsPage() {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [archivingId, setArchivingId] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingSection, setEditingSection] = useState(null)
  const [form, setForm] = useState(blank)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('vh_catalogo_secoes')
      .select('id,title,detail,tone,sort_order,active,archived_at')
      .order('sort_order')
      .order('title')
    if (error) {
      setFeedback({ type: 'error', message: 'Não foi possível carregar as seções da vitrine.' })
      setSections([])
    } else {
      setSections(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const visibleSections = useMemo(
    () => sections.filter((section) => (showArchived ? Boolean(section.archived_at) : !section.archived_at)),
    [sections, showArchived],
  )
  const activeCount = sections.filter((section) => !section.archived_at && section.active).length
  const archivedCount = sections.filter((section) => section.archived_at).length

  function update(event) {
    const { name, value, type, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  function openCreate() {
    setEditingSection(null)
    setForm({ ...blank, sort_order: String((sections.length + 1) * 100) })
    setCreating(true)
    setFeedback({ type: '', message: '' })
  }

  function closeCreate() {
    setCreating(false)
    setForm(blank)
  }

  function openEdit(section) {
    setCreating(false)
    setEditingSection(section)
    setForm({
      title: section.title,
      detail: section.detail,
      tone: section.tone,
      sort_order: String(section.sort_order ?? 0),
      active: Boolean(section.active),
    })
    setFeedback({ type: '', message: '' })
  }

  function closeEdit() {
    setEditingSection(null)
    setForm(blank)
  }

  async function createSection(event) {
    event.preventDefault()
    setSaving(true)
    setFeedback({ type: '', message: '' })
    try {
      const sortOrder = Number(form.sort_order || 0)
      if (!form.title.trim() || !form.detail.trim() || !Number.isFinite(sortOrder) || sortOrder < 0) {
        throw new Error('Informe título, descrição e ordem válidos.')
      }
      const { error } = await supabase.rpc('create_vh_catalog_section', {
        p_title: form.title.trim(),
        p_detail: form.detail.trim(),
        p_tone: form.tone,
        p_sort_order: sortOrder,
        p_active: Boolean(form.active),
        p_request_id: crypto.randomUUID(),
      })
      if (error) throw error
      closeCreate()
      setFeedback({ type: 'success', message: 'Seção criada e publicada na home.' })
      await load()
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Não foi possível criar a seção.' })
    } finally {
      setSaving(false)
    }
  }

  async function saveSection(event) {
    event.preventDefault()
    if (!editingSection) return
    setSaving(true)
    setFeedback({ type: '', message: '' })
    try {
      const sortOrder = Number(form.sort_order || 0)
      if (!form.title.trim() || !form.detail.trim() || !Number.isFinite(sortOrder) || sortOrder < 0) {
        throw new Error('Informe título, descrição e ordem válidos.')
      }
      const { error } = await supabase.rpc('update_vh_catalog_section', {
        p_section_id: editingSection.id,
        p_title: form.title.trim(),
        p_detail: form.detail.trim(),
        p_tone: form.tone,
        p_sort_order: sortOrder,
        p_active: Boolean(form.active),
        p_request_id: crypto.randomUUID(),
      })
      if (error) throw error
      closeEdit()
      setFeedback({ type: 'success', message: 'Seção atualizada.' })
      await load()
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Não foi possível atualizar a seção.' })
    } finally {
      setSaving(false)
    }
  }

  async function archiveSection(section) {
    if (!window.confirm(`Arquivar a seção "${section.title}"? Ela some da home, mas pode ser restaurada depois.`)) return
    setArchivingId(section.id)
    setFeedback({ type: '', message: '' })
    try {
      const { error } = await supabase.rpc('archive_vh_catalog_section', {
        p_section_id: section.id,
        p_request_id: crypto.randomUUID(),
      })
      if (error) throw error
      if (editingSection?.id === section.id) closeEdit()
      setFeedback({ type: 'success', message: `Seção "${section.title}" arquivada.` })
      await load()
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Não foi possível arquivar a seção.' })
    } finally {
      setArchivingId(null)
    }
  }

  async function restoreSection(section) {
    setArchivingId(section.id)
    setFeedback({ type: '', message: '' })
    try {
      const { error } = await supabase.rpc('restore_vh_catalog_section', {
        p_section_id: section.id,
        p_request_id: crypto.randomUUID(),
      })
      if (error) throw error
      setFeedback({ type: 'success', message: `Seção "${section.title}" restaurada como rascunho.` })
      await load()
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Não foi possível restaurar a seção.' })
    } finally {
      setArchivingId(null)
    }
  }

  return <div className="page-content">
    <div className="page-heading">
      <div>
        <span className="eyebrow">Vitrine · home</span>
        <h1>Seções da vitrine</h1>
        <p>Controle os blocos de "Para onde você vai?" exibidos na home — crie, edite, reordene ou arquive sem depender de alteração no código.</p>
      </div><button className="primary-button page-action" type="button" onClick={openCreate}>＋ Nova seção</button>
    </div>
    {feedback.message && <div className={`alert ${feedback.type === 'error' ? 'error' : 'success'} inline-alert`} role="alert"><strong>{feedback.type === 'error' ? 'Atenção' : 'Tudo certo'}</strong><span>{feedback.message}</span></div>}

    {creating && <form className="panel form-panel" onSubmit={createSection}>
      <div className="panel-heading"><div><span className="eyebrow">Nova seção</span><h2>Bloco da home</h2><p>Aparece no grid "Para onde você vai?" assim que publicada.</p></div><button type="button" className="secondary-button" onClick={closeCreate}>Cancelar</button></div>
      <div className="form-grid">
        <label>Título<input name="title" required value={form.title} onChange={update} placeholder="Ex.: Skate" /></label>
        <label>Cor do bloco<select name="tone" value={form.tone} onChange={update}>{toneOptions.map((tone) => <option key={tone.value} value={tone.value}>{tone.label}</option>)}</select></label>
        <label>Ordem na home<input type="number" name="sort_order" min="0" step="10" value={form.sort_order} onChange={update} /></label>
        <label className="checkbox-label"><input type="checkbox" name="active" checked={form.active} onChange={update} /> Publicar na home</label>
      </div>
      <label className="wide-field">Descrição curta<input name="detail" required value={form.detail} onChange={update} placeholder="Ex.: Pranchas, muros e a próxima aterrissagem." /></label>
      <div className="form-actions"><button className="primary-button" disabled={saving}>{saving ? 'Criando…' : 'Criar seção'}</button></div>
    </form>}

    {editingSection && <form className="panel form-panel" onSubmit={saveSection}>
      <div className="panel-heading"><div><span className="eyebrow">Editar seção</span><h2>{editingSection.title}</h2></div><button type="button" className="secondary-button" onClick={closeEdit}>Cancelar</button></div>
      <div className="form-grid">
        <label>Título<input name="title" required value={form.title} onChange={update} /></label>
        <label>Cor do bloco<select name="tone" value={form.tone} onChange={update}>{toneOptions.map((tone) => <option key={tone.value} value={tone.value}>{tone.label}</option>)}</select></label>
        <label>Ordem na home<input type="number" name="sort_order" min="0" step="10" value={form.sort_order} onChange={update} /></label>
        <label className="checkbox-label"><input type="checkbox" name="active" checked={form.active} onChange={update} /> Publicar na home</label>
      </div>
      <label className="wide-field">Descrição curta<input name="detail" required value={form.detail} onChange={update} /></label>
      <div className="form-actions">
        <button className="primary-button" disabled={saving}>{saving ? 'Salvando…' : 'Salvar seção'}</button>
        <button type="button" className="secondary-button" disabled={archivingId === editingSection.id} onClick={() => archiveSection(editingSection)}>{archivingId === editingSection.id ? 'Arquivando…' : 'Arquivar seção'}</button>
      </div>
    </form>}

    <section className="metric-grid profit-metrics">
      <article className="metric-card gold"><div className="metric-top"><span>Publicadas</span><i>◇</i></div><strong>{loading ? '—' : activeCount}</strong><small>Visíveis na home agora</small></article>
      <article className="metric-card"><div className="metric-top"><span>Arquivadas</span><i>⌫</i></div><strong>{loading ? '—' : archivedCount}</strong><small>Fora da home, podem ser restauradas</small></article>
    </section>

    <section className="panel list-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">{showArchived ? 'Arquivadas' : 'Blocos da home'}</span><h2>{visibleSections.length} {visibleSections.length === 1 ? 'seção' : 'seções'}</h2></div>
        <label className="checkbox-label"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Mostrar arquivadas</label>
      </div>
      {loading ? <div className="loading-row">Carregando seções…</div> : visibleSections.length === 0 ? <div className="empty-table"><span className="empty-icon">◇</span><strong>Nenhuma seção encontrada</strong><p>{showArchived ? 'Nenhuma seção arquivada no momento.' : 'Crie a primeira seção pelo botão "Nova seção".'}</p></div> : <div className="product-grid">{visibleSections.map((section) => <article className={`product-card section-card section-tone-${section.tone}`} key={section.id}>
        <div className="product-card-body"><div className="product-title"><strong>{section.title}</strong><span>{section.detail}</span></div><div className={section.archived_at ? 'stock-low' : section.active ? 'stock-ok' : 'stock-low'}>{section.archived_at ? 'Arquivada' : section.active ? 'Publicada na home' : 'Rascunho'} · ordem {section.sort_order}</div><div className="row-actions">{section.archived_at
          ? <button type="button" className="secondary-button compact-button" disabled={archivingId === section.id} onClick={() => restoreSection(section)}>{archivingId === section.id ? 'Restaurando…' : 'Restaurar'}</button>
          : <>
              <button type="button" className="secondary-button compact-button" onClick={() => openEdit(section)}>Editar</button>
              <button type="button" className="secondary-button compact-button" disabled={archivingId === section.id} onClick={() => archiveSection(section)}>{archivingId === section.id ? 'Arquivando…' : 'Arquivar'}</button>
            </>}</div></div>
      </article>)}</div>}
    </section>
  </div>
}
