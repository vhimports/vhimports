import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { money } from '../lib/format'
import { estimateSoldItem, OPERATIONAL_COST_PER_PIECE } from '../lib/estimatedProfit'

const soldStatuses = ['sold', 'shipped', 'completed']

function localMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(date)
  return `${parts.find((part) => part.type === 'year').value}-${parts.find((part) => part.type === 'month').value}`
}

function saleDate(order) {
  return order.sold_at || order.created_at
}

function saleMonth(value) {
  if (!value) return ''
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(new Date(value))
  return `${parts.find((part) => part.type === 'year').value}-${parts.find((part) => part.type === 'month').value}`
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(value))
}

export function EstimatedProfitPage() {
  const [orders, setOrders] = useState([])
  const [period, setPeriod] = useState(localMonth)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    const allOrders = []
    const pageSize = 1000
    try {
      for (let offset = 0; ; offset += pageSize) {
        const { data, error: queryError } = await supabase.from('pedidos')
          .select('id,order_number,status,sold_at,created_at,subtotal,discount_amount,shipping_amount,cliente:clientes(name),itens_pedidos(id,product_name_snapshot,sku_snapshot,quantity,unit_price,unit_cost_snapshot,discount_amount,total_amount)')
          .in('status', soldStatuses)
          .order('sold_at', { ascending: false })
          .order('id', { ascending: true })
          .range(offset, offset + pageSize - 1)
        if (queryError) throw queryError
        allOrders.push(...(data ?? []))
        if ((data ?? []).length < pageSize) break
      }
      setOrders(allOrders)
    } catch {
      setOrders([])
      setError('Não foi possível carregar as vendas. Nenhum valor estimado foi calculado; tente atualizar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const rows = useMemo(() => orders.flatMap((order) => (order.itens_pedidos ?? []).map((item) => {
    const estimate = estimateSoldItem(item, order)
    return { ...item, ...estimate, order, soldOn: saleDate(order), customerName: order.cliente?.name || 'Cliente não informado' }
  })).filter((row) => !period || saleMonth(row.soldOn) === period)
    .sort((left, right) => String(right.soldOn).localeCompare(String(left.soldOn))), [orders, period])

  const totals = useMemo(() => rows.reduce((summary, row) => {
    summary.quantity += Number(row.quantity || 0)
    summary.sales += row.salesAmount
    summary.cost += row.costAmount
    summary.operational += row.operationalCost
    if (row.costKnown) {
      summary.estimatedProfit += row.estimatedProfit
      summary.knownCostQuantity += Number(row.quantity || 0)
    } else summary.unknownCostQuantity += Number(row.quantity || 0)
    return summary
  }, { quantity: 0, sales: 0, cost: 0, operational: 0, estimatedProfit: 0, knownCostQuantity: 0, unknownCostQuantity: 0 }), [rows])

  return <div className="page-content">
    <div className="page-heading"><div><span className="eyebrow">Resultado das vendas</span><h1>Lucro estimado</h1><p>Veja o valor vendido, o custo histórico e o lucro estimado dos modelos vendidos.</p></div><button className="secondary-button" disabled={loading} onClick={() => void load()}>{loading ? 'Atualizando…' : 'Atualizar'}</button></div>
    {error && <div className="alert error inline-alert" role="alert"><strong>Dados indisponíveis</strong><span>{error}</span></div>}
    <section className="panel profit-filter-panel"><label className="month-picker">Período da venda<input aria-label="Filtrar pelo mês da venda" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></label><button className="secondary-button compact-button" disabled={!period} onClick={() => setPeriod('')}>Todo o período</button></section>
    <section className="metric-grid sold-profit-metrics">
      <article className="metric-card blue"><div className="metric-top"><span>Peças vendidas</span><i>◇</i></div><strong>{loading || error ? '—' : totals.quantity}</strong><small>{rows.length} linha(s) de produto</small></article>
      <article className="metric-card lavender"><div className="metric-top"><span>Valor vendido</span><i>↗</i></div><strong>{loading || error ? '—' : money(totals.sales)}</strong><small>Descontos de pedido rateados · frete excluído</small></article>
      <article className="metric-card peach"><div className="metric-top"><span>Custo dos modelos</span><i>◇</i></div><strong>{loading || error ? '—' : money(totals.cost)}</strong><small>Snapshots dos custos na venda</small></article>
      <article className="metric-card lavender"><div className="metric-top"><span>Custos operacionais</span><i>−</i></div><strong>{loading || error ? '—' : money(totals.operational)}</strong><small>R$ 3,00 por unidade vendida</small></article>
      <article className="metric-card gold"><div className="metric-top"><span>Lucro estimado</span><i>✦</i></div><strong>{loading || error ? '—' : money(totals.estimatedProfit)}</strong><small>Após custo histórico e R$ {OPERATIONAL_COST_PER_PIECE.toFixed(2).replace('.', ',')} por peça</small></article>
    </section>
    {totals.unknownCostQuantity > 0 && !loading && <div className="alert warning"><strong>Custo histórico faltando</strong><span>{totals.unknownCostQuantity} peça(s) sem custo registrado aparecem na lista, mas foram excluídas do total de lucro para não superestimar o resultado.</span></div>}
    <section className="panel list-panel"><div className="panel-heading"><div><span className="eyebrow">Vendas efetivadas</span><h2>{rows.length} {rows.length === 1 ? 'item vendido' : 'itens vendidos'}</h2></div></div>
      {loading ? <div className="loading-row">Carregando vendas…</div> : error ? <div className="empty-table"><strong>Resultado indisponível</strong><p>Atualize para tentar novamente.</p></div> : rows.length === 0 ? <div className="empty-table"><span className="empty-icon">◇</span><strong>Nenhuma peça vendida neste período</strong><p>Pedidos pendentes, cancelados e devolvidos não entram no cálculo.</p></div> : <div className="data-table-wrap"><table className="data-table sold-profit-table"><thead><tr><th>Data / pedido</th><th>Cliente</th><th>Peça</th><th>Qtd.</th><th>Valor vendido</th><th>Valor pago</th><th>Lucro estimado</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>#{row.order.order_number}</strong><small>{formatDate(row.soldOn)}</small></td><td>{row.customerName}</td><td><strong>{row.product_name_snapshot}</strong><small>{row.sku_snapshot || 'Sem SKU'}</small></td><td>{row.quantity}</td><td>{money(row.salesAmount)}</td><td>{row.costKnown ? money(row.costAmount) : <span className="muted-label">Não informado</span>}</td><td className={!row.costKnown ? '' : row.estimatedProfit < 0 ? 'expense-text' : 'income-text'}>{row.costKnown ? money(row.estimatedProfit) : '—'}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="panel profit-method"><span className="eyebrow">Como o sistema calcula</span><h2>Regra VH Imports</h2><p><strong>Lucro estimado = valor líquido vendido − custo pago na peça − R$ {OPERATIONAL_COST_PER_PIECE.toFixed(2).replace('.', ',')} por unidade.</strong></p><p>O desconto específico do item já está no total vendido; o desconto geral do pedido é rateado proporcionalmente entre os itens. O frete não conta como venda da peça. O custo vem do snapshot registrado no pedido e não muda se o cadastro do produto for editado depois.</p><small>É uma estimativa operacional, não lucro contábil: não desconta impostos, taxas de pagamento ou outras despesas. Entram somente pedidos marcados como vendidos, enviados ou concluídos; itens devolvidos/parcialmente devolvidos ficam fora por falta de quantidade de devolução por item.</small></section>
  </div>
}
