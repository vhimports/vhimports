import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRequestKey } from '../lib/useRequestKey'
import { money } from '../lib/format'
import { normalizeWhatsAppText, receivableMessage, whatsappUrl } from '../lib/communicationMessages'

const paymentMethods = { cash: 'Dinheiro', pix: 'Pix', debit_card: 'Débito', credit_card: 'Crédito', transfer: 'Transferência', other: 'Outro' }
const statusLabels = { pending: 'Pendente', partially_paid: 'Parcial', overdue: 'Em atraso', paid: 'Paga', canceled: 'Cancelada' }

function today() { return new Date().toISOString().slice(0, 10) }

function daysLabel(days) {
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? 'dia' : 'dias'} em atraso`
  if (days === 0) return 'Vence hoje'
  return `Vence em ${days} ${days === 1 ? 'dia' : 'dias'}`
}

function messageFor(row) {
  const phone = row.customer_phone || ''
  const name = row.customer_name || 'cliente'
  const date = new Intl.DateTimeFormat('pt-BR').format(new Date(`${row.due_date}T12:00:00`))
  const amount = money(Math.max(0, Number(row.amount) - Number(row.paid_amount || 0)))
  return { phone, text: receivableMessage({ name, amount, dueDate: date }) }
}

export function ReceivablesPage({ orderId = null, onClearOrder }) {
  const request = useRequestKey()
  const [editingDue, setEditingDue] = useState(null)
  const [rows, setRows] = useState([])
  const [customers, setCustomers] = useState([])
  const [accounts, setAccounts] = useState([])
  const [statusFilter, setStatusFilter] = useState('open')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ customer_id: '', total_amount: '', installment_count: '2', first_due_date: today(), due_day: String(new Date().getDate()), notes: '' })
  const [payment, setPayment] = useState(null)
  const [feedback, setFeedback] = useState({ type: '', message: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function loadData() {
    setLoading(true)
    const [installments, customerResult, accountResult] = await Promise.all([
      supabase.from('resumo_parcelas_recebiveis').select('*').order('due_date', { ascending: true }),
      supabase.from('clientes').select('id,name,phone').eq('active', true).order('name'),
      supabase.from('contas_financeiras').select('id,name,type').eq('active', true).order('name'),
    ])
    const firstError = [installments, customerResult, accountResult].find((result) => result.error)?.error
    if (firstError) setFeedback({ type: 'error', message: 'Não foi possível carregar os dados de cobrança.' })
    setRows(installments.data ?? [])
    setCustomers(customerResult.data ?? [])
    setAccounts(accountResult.data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const scopedRows = useMemo(() => rows.filter((row) => !orderId || row.order_id === orderId), [rows, orderId])
  const visibleRows = useMemo(() => scopedRows.filter((row) => statusFilter === 'open' ? ['pending', 'partially_paid', 'overdue'].includes(row.effective_status) : row.effective_status === statusFilter), [scopedRows, statusFilter])
  const openTotal = useMemo(() => scopedRows.filter((row) => ['pending', 'partially_paid', 'overdue'].includes(row.effective_status)).reduce((sum, row) => sum + Math.max(0, Number(row.amount) - Number(row.paid_amount || 0)), 0), [scopedRows])

  function updateField(event) { const { name, value } = event.target; setForm((current) => ({ ...current, [name]: value })) }

  async function saveAgreement(event) {
    event.preventDefault()
    setFeedback({ type: '', message: '' })
    setSaving(true)
    const total = Number(form.total_amount)
    const count = Number(form.installment_count)
    const payload = { customer_id: form.customer_id, total_amount: total, installment_count: count, installment_amount: Math.round((total / count) * 100) / 100, first_due_date: form.first_due_date, due_day: Number(form.due_day), notes: form.notes.trim() || null }
    const { error } = await supabase.from('acordos_recebiveis').insert(payload)
    if (error) setFeedback({ type: 'error', message: 'Não foi possível criar o acordo. Confira cliente, valor e vencimento.' })
    else { setShowForm(false); setForm((current) => ({ ...current, total_amount: '', notes: '' })); setFeedback({ type: 'success', message: 'Acordo criado e parcelas geradas automaticamente.' }); await loadData() }
    setSaving(false)
  }

  async function registerPayment(event) {
    event.preventDefault()
    setSaving(true)
    setFeedback({ type: '', message: '' })
    const { error } = await supabase.rpc('record_installment_payment', { p_installment_id: payment.row.id, p_amount: Number(payment.amount), p_payment_method: payment.method, p_financial_account_id: payment.account_id, p_request_id: request.keyFor({ id: payment.row.id, amount: Number(payment.amount), method: payment.method, account: payment.account_id }), p_paid_at: null })
    if (error) setFeedback({ type: 'error', message: 'Não foi possível registrar o recebimento. O valor pode exceder o saldo da parcela.' })
    else { request.clear(); setPayment(null); setFeedback({ type: 'success', message: 'Recebimento registrado no financeiro.' }); await loadData() }
    setSaving(false)
  }

  async function saveDueDate(event) {
    event.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.rpc('edit_installment_due_date', { p_installment_id: editingDue.id, p_due_date: editingDue.due_date, p_reason: editingDue.reason.trim() })
      if (error) throw error
      setEditingDue(null); setFeedback({ type: 'success', message: 'Vencimento atualizado. As demais parcelas foram preservadas.' }); await loadData()
    } catch { setFeedback({ type: 'error', message: 'Não foi possível alterar o vencimento. Informe motivo e confira se a parcela continua em aberto.' }) }
    finally { setSaving(false) }
  }

  async function copyMessage(row) {
    try {
      await navigator.clipboard.writeText(normalizeWhatsAppText(messageFor(row).text))
      setFeedback({ type: 'success', message: 'Mensagem copiada com os emojis. Cole o texto no WhatsApp para enviar.' })
    } catch {
      setFeedback({ type: 'error', message: 'Não foi possível copiar a mensagem neste navegador.' })
    }
  }

  async function markContacted(row) {
    const { error } = await supabase.rpc('mark_installment_contacted', { p_installment_id: row.id })
    if (error) setFeedback({ type: 'error', message: 'Não foi possível registrar o contato.' })
    else setFeedback({ type: 'success', message: 'Contato registrado na parcela.' })
  }

  function openWhatsApp(row) {
    const { phone, text } = messageFor(row)
    const number = phone.replace(/\D/g, '')
    if (!number) { setFeedback({ type: 'error', message: 'Este cliente não tem telefone cadastrado.' }); return }
    window.open(whatsappUrl(number, text), '_blank', 'noopener,noreferrer')
    navigator.clipboard.writeText(normalizeWhatsAppText(text)).then(() => {
      setFeedback({ type: 'success', message: 'Mensagem copiada e preparada no WhatsApp. Confira o texto antes de enviar.' })
    }).catch(() => {
      setFeedback({ type: 'error', message: 'A conversa foi aberta, mas não foi possível copiar a mensagem. Use “Copiar mensagem” e cole no WhatsApp.' })
    })
  }

  return <div className="page-content">
    <div className="page-heading"><div><span className="eyebrow">Recebimentos</span><h1>Cobranças</h1><p>Acompanhe parcelas, vencimentos e recebimentos manuais.</p></div><button className="primary-button page-action" onClick={() => setShowForm((visible) => !visible)}>{showForm ? 'Fechar acordo' : 'Nova cobrança'} <span>＋</span></button></div>
    {feedback.message && <div className={`alert ${feedback.type === 'error' ? 'error' : 'success'} inline-alert`}><strong>{feedback.type === 'error' ? 'Atenção' : 'Tudo certo'}</strong><span>{feedback.message}</span></div>}
    {orderId && <div className="filter-notice">Exibindo as parcelas do pedido selecionado. <button className="text-button" onClick={onClearOrder}>Ver todas as cobranças</button></div>}
    <section className="metric-grid receivable-metrics"><article className="metric-card lavender"><div className="metric-top"><span>Em aberto</span><i>↗</i></div><strong>{money(openTotal)}</strong><small>Saldo de parcelas não pagas</small></article><article className="metric-card peach"><div className="metric-top"><span>Parcelas</span><i>◷</i></div><strong>{scopedRows.filter((row) => ['pending', 'partially_paid', 'overdue'].includes(row.effective_status)).length}</strong><small>Em acompanhamento</small></article><article className="metric-card blue"><div className="metric-top"><span>Em atraso</span><i>!</i></div><strong>{scopedRows.filter((row) => row.effective_status === 'overdue').length}</strong><small>Precisam de contato</small></article></section>
    {showForm && <form className="panel form-panel" onSubmit={saveAgreement}><div className="panel-heading"><div><span className="eyebrow">Primeiro passo</span><h2>Nova cobrança parcelada</h2></div></div><div className="form-grid"><label>Cliente<select name="customer_id" value={form.customer_id} onChange={updateField} required><option value="">Selecione um cliente</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label>Valor total<input type="number" name="total_amount" min="0.01" step="0.01" value={form.total_amount} onChange={updateField} required placeholder="0,00" /></label><label>Quantidade de parcelas<input type="number" name="installment_count" min="1" max="120" step="1" value={form.installment_count} onChange={updateField} required /></label><label>Primeiro vencimento<input type="date" name="first_due_date" value={form.first_due_date} onChange={updateField} required /></label><label>Dia padrão de vencimento<input type="number" name="due_day" min="1" max="31" value={form.due_day} onChange={updateField} required /><small className="field-help">Se o mês não tiver esse dia, usa o último dia.</small></label><label>Observações<textarea name="notes" value={form.notes} onChange={updateField} rows="2" placeholder="Observações do acordo" /></label></div>{customers.length === 0 && <div className="alert warning"><strong>Cadastre um cliente primeiro</strong><span>A criação de clientes fica disponível no menu Clientes.</span></div>}<div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary-button" disabled={saving || customers.length === 0}>{saving ? 'Gerando parcelas…' : 'Criar acordo'}</button></div></form>}
    <section className="panel list-panel"><div className="panel-heading"><div><span className="eyebrow">Agenda de recebimentos</span><h2>{visibleRows.length} {visibleRows.length === 1 ? 'parcela' : 'parcelas'}</h2></div><div className="filter-tabs">{[['open', 'Em aberto'], ['overdue', 'Atrasadas'], ['paid', 'Pagas'], ['canceled', 'Canceladas']].map(([value, label]) => <button key={value} className={statusFilter === value ? 'filter-tab active' : 'filter-tab'} onClick={() => setStatusFilter(value)}>{label}</button>)}</div></div>{loading ? <div className="loading-row">Carregando cobranças…</div> : visibleRows.length === 0 ? <div className="empty-table"><span className="empty-icon">◷</span><strong>Nenhuma parcela nesta visão</strong><p>Crie um acordo parcelado para acompanhar os vencimentos.</p></div> : <div className="receivable-list">{visibleRows.map((row) => <ReceivableRow key={row.id} row={row} onCopy={copyMessage} onWhatsApp={openWhatsApp} onContact={markContacted} onEdit={() => setEditingDue({ id: row.id, due_date: row.due_date, reason: '' })} onPay={() => { request.clear(); setPayment({ row, amount: Math.max(0, Number(row.amount) - Number(row.paid_amount || 0)).toFixed(2), method: 'pix', account_id: accounts[0]?.id || '' }) }} />)}</div>}</section>
    {editingDue && <div className="dialog-backdrop"><div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="edit-due-title"><button className="dialog-close" disabled={saving} onClick={() => setEditingDue(null)} aria-label="Fechar">×</button><h2 id="edit-due-title">Editar vencimento</h2><p className="auth-help">Altera somente esta parcela. Valor e recebimentos não mudam.</p><form className="auth-form" onSubmit={saveDueDate}><label>Novo vencimento<input type="date" required value={editingDue.due_date} onChange={(e) => setEditingDue({ ...editingDue, due_date: e.target.value })} /></label><label>Motivo da correção<input required minLength="3" maxLength="500" value={editingDue.reason} onChange={(e) => setEditingDue({ ...editingDue, reason: e.target.value })} /><small className="field-help">Fica na auditoria. Não inclua dados pessoais desnecessários.</small></label><button className="primary-button" disabled={saving}>{saving ? 'Salvando…' : 'Salvar vencimento'}</button></form></div></div>}
    {payment && <PaymentDialog payment={payment} setPayment={setPayment} accounts={accounts} onSubmit={registerPayment} saving={saving} />}
  </div>
}

function ReceivableRow({ row, onCopy, onWhatsApp, onContact, onPay, onEdit }) {
  const status = row.effective_status
  return <article className="receivable-row"><div className="receivable-main"><div className="receivable-title"><strong>{row.customer_name}</strong><span className={`status-pill status-${status}`}>{statusLabels[status] || status}</span></div><p>{row.order_number ? `Pedido #${row.order_number} · ` : ''}Parcela {row.installment_number}/{row.installment_count} · vencimento {new Intl.DateTimeFormat('pt-BR').format(new Date(`${row.due_date}T12:00:00`))}</p><small className={status === 'overdue' ? 'overdue-text' : 'muted-label'}>{daysLabel(Number(row.days_until_due))}</small></div><div className="receivable-value"><strong>{money(row.amount)}</strong><small>{Number(row.paid_amount) > 0 ? `${money(row.paid_amount)} recebido` : 'Ainda não recebida'}</small></div><div className="row-actions"><button className="text-button" onClick={() => onCopy(row)}>Copiar mensagem</button><button className="secondary-button compact-button" onClick={() => onWhatsApp(row)}>WhatsApp ↗</button>{!['paid', 'canceled'].includes(status) && <><button className="secondary-button compact-button" onClick={onEdit}>Editar vencimento</button><button className="secondary-button compact-button" onClick={() => onContact(row)}>Marcar contatada</button><button className="primary-button compact-button" onClick={onPay}>Registrar recebimento</button></>}</div></article>
}

function PaymentDialog({ payment, setPayment, accounts, onSubmit, saving }) {
  return <div className="dialog-backdrop" role="presentation"><div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="payment-title"><button className="dialog-close" onClick={() => setPayment(null)} aria-label="Fechar">×</button><span className="eyebrow">Entrada financeira</span><h2 id="payment-title">Registrar recebimento</h2><p className="auth-help">Parcela {payment.row.installment_number}/{payment.row.installment_count} de {payment.row.customer_name}.</p><form className="auth-form" onSubmit={onSubmit}><label>Valor recebido<input type="number" min="0.01" max={Math.max(0, Number(payment.row.amount) - Number(payment.row.paid_amount || 0))} step="0.01" value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))} required /></label><label>Forma de pagamento<select value={payment.method} onChange={(event) => setPayment((current) => ({ ...current, method: event.target.value }))}>{Object.entries(paymentMethods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Conta de entrada<select value={payment.account_id} onChange={(event) => setPayment((current) => ({ ...current, account_id: event.target.value }))} required><option value="">Selecione a conta</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><button className="primary-button" disabled={saving || !payment.account_id}>{saving ? 'Registrando…' : 'Confirmar recebimento'}</button></form></div></div>
}

