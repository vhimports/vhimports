import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRequestKey } from '../lib/useRequestKey'
import { money } from '../lib/format'

const paymentMethods = { cash: 'Dinheiro', pix: 'Pix', debit_card: 'Débito', credit_card: 'Crédito', transfer: 'Transferência', other: 'Outro' }
const orderLabels = { pending: 'Pendente', sold: 'Vendido', shipped: 'Enviado', completed: 'Concluído', canceled: 'Cancelado', partially_returned: 'Devolução parcial', returned: 'Devolvido' }

export function OrdersPage({ onOpenReceivables }) {
  const request = useRequestKey()
  const [editOrder, setEditOrder] = useState(null)
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [accounts, setAccounts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ customer_id: '', shipping_amount: '', discount_amount: '', notes: '' })
  const [items, setItems] = useState([])
  const [newItem, setNewItem] = useState({ product_id: '', quantity: '1' })
  const [plan, setPlan] = useState({ enabled: false, installment_count: '2', first_due_date: '', due_day: '' })
  const [payment, setPayment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  async function load() {
    setLoading(true)
    const [ordersResult, customersResult, productsResult, stockResult, accountsResult] = await Promise.all([
      supabase.from('pedidos').select('id,order_number,customer_id,status,payment_status,subtotal,shipping_amount,discount_amount,total_amount,notes,created_at,cliente:clientes(name),itens_pedidos(product_name_snapshot,quantity,unit_price,total_amount),acordos_recebiveis(id),pagamentos_pedidos(amount,status)').order('created_at', { ascending: false }),
      supabase.from('clientes').select('id,name').eq('active', true).order('name'),
      supabase.from('produtos').select('id,name,sku,cost_price,sale_price,promotional_price').eq('active', true).order('name'),
      supabase.from('estoque_produtos').select('id,current_stock'),
      supabase.from('contas_financeiras').select('id,name').eq('active', true).order('name'),
    ])
    const error = [ordersResult, customersResult, productsResult, stockResult, accountsResult].find((result) => result.error)?.error
    if (error) setFeedback({ type: 'error', message: 'Não foi possível carregar os pedidos.' })
    const stocks = new Map((stockResult.data ?? []).map((row) => [row.id, Number(row.current_stock)]))
    setOrders((ordersResult.data ?? []).map((order) => ({ ...order, agreement: Array.isArray(order.acordos_recebiveis) ? order.acordos_recebiveis[0] : order.acordos_recebiveis, remaining: Math.max(0, Number(order.total_amount) - (order.pagamentos_pedidos ?? []).filter((p) => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0)) })))
    setCustomers(customersResult.data ?? [])
    setProducts((productsResult.data ?? []).map((product) => ({ ...product, current_stock: stocks.get(product.id) ?? 0 })))
    setAccounts(accountsResult.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + (Number(item.unit_price) * Number(item.quantity)), 0), [items])
  const total = subtotal + Number(form.shipping_amount || 0) - Number(form.discount_amount || 0)

  function updateForm(event) { const { name, value } = event.target; setForm((current) => ({ ...current, [name]: value })) }

  function chooseProduct(event) {
    const product = products.find((item) => item.id === event.target.value)
    setNewItem({ product_id: product?.id || '', quantity: '1' })
  }

  function addItem() {
    const product = products.find((item) => item.id === newItem.product_id)
    if (!product) return
    const quantity = Math.max(1, Number(newItem.quantity || 1))
    setItems((current) => {
      const existing = current.find((item) => item.product_id === product.id)
      if (existing) return current.map((item) => item.product_id === product.id ? { ...item, quantity: item.quantity + quantity } : item)
      return [...current, { product_id: product.id, name: product.name, sku: product.sku, cost_price: product.cost_price, unit_price: product.promotional_price || product.sale_price, quantity }]
    })
    setNewItem({ product_id: '', quantity: '1' })
  }

  function removeItem(productId) { setItems((current) => current.filter((item) => item.product_id !== productId)) }

  async function saveOrder(event) {
    event.preventDefault()
    if (items.length === 0) { setFeedback({ type: 'error', message: 'Adicione pelo menos um modelo ao pedido.' }); return }
    setSaving(true)
    setFeedback({ type: '', message: '' })
    try {
      const payload = {
        p_customer_id: form.customer_id || null,
        p_items: items.map((item) => ({ product_id: item.product_id, quantity: Number(item.quantity), unit_price: Number(item.unit_price) })),
        p_shipping: Number(form.shipping_amount || 0), p_discount: Number(form.discount_amount || 0),
        p_notes: form.notes.trim() || null,
        p_plan: plan.enabled ? { installment_count: Number(plan.installment_count), first_due_date: plan.first_due_date, due_day: Number(plan.due_day) } : null,
      }
      const { error } = await supabase.rpc('create_manual_order', { ...payload, p_request_id: request.keyFor(payload) })
      if (error) throw error
      request.clear(); setShowForm(false); setItems([])
      setForm({ customer_id: '', shipping_amount: '', discount_amount: '', notes: '' })
      setPlan({ enabled: false, installment_count: '2', first_due_date: '', due_day: '' })
      setFeedback({ type: 'success', message: plan.enabled ? 'Pedido criado. As parcelas já estão em Cobranças; nenhum pagamento foi lançado.' : 'Pedido manual criado.' })
      await load()
    } catch {
      setFeedback({ type: 'error', message: 'Não foi possível confirmar a criação. Confira cliente, itens, desconto e vencimentos; tente novamente sem alterar os dados em caso de falha de conexão.' })
    }
    setSaving(false)
  }

  async function saveDetails(event) {
    event.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.rpc('edit_order_details', { p_order_id: editOrder.id, p_customer_id: editOrder.customer_id || null, p_notes: editOrder.notes })
      if (error) throw error
      setEditOrder(null); setFeedback({ type: 'success', message: 'Pedido atualizado e cobrança vinculada sincronizada.' }); await load()
    } catch { setFeedback({ type: 'error', message: 'Não foi possível editar. O cliente não pode ser trocado após recebimento ou cancelamento.' }) }
    finally { setSaving(false) }
  }

  async function markSold(order) {
    setSaving(true)
    const { error } = await supabase.rpc('mark_order_sold', { p_order_id: order.id })
    if (error) setFeedback({ type: 'error', message: 'Não foi possível vender o pedido. Verifique o estoque disponível.' })
    else { setFeedback({ type: 'success', message: 'Pedido vendido e estoque baixado por modelo.' }); await load() }
    setSaving(false)
  }

  async function recordPayment(event) {
    event.preventDefault()
    setSaving(true)
    const data = new FormData(event.currentTarget)
    const { error } = await supabase.rpc('record_order_payment', { p_order_id: payment.id, p_amount: Number(data.get('amount')), p_payment_method: data.get('method'), p_financial_account_id: data.get('account'), p_request_id: request.keyFor({ order: payment.id, amount: data.get('amount'), method: data.get('method'), account: data.get('account'), installments: data.get('installments'), notes: data.get('notes') }), p_installments: Number(data.get('installments') || 1), p_paid_at: null, p_notes: String(data.get('notes') || '').trim() || null })
    if (error) setFeedback({ type: 'error', message: 'Não foi possível registrar o pagamento. Confira o valor pendente.' })
    else { request.clear(); setPayment(null); setFeedback({ type: 'success', message: 'Pagamento registrado no financeiro.' }); await load() }
    setSaving(false)
  }

  return <div className="page-content"><div className="page-heading"><div><span className="eyebrow">Operação online</span><h1>Pedidos</h1><p>Registre vendas manuais, pagamentos e baixa de estoque.</p></div><button className="primary-button page-action" onClick={() => setShowForm((visible) => !visible)}>{showForm ? 'Fechar pedido' : 'Novo pedido'} <span>＋</span></button></div>{feedback.message && <div className={`alert ${feedback.type === 'error' ? 'error' : 'success'} inline-alert`}><strong>{feedback.type === 'error' ? 'Atenção' : 'Tudo certo'}</strong><span>{feedback.message}</span></div>}
    {showForm && <form className="panel form-panel" onSubmit={saveOrder}><div className="panel-heading"><div><span className="eyebrow">Venda manual</span><h2>Adicionar pedido</h2></div></div><div className="form-grid"><label>Cliente<select name="customer_id" required={plan.enabled} value={form.customer_id} onChange={updateForm}><option value="">Sem cliente</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label>Frete<input type="number" min="0" step="0.01" name="shipping_amount" value={form.shipping_amount} onChange={updateForm} placeholder="0,00" /></label><label>Desconto<input type="number" min="0" step="0.01" name="discount_amount" value={form.discount_amount} onChange={updateForm} placeholder="0,00" /></label><label>Observações<textarea name="notes" rows="2" value={form.notes} onChange={updateForm} /></label></div><div className="order-item-adder"><select value={newItem.product_id} onChange={chooseProduct}><option value="">Selecione um modelo</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · estoque {product.current_stock}</option>)}</select><input type="number" min="1" step="1" value={newItem.quantity} onChange={(event) => setNewItem((current) => ({ ...current, quantity: event.target.value }))} /><button type="button" className="secondary-button" onClick={addItem}>Adicionar modelo</button></div>{items.length > 0 && <div className="order-items">{items.map((item) => <div className="order-item" key={item.product_id}><span><strong>{item.name}</strong><small>{item.quantity} × {money(item.unit_price)}</small></span><b>{money(item.quantity * item.unit_price)}</b><button type="button" onClick={() => removeItem(item.product_id)} aria-label={`Remover ${item.name}`}>×</button></div>)}</div>}<fieldset className="installment-plan"><legend>Pagamento do cliente</legend><label className="checkbox-label"><input type="checkbox" checked={plan.enabled} onChange={(event) => setPlan((current) => ({ ...current, enabled: event.target.checked }))} /> Gerar cobrança parcelada automaticamente</label>{plan.enabled && <><div className="form-grid"><label>Quantidade de parcelas<input type="number" min="1" max="120" step="1" required value={plan.installment_count} onChange={(e) => setPlan({ ...plan, installment_count: e.target.value })} /></label><label>Primeiro vencimento<input type="date" required value={plan.first_due_date} onChange={(e) => setPlan({ ...plan, first_due_date: e.target.value, due_day: String(Number(e.target.value.slice(-2))) })} /></label><label>Dia mensal de vencimento<input type="number" min="1" max="31" step="1" required value={plan.due_day} onChange={(e) => setPlan({ ...plan, due_day: e.target.value })} /></label></div><p className="field-help">O total será dividido em parcelas mensais, com ajuste de centavos na última. O primeiro vencimento deve coincidir com o dia escolhido (ou último dia do mês). Nenhuma entrada financeira será registrada agora.</p></>}</fieldset><div className="order-total"><span>Total do pedido</span><strong>{money(total)}</strong></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Salvando…' : 'Criar pedido'}</button></div></form>}
    <section className="panel list-panel"><div className="panel-heading"><div><span className="eyebrow">Histórico</span><h2>{orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}</h2></div></div>{loading ? <div className="loading-row">Carregando pedidos…</div> : orders.length === 0 ? <div className="empty-table"><span className="empty-icon">▣</span><strong>Nenhum pedido cadastrado</strong><p>Os pedidos manuais aparecerão aqui.</p></div> : <div className="orders-list">{orders.map((order) => <article className="order-card" key={order.id}><div><div className="product-title"><strong>Pedido #{order.order_number}</strong><span>{order.cliente?.name || 'Cliente não informado'}</span></div><p>{order.itens_pedidos?.length || 0} item(ns) · criado em {new Intl.DateTimeFormat('pt-BR').format(new Date(order.created_at))}</p><div className="order-card-items">{order.itens_pedidos?.map((item, index) => <span key={`${order.id}-${index}`}>{item.quantity}× {item.product_name_snapshot}</span>)}</div></div><div className="order-card-value"><span className={`status-pill status-${order.status}`}>{orderLabels[order.status] || order.status}</span><strong>{money(order.total_amount)}</strong><small>{order.payment_status === 'paid' ? 'Pagamento completo' : order.payment_status === 'partially_paid' ? 'Pagamento parcial' : 'Pagamento pendente'}</small></div><div className="row-actions"><button className="secondary-button compact-button" disabled={saving} onClick={() => setEditOrder({ ...order, customer_id: order.customer_id || '', notes: order.notes || '' })}>Editar dados</button>{order.status === 'pending' && <button className="primary-button compact-button" onClick={() => markSold(order)} disabled={saving}>Marcar vendido</button>}{order.status !== 'canceled' && order.payment_status !== 'paid' && <button className="secondary-button compact-button" disabled={saving} onClick={() => { if (order.agreement) onOpenReceivables(order.id); else { request.clear(); setPayment(order) } }}>{order.agreement ? 'Ver parcelas em Cobranças' : 'Registrar pagamento'}</button>}</div></article>)}</div>}</section>
    {editOrder && <div className="dialog-backdrop"><div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="edit-order-title"><button className="dialog-close" disabled={saving} onClick={() => setEditOrder(null)} aria-label="Fechar">×</button><h2 id="edit-order-title">Editar pedido #{editOrder.order_number}</h2><p className="auth-help">Edição de cliente e observações. Itens, valores e plano de parcelas são preservados. O cliente fica bloqueado após recebimento.</p><form className="auth-form" onSubmit={saveDetails}><label>Cliente<select disabled={editOrder.payment_status !== 'pending' || ['canceled', 'returned', 'partially_returned'].includes(editOrder.status)} required={!!editOrder.agreement} value={editOrder.customer_id} onChange={(e) => setEditOrder({ ...editOrder, customer_id: e.target.value })}><option value="">Sem cliente</option>{!customers.some((c) => c.id === editOrder.customer_id) && editOrder.customer_id && <option value={editOrder.customer_id}>{editOrder.cliente?.name || 'Cliente atual'}</option>}{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Observações<textarea value={editOrder.notes} onChange={(e) => setEditOrder({ ...editOrder, notes: e.target.value })} /></label><button className="primary-button" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button></form></div></div>}
    {payment && <div className="dialog-backdrop"><div className="dialog-card"><button className="dialog-close" onClick={() => setPayment(null)} aria-label="Fechar">×</button><span className="eyebrow">Entrada financeira</span><h2>Pagamento do pedido #{payment.order_number}</h2><p className="auth-help">Saldo a receber: {money(payment.remaining)}.</p><form className="auth-form" onSubmit={recordPayment}><label>Valor recebido<input name="amount" type="number" min="0.01" max={payment.remaining} step="0.01" defaultValue={payment.remaining} required /></label><label>Forma de pagamento<select name="method" defaultValue="pix">{Object.entries(paymentMethods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Conta de entrada<select name="account" required><option value="">Selecione a conta</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label>Parcelas do cartão<input name="installments" type="number" min="1" step="1" defaultValue="1" /></label><label>Observações<input name="notes" /></label><button className="primary-button" disabled={saving}>Confirmar pagamento</button></form></div></div>}
  </div>
}
