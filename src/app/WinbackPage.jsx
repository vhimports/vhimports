import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeWhatsAppText, whatsappUrl, winbackMessages } from '../lib/communicationMessages'

function phoneNumber(phone) {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('55') ? digits : `55${digits}`
}

export function WinbackPage() {
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  async function loadCustomers() {
    setLoading(true)
    const { data, error } = await supabase.from('clientes').select('id,name,phone,email,whatsapp_opt_in,active,created_at').order('name', { ascending: true })
    if (error) setFeedback({ type: 'error', message: 'Não foi possível carregar a lista de clientes.' })
    else setCustomers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadCustomers() }, [])

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return customers
    return customers.filter((customer) => [customer.name, customer.phone, customer.email].some((value) => value?.toLocaleLowerCase('pt-BR').includes(term)))
  }, [customers, search])

  async function contact(customer, type) {
    const text = winbackMessages[type](customer.name)
    const number = phoneNumber(customer.phone)
    if (number) window.open(whatsappUrl(number, text), '_blank', 'noopener,noreferrer')
    try {
      await navigator.clipboard.writeText(normalizeWhatsAppText(text))
      setFeedback({ type: 'success', message: number ? `Mensagem de ${customer.name} copiada e preparada no WhatsApp. Confira o texto antes de enviar.` : `Mensagem de ${customer.name} copiada. Cadastre um telefone para abrir o WhatsApp.` })
    } catch {
      setFeedback({ type: 'error', message: 'Não foi possível copiar a mensagem neste navegador.' })
    }
  }

  return <div className="page-content">
    <div className="page-heading"><div><span className="eyebrow">Relacionamento</span><h1>Reativação de clientes</h1><p>Escolha uma mensagem pronta e retome o contato de forma manual.</p></div></div>
    {feedback.message && <div className={`alert ${feedback.type === 'error' ? 'error' : 'success'} inline-alert`}><strong>{feedback.type === 'error' ? 'Atenção' : 'Mensagem preparada'}</strong><span>{feedback.message}</span></div>}
    <section className="panel winback-intro"><div><span className="eyebrow">Contato manual</span><h2>Duas formas de chamar sua cliente</h2><p>Os botões copiam a mensagem e, quando houver telefone, abrem uma conversa preenchida no WhatsApp. O envio continua dependendo da sua confirmação.</p></div><div className="winback-note"><strong>{customers.length}</strong><span>clientes cadastrados na base</span></div></section>
    <section className="panel list-panel"><div className="panel-heading"><div><span className="eyebrow">Lista completa</span><h2>{filteredCustomers.length} {filteredCustomers.length === 1 ? 'cliente' : 'clientes'} para contato</h2></div><label className="search-field"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, telefone ou e-mail" /></label></div>{loading ? <div className="loading-row">Carregando clientes…</div> : filteredCustomers.length === 0 ? <div className="empty-table"><span className="empty-icon">♧</span><strong>{search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</strong><p>{search ? 'Tente outro termo de busca.' : 'Cadastre clientes para iniciar a reativação.'}</p></div> : <div className="data-table-wrap"><table className="data-table winback-table"><thead><tr><th>Cliente</th><th>Telefone</th><th>WhatsApp</th><th>Status</th><th>Ações de contato</th></tr></thead><tbody>{filteredCustomers.map((customer) => <tr key={customer.id}><td><strong>{customer.name}</strong><small>{customer.email || 'Sem e-mail informado'}</small></td><td>{customer.phone || 'Sem telefone'}</td><td><span className={customer.whatsapp_opt_in ? 'status-pill success-pill' : 'status-pill muted-pill'}>{customer.whatsapp_opt_in ? 'Autorizado' : 'Não informado'}</span></td><td><span className={customer.active ? 'status-pill success-pill' : 'status-pill muted-pill'}>{customer.active ? 'Ativo' : 'Inativo'}</span></td><td><div className="winback-actions"><button className="secondary-button compact-button" onClick={() => contact(customer, 'newPieces')}>Avisar novas peças</button><button className="primary-button compact-button" onClick={() => contact(customer, 'buyAgain')}>Convidar para comprar novamente</button></div></td></tr>)}</tbody></table></div>}</section>
    <section className="winback-message-grid"><article className="panel winback-message-card"><span className="eyebrow">Mensagem 1</span><h2>Chegaram novas peças</h2><p>{winbackMessages.newPieces('[nome]')}</p><small>Usada para apresentar novidades do estoque.</small></article><article className="panel winback-message-card"><span className="eyebrow">Mensagem 2</span><h2>Convite para comprar novamente</h2><p>{winbackMessages.buyAgain('[nome]')}</p><small>Usada para retomar o relacionamento com a cliente.</small></article></section>
  </div>
}

