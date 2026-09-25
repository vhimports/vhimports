import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { money } from '../lib/format'

const accountTypes = { bank: 'Banco', digital_wallet: 'Carteira digital', cash: 'Dinheiro', card_receivable: 'Cartão a receber' }

export function FinancePage() {
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [editingAccount, setEditingAccount] = useState(null)
  const [showAccount, setShowAccount] = useState(false)
  const [showEntry, setShowEntry] = useState(false)
  const [entryType, setEntryType] = useState('expense')
  const [accountForm, setAccountForm] = useState({ name: '', type: 'bank', institution: '', initial_balance: '' })
  const [entryForm, setEntryForm] = useState({ amount: '', account: '', category: '', description: '', transaction_date: new Date().toISOString().slice(0, 10) })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  async function load() {
    setLoading(true)
    const [accountsResult, categoriesResult, transactionResult] = await Promise.all([
      supabase.from('saldos_contas_financeiras').select('*').eq('active', true).order('name'),
      supabase.from('categorias_financeiras').select('id,name,type').eq('active', true).order('name'),
      supabase.from('transacoes_financeiras').select('id,type,direction,status,amount,transaction_date,description,financial_account_id,contas_financeiras(name),categorias_financeiras(name)').order('transaction_date', { ascending: false }).limit(100),
    ])
    const error = [accountsResult, categoriesResult, transactionResult].find((result) => result.error)?.error
    if (error) setFeedback({ type: 'error', message: 'Não foi possível carregar o financeiro.' })
    setAccounts(accountsResult.data ?? [])
    setCategories(categoriesResult.data ?? [])
    setTransactions(transactionResult.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const balances = accounts

  function updateAccount(event) { const { name, value } = event.target; setAccountForm((current) => ({ ...current, [name]: value })) }
  function updateEntry(event) { const { name, value } = event.target; setEntryForm((current) => ({ ...current, [name]: value })) }

  function startEntry(type) {
    setEntryType(type)
    setEntryForm((current) => ({ ...current, account: accounts[0]?.id || '', category: categories.find((category) => category.type === type)?.id || '' }))
    setShowEntry(true)
  }

  async function saveAccount(event) {
    event.preventDefault(); setSaving(true); setFeedback({ type: '', message: '' })
    const payload = { name: accountForm.name.trim(), type: accountForm.type, institution: accountForm.institution.trim() || null }
    const query = editingAccount ? supabase.from('contas_financeiras').update(payload).eq('id', editingAccount) : supabase.from('contas_financeiras').insert({ ...payload, initial_balance: Number(accountForm.initial_balance || 0) })
    const { error } = await query.select('id').single()
    if (error) setFeedback({ type: 'error', message: 'Não foi possível cadastrar a conta. Essa ação exige permissão de gestão.' })
    else { setShowAccount(false); setAccountForm({ name: '', type: 'bank', institution: '', initial_balance: '' }); setFeedback({ type: 'success', message: 'Conta financeira salva. Lançamentos e saldo inicial preservados.' }); await load() }
    setSaving(false)
  }

  async function saveEntry(event) {
    event.preventDefault(); setSaving(true); setFeedback({ type: '', message: '' })
    const args = entryType === 'expense'
      ? { p_amount: Number(entryForm.amount), p_account: entryForm.account, p_category: entryForm.category, p_description: entryForm.description.trim(), p_request_id: crypto.randomUUID() }
      : { p_amount: Number(entryForm.amount), p_account: entryForm.account, p_category: entryForm.category, p_description: entryForm.description.trim(), p_request_id: crypto.randomUUID(), p_transaction_date: entryForm.transaction_date }
    const { error } = await supabase.rpc(entryType === 'expense' ? 'record_expense' : 'record_income', args)
    if (error) setFeedback({ type: 'error', message: 'Não foi possível registrar o lançamento. Confira conta, categoria e valor.' })
    else { setShowEntry(false); setFeedback({ type: 'success', message: 'Lançamento registrado no financeiro.' }); await load() }
    setSaving(false)
  }

  return <div className="page-content"><div className="page-heading"><div><span className="eyebrow">Livro contínuo</span><h1>Financeiro</h1><p>Controle entradas, saídas e saldos sem abertura ou fechamento de caixa.</p></div><div className="heading-actions"><button className="secondary-button" onClick={() => startEntry('expense')}>Nova saída</button><button className="primary-button page-action" onClick={() => startEntry('income')}>Nova entrada <span>＋</span></button></div></div>{feedback.message && <div className={`alert ${feedback.type === 'error' ? 'error' : 'success'} inline-alert`}><strong>{feedback.type === 'error' ? 'Atenção' : 'Tudo certo'}</strong><span>{feedback.message}</span></div>}
    <section className="finance-account-grid">{balances.map((account) => <article className="panel account-card" key={account.id}><div className="account-icon">◷</div><div><span>{accountTypes[account.type] || account.type}</span><h2>{account.name}</h2><small>{account.institution || 'Conta da loja'}</small></div><strong>{money(account.balance)}</strong><button className="secondary-button compact-button" disabled={saving} onClick={() => { setEditingAccount(account.id); setAccountForm({ name: account.name, type: account.type, institution: account.institution || '', initial_balance: account.initial_balance }); setShowAccount(true) }}>Editar conta</button></article>)}<button className="panel add-account-card" onClick={() => { setEditingAccount(null); setAccountForm({ name: '', type: 'bank', institution: '', initial_balance: '' }); setShowAccount(true) }}><span>＋</span><strong>Adicionar conta</strong><small>Banco, carteira ou recebimentos</small></button></section>
    {showAccount && <form className="panel form-panel" onSubmit={saveAccount}><div className="panel-heading"><div><span className="eyebrow">Configuração</span><h2>{editingAccount ? 'Editar conta financeira' : 'Nova conta financeira'}</h2></div></div><div className="form-grid"><label>Nome<input name="name" value={accountForm.name} onChange={updateAccount} required placeholder="Ex.: Nubank" /></label><label>Tipo<select name="type" value={accountForm.type} onChange={updateAccount}>{Object.entries(accountTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Instituição<input name="institution" value={accountForm.institution} onChange={updateAccount} /></label><label>Saldo inicial<input type="number" name="initial_balance" disabled={!!editingAccount} step="0.01" value={accountForm.initial_balance} onChange={updateAccount} /></label></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowAccount(false)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Salvando…' : 'Salvar conta'}</button></div></form>}
    {showEntry && <form className="panel form-panel" onSubmit={saveEntry}><div className="panel-heading"><div><span className="eyebrow">Movimentação manual</span><h2>{entryType === 'expense' ? 'Nova saída' : 'Nova entrada'}</h2></div></div><div className="form-grid"><label>Valor<input name="amount" type="number" min="0.01" step="0.01" value={entryForm.amount} onChange={updateEntry} required /></label><label>Conta<select name="account" value={entryForm.account} onChange={updateEntry} required><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label>Categoria<select name="category" value={entryForm.category} onChange={updateEntry} required><option value="">Selecione</option>{categories.filter((category) => category.type === entryType).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Data<input name="transaction_date" type="date" value={entryForm.transaction_date} onChange={updateEntry} required /></label><label>Descrição<input name="description" value={entryForm.description} onChange={updateEntry} minLength="3" required placeholder="Descrição do lançamento" /></label></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowEntry(false)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Registrando…' : 'Confirmar lançamento'}</button></div></form>}
    <section className="panel list-panel"><div className="panel-heading"><div><span className="eyebrow">Últimos lançamentos</span><h2>Movimentações</h2><p className="field-help">Últimos 100 lançamentos. Os saldos incluem todo o histórico pago. Valores recebidos não são editáveis.</p></div></div>{loading ? <div className="loading-row">Carregando financeiro…</div> : transactions.length === 0 ? <div className="empty-table"><span className="empty-icon">◷</span><strong>Nenhuma movimentação</strong><p>Pagamentos e lançamentos aparecerão aqui.</p></div> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Descrição</th><th>Conta</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>{transactions.map((row) => <tr key={row.id}><td>{new Intl.DateTimeFormat('pt-BR').format(new Date(`${row.transaction_date}T12:00:00`))}</td><td><strong>{row.description}</strong><small>{row.status === 'paid' ? 'Pago' : row.status}</small></td><td>{row.contas_financeiras?.name || '—'}</td><td>{row.categorias_financeiras?.name || '—'}</td><td className={row.direction === 'in' ? 'income-text' : 'expense-text'}>{row.direction === 'in' ? '+' : '-'} {money(row.amount)}</td></tr>)}</tbody></table></div>}</section>
  </div>
}

