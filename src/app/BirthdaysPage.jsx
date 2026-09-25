import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { birthdayDateLabel, birthdayList } from '../lib/customerDates'
import { birthdayMessage, normalizeWhatsAppText, whatsappUrl } from '../lib/communicationMessages'

const filters = [
  { value: 0, label: 'Hoje' },
  { value: 7, label: 'Próximos 7 dias' },
  { value: 30, label: 'Próximos 30 dias' },
]

function daysLabel(days) {
  if (days === 0) return 'Hoje!'
  if (days === 1) return 'Amanhã'
  return `Em ${days} dias`
}

export function BirthdaysPage() {
  const [customers, setCustomers] = useState([])
  const [filter, setFilter] = useState(30)
  const [today, setToday] = useState(() => new Date())
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('clientes')
      .select('id,name,phone,birth_date,whatsapp_opt_in,active')
      .not('birth_date', 'is', null)
      .order('name', { ascending: true })
    if (error) setFeedback({ type: 'error', message: 'Não foi possível carregar os aniversários. Confira sua conexão e tente atualizar.' })
    else setCustomers(data ?? [])
    setToday(new Date())
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const upcoming = useMemo(() => birthdayList(customers, today, 365), [customers, today])
  const visible = useMemo(() => upcoming.filter((customer) => customer.daysUntil <= filter), [upcoming, filter])
  const dueToday = upcoming.filter((customer) => customer.daysUntil === 0).length
  const dueWeek = upcoming.filter((customer) => customer.daysUntil <= 7).length
  const dueMonth = upcoming.filter((customer) => customer.daysUntil <= 30).length

  async function copyBirthday(customer) {
    try {
      await navigator.clipboard.writeText(normalizeWhatsAppText(birthdayMessage(customer.name)))
      setFeedback({ type: 'success', message: `Mensagem de aniversário de ${customer.name} copiada. Confira antes de enviar.` })
    } catch {
      setFeedback({ type: 'error', message: 'Não foi possível copiar a mensagem neste navegador.' })
    }
  }

  function openWhatsApp(customer) {
    const text = birthdayMessage(customer.name)
    const digits = String(customer.phone || '').replace(/\D/g, '')
    if (digits.length < 8) {
      setFeedback({ type: 'error', message: 'Este cliente não tem um telefone válido. Use “Copiar mensagem” ou atualize o cadastro.' })
      return
    }
    window.open(whatsappUrl(digits, text), '_blank', 'noopener,noreferrer')
    navigator.clipboard.writeText(normalizeWhatsAppText(text)).then(() => {
      setFeedback({ type: 'success', message: `Mensagem de aniversário de ${customer.name} preparada no WhatsApp e copiada como alternativa.` })
    }).catch(() => {
      setFeedback({ type: 'success', message: `Mensagem de aniversário de ${customer.name} preparada no WhatsApp. Confira o texto antes de enviar.` })
    })
  }

  return <div className="page-content">
    <div className="page-heading"><div><span className="eyebrow">Relacionamento com clientes</span><h1>Aniversários</h1><p>Veja quem faz aniversário e prepare uma mensagem com 10% de desconto.</p></div><button className="secondary-button" onClick={() => void load()} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</button></div>
    {feedback.message && <div className={`alert ${feedback.type === 'error' ? 'error' : 'success'} inline-alert`} role="status"><strong>{feedback.type === 'error' ? 'Atenção' : 'Mensagem preparada'}</strong><span>{feedback.message}</span></div>}
    <section className="metric-grid birthday-metrics">
      <article className="metric-card gold"><div className="metric-top"><span>Aniversários hoje</span><i>✦</i></div><strong>{loading ? '—' : dueToday}</strong><small>Clientes para cumprimentar</small></article>
      <article className="metric-card lavender"><div className="metric-top"><span>Próximos 7 dias</span><i>◷</i></div><strong>{loading ? '—' : dueWeek}</strong><small>Inclui os aniversários de hoje</small></article>
      <article className="metric-card peach"><div className="metric-top"><span>Próximos 30 dias</span><i>♧</i></div><strong>{loading ? '—' : dueMonth}</strong><small>Inclui os aniversários de hoje</small></article>
    </section>
    <section className="panel birthday-policy"><span className="birthday-gift">10%</span><div><strong>Presente de aniversário VH Imports</strong><p>A mensagem oferece 10% de desconto na próxima compra. O desconto é aplicado manualmente no pedido; esta tela não altera preços nem cria cupom.</p></div></section>
    <section className="panel list-panel"><div className="panel-heading"><div><span className="eyebrow">Agenda de aniversários</span><h2>{visible.length} {visible.length === 1 ? 'cliente' : 'clientes'}</h2></div><div className="filter-tabs">{filters.map((item) => <button key={item.value} className={filter === item.value ? 'filter-tab active' : 'filter-tab'} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div></div>
      {loading ? <div className="loading-row">Carregando aniversários…</div> : visible.length === 0 ? <div className="empty-table"><span className="empty-icon">✦</span><strong>{filter === 0 ? 'Ninguém faz aniversário hoje' : 'Nenhum aniversário neste período'}</strong><p>Cadastre a data de aniversário na ficha de cada cliente para receber os avisos.</p></div> : <div className="data-table-wrap"><table className="data-table birthday-table"><thead><tr><th>Cliente</th><th>Aniversário</th><th>Quando</th><th>Telefone</th><th>WhatsApp</th><th>Ações</th></tr></thead><tbody>{visible.map((customer) => <tr key={customer.id}><td><strong>{customer.name}</strong><small>{customer.active ? 'Cliente ativo' : 'Cadastro inativo'}</small></td><td>{birthdayDateLabel(customer.nextBirthday)}</td><td><span className={customer.daysUntil === 0 ? 'status-pill success-pill' : 'status-pill muted-pill'}>{daysLabel(customer.daysUntil)}</span></td><td>{customer.phone || '—'}</td><td><span className={customer.whatsapp_opt_in ? 'status-pill success-pill' : 'status-pill muted-pill'}>{customer.whatsapp_opt_in ? 'Autorizado' : 'Não informado'}</span></td><td><div className="birthday-actions"><button className="text-button" onClick={() => void copyBirthday(customer)}>Copiar mensagem</button><button className="secondary-button compact-button" disabled={!customer.phone} onClick={() => openWhatsApp(customer)}>WhatsApp ↗</button></div></td></tr>)}</tbody></table></div>}
    </section>
    <section className="panel birthday-template"><span className="eyebrow">Mensagem pronta</span><h2>Parabéns com carinho</h2><p>{birthdayMessage('[nome]')}</p><small>O sistema não envia a mensagem automaticamente. Revise o texto e confirme o envio no WhatsApp.</small></section>
  </div>
}

