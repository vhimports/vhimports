import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const emptyForm = { name: '', phone: '', email: '', birth_date: '', whatsapp_opt_in: false }

export function CustomersPage() {
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  async function loadCustomers() {
    setLoading(true)
    const { data, error } = await supabase.from('clientes').select('id,name,phone,email,birth_date,whatsapp_opt_in,active,created_at').eq('active', true).order('name', { ascending: true })
    if (error) setFeedback({ type: 'error', message: 'Não foi possível carregar os clientes.' })
    else setCustomers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadCustomers() }, [])

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return customers
    return customers.filter((customer) => [customer.name, customer.phone, customer.email].some((value) => value?.toLocaleLowerCase('pt-BR').includes(term)))
  }, [customers, search])

  function updateField(event) {
    const { name, value, type, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  async function saveCustomer(event) {
    event.preventDefault()
    setFeedback({ type: '', message: '' })
    setSaving(true)
    const payload = { name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null, birth_date: form.birth_date || null, whatsapp_opt_in: form.whatsapp_opt_in }
    const query = editingId ? supabase.from('clientes').update(payload).eq('id', editingId) : supabase.from('clientes').insert(payload)
    const { error } = await query.select('id').single()
    if (error) setFeedback({ type: 'error', message: 'Não foi possível salvar o cliente. Confira os dados e tente novamente.' })
    else { setForm(emptyForm); setShowForm(false); setFeedback({ type: 'success', message: 'Cliente salvo. Os dados vinculados serão atualizados ao abrir as outras telas.' }); await loadCustomers() }
    setSaving(false)
  }

  return <div className="page-content">
    <div className="page-heading"><div><span className="eyebrow">Relacionamento</span><h1>Clientes</h1><p>Cadastre quem compra e acompanha cobranças da loja.</p></div><button className="primary-button page-action" onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm((visible) => !visible) }}>{showForm ? 'Fechar cadastro' : 'Novo cliente'} <span>＋</span></button></div>
    {feedback.message && <div className={`alert ${feedback.type === 'error' ? 'error' : 'success'} inline-alert`}><strong>{feedback.type === 'error' ? 'Atenção' : 'Tudo certo'}</strong><span>{feedback.message}</span></div>}
    {showForm && <form className="panel form-panel customer-form" onSubmit={saveCustomer}><div className="panel-heading"><div><span className="eyebrow">Cadastro rápido</span><h2>{editingId ? 'Editar cliente' : 'Novo cliente'}</h2></div></div><div className="form-grid"><label>Nome completo<input name="name" value={form.name} onChange={updateField} required placeholder="Nome do cliente" /></label><label>Telefone<input name="phone" value={form.phone} onChange={updateField} placeholder="(00) 00000-0000" /></label><label>E-mail<input type="email" name="email" value={form.email} onChange={updateField} placeholder="cliente@email.com" /></label><label>Data de aniversário<input type="date" name="birth_date" value={form.birth_date} onChange={updateField} /><small className="field-help">Opcional. Usada somente para avisos e contato manual de aniversário.</small></label><label className="checkbox-label"><input type="checkbox" name="whatsapp_opt_in" checked={form.whatsapp_opt_in} onChange={updateField} /> Cliente autorizou contato pelo WhatsApp</label></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm) }}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Salvando…' : 'Salvar cliente'}</button></div></form>}
    <section className="panel list-panel"><div className="panel-heading"><div><span className="eyebrow">Base ativa</span><h2>{customers.length} {customers.length === 1 ? 'cliente' : 'clientes'}</h2></div><label className="search-field"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, telefone ou e-mail" /></label></div>{loading ? <div className="loading-row">Carregando clientes…</div> : filteredCustomers.length === 0 ? <div className="empty-table"><span className="empty-icon">♧</span><strong>{search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</strong><p>{search ? 'Tente outro termo de busca.' : 'Cadastre o primeiro cliente para criar uma cobrança parcelada.'}</p></div> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Cliente</th><th>Contato</th><th>Aniversário</th><th>WhatsApp</th><th>Cadastro</th><th>Ações</th></tr></thead><tbody>{filteredCustomers.map((customer) => <tr key={customer.id}><td><strong>{customer.name}</strong><small>{customer.email || 'Sem e-mail informado'}</small></td><td>{customer.phone || '—'}</td><td>{customer.birth_date ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date(`${customer.birth_date}T12:00:00Z`)) : '—'}</td><td><span className={customer.whatsapp_opt_in ? 'status-pill success-pill' : 'status-pill muted-pill'}>{customer.whatsapp_opt_in ? 'Autorizado' : 'Não informado'}</span></td><td>{new Intl.DateTimeFormat('pt-BR').format(new Date(customer.created_at))}</td><td><button className="secondary-button compact-button" disabled={saving} onClick={() => { setEditingId(customer.id); setForm({ name: customer.name, phone: customer.phone || '', email: customer.email || '', birth_date: customer.birth_date || '', whatsapp_opt_in: customer.whatsapp_opt_in }); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Editar</button></td></tr>)}</tbody></table></div>}</section>
  </div>
}

