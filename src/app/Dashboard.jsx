import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import logo from '../assets/vh-logo.svg'
import { date, initials, money } from '../lib/format'
import { CustomersPage } from './CustomersPage'
import { ReceivablesPage } from './ReceivablesPage'
import { ProductsPage } from './ProductsPage'
import { OrdersPage } from './OrdersPage'
import { FinancePage } from './FinancePage'
import { ContentPage } from './ContentPage'
import { WinbackPage } from './WinbackPage'
import { BirthdaysPage } from './BirthdaysPage'
import { EstimatedProfitPage } from './EstimatedProfitPage'

const releaseKey = 'vh-imports.release.v1.1.0.dismissed'

const navigation = [
  { id: 'dashboard', label: 'Visão geral', icon: '⌂' },
  { id: 'orders', label: 'Pedidos', icon: '▣' },
  { id: 'customers', label: 'Clientes', icon: '♧' },
  { id: 'birthdays', label: 'Aniversários', icon: '✦' },
  { id: 'winback', label: 'Reativação', icon: '↻' },
  { id: 'receivables', label: 'Cobranças', icon: '◷' },
  { id: 'inventory', label: 'Produtos e estoque', icon: '◇' },
  { id: 'profit', label: 'Lucro estimado', icon: '↗' },
  { id: 'finance', label: 'Financeiro', icon: '◷' },
  { id: 'content', label: 'Conteúdo', icon: '✦' },
]

function emptyMetrics() {
  return { products: null, customers: null, orders: null, receivables: null, balance: null }
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthDate(key) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function monthLabel(date) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
}

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function Dashboard({ session }) {
  const [active, setActive] = useState('dashboard')
  const [orderFilter, setOrderFilter] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [metrics, setMetrics] = useState(emptyMetrics)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profileName, setProfileName] = useState('Master')
  const [projectionMonth, setProjectionMonth] = useState(monthKey(new Date()))
  const [projectionRows, setProjectionRows] = useState([])
  const [goalSummary, setGoalSummary] = useState(null)
  const [goalForm, setGoalForm] = useState({ start_date: localDateKey(), end_date: localDateKey(new Date(Date.now() + 30 * 86400000)), target_amount: '' })
  const [goalSaving, setGoalSaving] = useState(false)
  const [goalError, setGoalError] = useState('')
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)

  useEffect(() => {
    try { setShowReleaseNotes(window.localStorage.getItem(releaseKey) !== 'yes') }
    catch { setShowReleaseNotes(true) }
  }, [])

  useEffect(() => {
    if (active !== 'dashboard') return undefined
    let mounted = true, version = 0
    async function load() {
      const currentVersion = ++version
      setLoading(true); setError('')
      try {
        const [summary, profile, projection, goal] = await Promise.all([
          supabase.rpc('dashboard_summary'),
          supabase.from('perfis').select('full_name').eq('id', session.user.id).maybeSingle(),
          supabase.from('resumo_parcelas_recebiveis').select('due_date,amount,paid_amount,effective_status').in('effective_status', ['pending', 'partially_paid', 'overdue']),
          supabase.rpc('sales_goal_summary'),
        ])
        if (!mounted || currentVersion !== version) return
        if (summary.error || profile.error || projection.error || goal.error || !summary.data || !goal.data) throw summary.error || profile.error || projection.error || goal.error || new Error('Dados indisponíveis')
        setMetrics(summary.data)
        setProjectionRows(projection.data ?? [])
        setGoalSummary(goal.data)
        if (goal.data.goal) setGoalForm({ start_date: goal.data.goal.start_date, end_date: goal.data.goal.end_date, target_amount: String(goal.data.goal.target_amount) })
        if (profile.data?.full_name) setProfileName(profile.data.full_name)
      } catch {
        if (mounted && currentVersion === version) {
          setMetrics(emptyMetrics())
          setProjectionRows([])
          setGoalSummary(null)
          setError('Não foi possível carregar a visão geral. Verifique a conexão e sua sessão e clique em Atualizar.')
        }
      } finally { if (mounted && currentVersion === version) setLoading(false) }
    }
    void load()
    window.addEventListener('focus', load)
    return () => { mounted = false; window.removeEventListener('focus', load) }
  }, [session.user.id, active, refresh])

  useEffect(() => {
    if (!menuOpen) return undefined
    function closeOnEscape(event) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.body.classList.add('menu-open')
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.classList.remove('menu-open')
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  }, [])

  async function logout() {
    await supabase.auth.signOut()
  }

  async function saveGoal(event) {
    event.preventDefault()
    setGoalSaving(true); setGoalError('')
    try {
      const { error: saveError } = await supabase.rpc('save_sales_goal', {
        p_start_date: goalForm.start_date,
        p_end_date: goalForm.end_date,
        p_target_amount: Number(goalForm.target_amount),
        p_request_id: crypto.randomUUID(),
      })
      if (saveError) throw saveError
      setRefresh((value) => value + 1)
    } catch (saveError) {
      setGoalError(saveError.message || 'Não foi possível salvar a meta. Confira as datas e o valor informado.')
    } finally { setGoalSaving(false) }
  }

  function selectPage(id) {
    setActive(id)
    if (id === 'receivables') setOrderFilter(null)
    setMenuOpen(false)
  }

  function dismissReleaseNotes() {
    try { window.localStorage.setItem(releaseKey, 'yes') } catch { /* A sessão atual ainda pode dispensar o aviso. */ }
    setShowReleaseNotes(false)
  }

  const projectionCards = [0, 1, 2].map((offset) => {
    const date = addMonths(monthDate(projectionMonth), offset)
    const key = monthKey(date)
    const rows = projectionRows.filter((row) => String(row.due_date).slice(0, 7) === key)
    const amount = rows.reduce((sum, row) => sum + Math.max(0, Number(row.amount) - Number(row.paid_amount || 0)), 0)
    return { date, amount, count: rows.length, label: offset === 0 ? 'Mês escolhido' : offset === 1 ? 'Próximo mês' : 'Daqui a 2 meses' }
  })

  return <div className="app-shell">
    {menuOpen && <button className="menu-backdrop" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />}
    <aside className={menuOpen ? 'sidebar is-open' : 'sidebar'}>
      <div className="sidebar-top">
        <div className="sidebar-brand-row"><div className="logo-lockup brand-logo-lockup"><img className="brand-logo-image" src={logo} alt="VH Imports — tênis importados" /></div><button className="menu-close" aria-label="Fechar menu" onClick={() => setMenuOpen(false)}>×</button></div>
        <div className="brand-kicker">sneakers · gestão</div>
      </div>
      <nav className="main-nav" aria-label="Navegação principal">
        <span className="nav-heading">Menu</span>
        {navigation.map((item) => <button key={item.id} className={active === item.id ? 'nav-item active' : 'nav-item'} onClick={() => selectPage(item.id)}><span className="nav-icon">{item.icon}</span>{item.label}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="security-chip"><span>●</span><div><strong>Acesso autorizado</strong><small>Senha e e-mail confirmado</small></div></div>
        <button className="profile-mini" onClick={logout}><span className="avatar">{initials(profileName)}</span><span><strong>{profileName}</strong><small>Sair do sistema</small></span><span className="logout-icon">↗</span></button>
      </div>
    </aside>
    <main className="main-content">
      <header className="topbar">
        <button className="menu-toggle" aria-label="Abrir menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><span /><span /><span /></button>
        <div className="mobile-brand"><img className="brand-logo-image" src={logo} alt="VH Imports — tênis importados" /></div>
        <div className="breadcrumb"><span>VH Imports</span><b>/</b><strong>{navigation.find((item) => item.id === active)?.label}</strong></div>
        <div className="topbar-actions"><time>{date.format(new Date())}</time><span className="topbar-divider" /><button className="icon-button" aria-label="Abrir avisos de aniversários" title="Avisos de aniversários" onClick={() => selectPage('birthdays')}>♢<i /></button><button className="top-avatar">{initials(profileName)}</button></div>
      </header>
      {active === 'dashboard' ? <DashboardHome greeting={greeting} profileName={profileName} metrics={metrics} loading={loading} error={error} setActive={selectPage} onRefresh={() => setRefresh((value) => value + 1)} projectionMonth={projectionMonth} setProjectionMonth={setProjectionMonth} projectionCards={projectionCards} goalSummary={goalSummary} goalForm={goalForm} setGoalForm={setGoalForm} goalSaving={goalSaving} goalError={goalError} onSaveGoal={saveGoal} /> : active === 'customers' ? <CustomersPage /> : active === 'birthdays' ? <BirthdaysPage /> : active === 'profit' ? <EstimatedProfitPage /> : active === 'winback' ? <WinbackPage /> : active === 'receivables' ? <ReceivablesPage orderId={orderFilter} onClearOrder={() => setOrderFilter(null)} /> : active === 'inventory' ? <ProductsPage /> : active === 'orders' ? <OrdersPage onOpenReceivables={(id) => { setOrderFilter(id); setActive('receivables') }} /> : active === 'finance' ? <FinancePage /> : active === 'content' ? <ContentPage session={session} /> : <ComingSoon title={navigation.find((item) => item.id === active)?.label} />}
    </main>
    {showReleaseNotes && <div className="release-backdrop"><section className="release-dialog" role="dialog" aria-modal="true" aria-labelledby="release-title"><span className="eyebrow">Atualização VH Imports · versão 1.1.0</span><h2 id="release-title">Novidades para sua loja</h2><p className="release-intro">Esta versão traz ferramentas para acompanhar clientes e entender melhor o resultado das vendas.</p><ul><li><strong>Avisos de aniversário:</strong> cadastre a data da cliente e encontre os próximos aniversários com uma mensagem pronta oferecendo 10% de desconto.</li><li><strong>Lucro estimado:</strong> consulte peças vendidas, valor líquido, custo preservado no pedido e estimativa após R$ 3,00 de custo operacional por unidade.</li><li><strong>Preço sugerido:</strong> o cadastro da peça exibe uma sugestão com a regra de preço VH Imports, sem mudar o valor informado automaticamente.</li></ul><small>As mensagens continuam manuais e precisam ser revisadas e enviadas por você no WhatsApp.</small><button className="primary-button" onClick={dismissReleaseNotes}>Não mostrar novamente</button></section></div>}
  </div>
}

function DashboardHome({ greeting, profileName, metrics, loading, error, setActive, onRefresh, projectionMonth, setProjectionMonth, projectionCards, goalSummary, goalForm, setGoalForm, goalSaving, goalError, onSaveGoal }) {
  const available = !loading && !error
  const shortDate = (value) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(`${value}T12:00:00`))
  const empty = (message) => <div className="loading-row">{loading ? 'Carregando…' : error ? 'Dados indisponíveis. Tente atualizar.' : message}</div>
  return <div className="page-content">
    <div className="page-heading"><div><span className="eyebrow">Visão geral</span><h1>{greeting}, {profileName.split(' ')[0]}.</h1><p>Acompanhe o movimento da sua loja de tênis importados.</p></div><button className="secondary-button" disabled={loading} onClick={onRefresh}>{loading ? 'Atualizando…' : 'Atualizar'}</button></div>
    {error && <div className="alert error inline-alert" role="alert"><strong>Dados indisponíveis</strong><span>{error}</span></div>}
    <section className="metric-grid">
      <MetricCard label="Saldo disponível" value={metrics.balance == null ? '—' : money(metrics.balance)} detail="Contas ativas · somente movimentos pagos" accent="gold" loading={loading} />
      <MetricCard label="A receber" value={metrics.receivables == null ? '—' : money(metrics.receivables)} detail="Saldo restante das parcelas" accent="lavender" loading={loading} />
      <MetricCard label="Produtos ativos" value={metrics.products == null ? '—' : metrics.products} detail="Produtos cadastrados" accent="blue" loading={loading} />
      <MetricCard label="Pedidos" value={metrics.orders == null ? '—' : metrics.orders} detail="Pedidos não cancelados" accent="peach" loading={loading} />
    </section>
    <section className="panel projection-panel">
      <div className="panel-heading projection-heading"><div><span className="eyebrow">Planejamento</span><h2>Projeção de recebimentos</h2><p>Veja o saldo previsto das parcelas por mês.</p></div><label className="month-picker">Mês de referência<input type="month" value={projectionMonth} onChange={(event) => setProjectionMonth(event.target.value)} /></label></div>
      <div className="projection-cards">{projectionCards.map((card) => <article className="projection-card" key={card.date.toISOString()}><div className="projection-card-top"><span>{card.label}</span><i>◷</i></div><strong>{loading ? '—' : money(card.amount)}</strong><small>{monthLabel(card.date)} · {card.count} {card.count === 1 ? 'parcela' : 'parcelas'}</small></article>)}</div>
    </section>
    <section className="panel goal-panel">
      <div className="panel-heading goal-heading"><div><span className="eyebrow">Objetivo de vendas</span><h2>Meta do período</h2><p>Pedidos quitados no período entram automaticamente no progresso.</p></div><span className="goal-status">{goalSummary?.goal ? 'Meta ativa' : 'Nenhuma meta definida'}</span></div>
      {goalError && <div className="alert error inline-alert" role="alert"><strong>Não foi possível salvar</strong><span>{goalError}</span></div>}
      <div className="goal-layout">
        <form className="goal-form" onSubmit={onSaveGoal}>
          <label>Data inicial<input type="date" required value={goalForm.start_date} onChange={(event) => setGoalForm((current) => ({ ...current, start_date: event.target.value }))} /></label>
          <label>Data final<input type="date" required value={goalForm.end_date} onChange={(event) => setGoalForm((current) => ({ ...current, end_date: event.target.value }))} /></label>
          <label>Valor da meta<input type="number" min="0.01" step="0.01" required placeholder="Ex.: 10000,00" value={goalForm.target_amount} onChange={(event) => setGoalForm((current) => ({ ...current, target_amount: event.target.value }))} /></label>
          <button className="primary-button" type="submit" disabled={goalSaving || loading}>{goalSaving ? 'Salvando…' : goalSummary?.goal ? 'Atualizar meta' : 'Definir meta'}</button>
        </form>
        {goalSummary?.goal ? <div className="goal-progress" aria-label="Progresso da meta">
          <div className="goal-progress-top"><span>Progresso</span><strong>{Number(goalSummary.progress_percent || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</strong></div>
          <div className="goal-progress-track"><span style={{ width: `${Math.min(100, Math.max(0, Number(goalSummary.progress_percent || 0)))}%` }} /></div>
          <div className="goal-values"><div><strong>{money(goalSummary.paid_amount)}</strong><small>já recebido em {goalSummary.paid_orders} {Number(goalSummary.paid_orders) === 1 ? 'pedido pago' : 'pedidos pagos'}</small></div><div><strong>{money(goalSummary.remaining_amount)}</strong><small>restante para atingir a meta</small></div></div>
          <small className="goal-period">Período: {shortDate(goalSummary.goal.start_date)} até {shortDate(goalSummary.goal.end_date)}</small>
        </div> : <div className="goal-empty"><span className="empty-icon">✦</span><strong>Defina um objetivo para acompanhar as vendas pagas.</strong><small>O progresso será atualizado quando um pedido mudar para quitado.</small></div>}
      </div>
    </section>
    <section className="dashboard-grid">
      <article className="panel flow-panel"><div className="panel-heading"><div><span className="eyebrow">Movimento</span><h2>Fluxo financeiro</h2></div><span className="muted-label">Últimos 7 dias</span></div>
        {available && metrics.flow?.some((day) => Number(day.income) || Number(day.expense)) ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Dia</th><th>Entradas</th><th>Saídas</th></tr></thead><tbody>{metrics.flow.map((day) => <tr key={day.day}><td>{shortDate(day.day)}</td><td className="income-text">{money(day.income)}</td><td className="expense-text">{money(day.expense)}</td></tr>)}</tbody></table></div> : empty('Nenhum movimento pago nos últimos 7 dias.')}
      </article>
      <article className="panel attention-panel"><div className="panel-heading"><div><span className="eyebrow">Atenção</span><h2>Próximas cobranças</h2></div><button className="link-button" onClick={() => setActive('receivables')}>Ver todas ↗</button></div>
        {available && metrics.upcoming?.length ? <div className="dashboard-records">{metrics.upcoming.map((row) => <div className="dashboard-record" key={row.id}><span><strong>{row.customer_name}</strong><small className={row.effective_status === 'overdue' ? 'overdue-text' : ''}>{row.effective_status === 'overdue' ? 'Em atraso · ' : 'Vencimento · '}{shortDate(row.due_date)}</small></span><b>{money(row.remaining)}</b></div>)}</div> : empty('Nenhuma parcela em atraso ou vencendo nos próximos 7 dias.')}
      </article>
    </section>
    <section className="dashboard-grid lower-grid"><article className="panel"><div className="panel-heading"><div><span className="eyebrow">Operação</span><h2>Pedidos recentes</h2></div><button className="link-button" onClick={() => setActive('orders')}>Ver pedidos ↗</button></div>
      {available && metrics.recent_orders?.length ? <div className="dashboard-records">{metrics.recent_orders.map((order) => <div className="dashboard-record" key={order.id}><span><strong>Pedido #{order.order_number}</strong><small>{order.customer_name || 'Cliente não informado'}{order.status === 'canceled' ? ' · Cancelado' : ''}</small></span><b>{money(order.total_amount)}</b></div>)}</div> : empty('Nenhum pedido cadastrado.')}
    </article><article className="panel quick-panel"><div className="panel-heading"><div><span className="eyebrow">Atalhos</span><h2>Ações rápidas</h2></div></div><div className="quick-actions"><button onClick={() => setActive('orders')}><span>＋</span><div><strong>Novo pedido</strong><small>Registrar uma venda manual</small></div><b>↗</b></button><button onClick={() => setActive('receivables')}><span>♧</span><div><strong>Nova cobrança</strong><small>Acompanhar parcelas</small></div><b>↗</b></button><button onClick={() => setActive('inventory')}><span>◇</span><div><strong>Adicionar produto</strong><small>Cadastrar uma peça</small></div><b>↗</b></button></div></article></section>
  </div>
}

function MetricCard({ label, value, detail, accent, loading }) {
  return <article className={`metric-card ${accent}`}><div className="metric-top"><span>{label}</span><i>↗</i></div><strong>{loading ? '· · ·' : value}</strong><small>{detail}</small></article>
}

function ComingSoon({ title }) {
  return <div className="page-content coming-page"><span className="eyebrow">Próxima etapa</span><h1>{title}</h1><p>Esta tela será construída seguindo as regras de negócio documentadas. Nenhuma operação foi inventada nesta primeira base.</p><div className="coming-card"><span className="empty-icon">✦</span><strong>Estrutura pronta para receber este módulo.</strong><small>Vamos implementar os fluxos um por vez, começando pelo que você definir para esta tela.</small></div></div>
}
