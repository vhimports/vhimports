// Apenas para verificar interação/renderização. As regras reais são testadas em PostgreSQL.
const today = new Date().toISOString().slice(0, 10)
const now = new Date().toISOString()
const data = {
  clientes: [{ id: 'client-test', name: 'Cliente Exemplo', phone: '11900000000', email: 'exemplo@example.test', whatsapp_opt_in: true, active: true, created_at: now }],
  produtos: [{ id: 'product-test', name: 'Anel de teste', sku: 'TEST-1', material: 'Tênis importados', purity: 925, cost_price: 30, sale_price: 100, promotional_price: null, minimum_stock: 1, active: true, imagens_produtos: [{ storage_path: 'product-test/foto.svg', is_cover: true }] }],
  contas_financeiras: [{ id: 'account-test', name: 'Conta de teste', type: 'bank', institution: 'Banco de exemplo', initial_balance: 25, balance: 55, active: true }],
  pedidos: [{ id: 'order-test', order_number: 1, customer_id: 'client-test', status: 'sold', payment_status: 'partially_paid', subtotal: 100, shipping_amount: 0, discount_amount: 0, total_amount: 100, created_at: now, notes: 'Exemplo isolado', itens_pedidos: [{ product_name_snapshot: 'Anel de teste', quantity: 1, unit_price: 100, total_amount: 100 }], acordos_recebiveis: { id: 'agreement-test' }, pagamentos_pedidos: [{ status: 'paid', amount: 30 }] }],
  resumo_parcelas_recebiveis: [{ id: 'installment-test', agreement_id: 'agreement-test', customer_id: 'client-test', installment_number: 1, installment_count: 1, due_date: today, amount: 100, paid_amount: 30, effective_status: 'partially_paid', days_until_due: 0, order_id: 'order-test', order_number: 1 }],
  transacoes_financeiras: [{ id: 'transaction-test', financial_account_id: 'account-test', amount: 30, type: 'income', direction: 'in', status: 'paid', transaction_date: today, description: 'Recebimento de teste' }],
  publicacoes_conteudo: [{ id: 'post-test', product_id: 'product-test', caption: 'Legenda para teste', hashtags: '#teste', scheduled_for: null, status: 'suggestion', created_at: now }],
  categorias: [], fornecedores: [], categorias_financeiras: [], estoque_produtos: [{ id: 'product-test', current_stock: 5 }], perfis: [{ id: 'master-test', full_name: 'Master de teste' }],
}
let fail = false
export function failNextSummary() { fail = true }
const byId = (table, id) => data[table]?.find((r) => r.id === id)
function rows(table) {
  if (table === 'saldos_contas_financeiras') return data.contas_financeiras
  return (data[table] || []).map((r) => table === 'pedidos' ? { ...r, cliente: byId('clientes', r.customer_id) }
    : table === 'resumo_parcelas_recebiveis' ? { ...r, customer_name: byId('clientes', r.customer_id)?.name, customer_phone: byId('clientes', r.customer_id)?.phone }
      : table === 'publicacoes_conteudo' ? { ...r, produtos: byId('produtos', r.product_id) }
        : table === 'transacoes_financeiras' ? { ...r, contas_financeiras: byId('contas_financeiras', r.financial_account_id) } : r)
}
function query(table) {
  const filters=[]; let patch=null, insert=null, single=false
  const q={
    select(){ return q }, eq(k,v){ filters.push(r=>r[k]===v); return q }, neq(k,v){ filters.push(r=>r[k]!==v); return q },
    order(){ return q }, limit(){ return q }, single(){ single=true; return q }, maybeSingle(){ single=true; return q },
    update(value){ patch=value; return q }, insert(value){ insert=value; return q },
    then(resolve,reject){ return Promise.resolve().then(()=>{
      let result=rows(table).filter(r=>filters.every(f=>f(r)))
      if(patch) { for(const r of result) Object.assign(byId(table,r.id),patch); result=rows(table).filter(r=>filters.every(f=>f(r))) }
      if(insert) { const r={id:crypto.randomUUID(),active:true,created_at:now,...insert}; (data[table] ||= []).push(r); result=[r] }
      return { data: single ? result[0] : result, error: null }
    }).then(resolve,reject) },
  }; return q
}
export const supabase={
  from: query,
  auth: { async signOut(){} },
  storage: { from(){ return {
    async createSignedUrl(){ return {data:{signedUrl:''}} },
    async download(){ return {data:new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="15" fill="silver"/></svg>'],{type:'image/svg+xml'})} },
  } } },
  async rpc(name,p){
    if(name==='dashboard_summary') {
      if(fail){ fail=false; return {data:null,error:{message:'Falha simulada'}} }
      return {data:{products:data.produtos.length,customers:data.clientes.length,orders:data.pedidos.length,balance:55,receivables:70,recent_orders:rows('pedidos').map(o=>({...o,customer_name:o.cliente?.name})),upcoming:rows('resumo_parcelas_recebiveis').map(r=>({...r,remaining:Number(r.amount)-Number(r.paid_amount)})),flow:[{day:today,income:30,expense:0}]}}
    }
    if(name==='edit_order_details'){ Object.assign(byId('pedidos',p.p_order_id),{customer_id:p.p_customer_id,notes:p.p_notes}) }
    if(name==='edit_installment_due_date'){ byId('resumo_parcelas_recebiveis',p.p_installment_id).due_date=p.p_due_date }
    if(name==='create_manual_order'){
      const id=crypto.randomUUID(),number=data.pedidos.length+1
      const total=p.p_items.reduce((sum,i)=>sum+i.quantity*i.unit_price,0)+p.p_shipping-p.p_discount
      data.pedidos.unshift({id,order_number:number,customer_id:p.p_customer_id,status:'pending',payment_status:'pending',total_amount:total,notes:p.p_notes,created_at:now,itens_pedidos:p.p_items.map(i=>({...i,product_name_snapshot:byId('produtos',i.product_id).name})),acordos_recebiveis:p.p_plan?{id:crypto.randomUUID()}:null,pagamentos_pedidos:[]})
      if(p.p_plan) for(let i=1;i<=p.p_plan.installment_count;i++) data.resumo_parcelas_recebiveis.push({id:crypto.randomUUID(),order_id:id,order_number:number,customer_id:p.p_customer_id,installment_number:i,installment_count:p.p_plan.installment_count,amount:total/p.p_plan.installment_count,paid_amount:0,effective_status:'pending',days_until_due:0,due_date:p.p_plan.first_due_date})
      return {data:id,error:null}
    }
    return {data:null,error:null}
  },
}

