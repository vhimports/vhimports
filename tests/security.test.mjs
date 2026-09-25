import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Real embedded PostgreSQL. Auth schema is a fixture, not a mock of RLS or SQL.
const db = new PGlite();
const master = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const session = '20000000-0000-4000-8000-000000000001';
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz, banned_until timestamptz);
  create table auth.sessions(id uuid primary key,user_id uuid references auth.users,created_at timestamptz default now(),not_after timestamptz);
  create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
  grant usage on schema auth,public to anon,authenticated;
  create schema storage;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated;
  grant select,insert,update on storage.objects to authenticated;
`);
const initial = await readFile(new URL('../supabase/migrations/20260918000100_initial_backend.sql',import.meta.url),'utf8');
// PGlite has gen_random_uuid in core; only the unavailable extension declaration is omitted.
await db.exec(initial.replace('create extension if not exists pgcrypto;',''));
await db.exec(`insert into auth.users(id,email,email_confirmed_at) values
  ('${master}','master@example.test',now()),('${other}','outsider@example.test',now());
  update public.profiles set role='admin';
  insert into auth.sessions(id,user_id) values('${session}','${master}');`);
await db.exec(await readFile(new URL('../supabase/migrations/20260918000200_security.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20260918000300_mvp_operations.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20260919000400_remove_mfa_requirement.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20260919000500_portuguese_table_names.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20260921000600_linked_orders_and_dashboard.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20260921000700_weekly_content_scheduler.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20260921000800_sales_goals.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20260925000900_vh_imports_catalog.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/seed.sql',import.meta.url),'utf8'));
await db.exec(`insert into private.master_access(slot,email,user_id) values(1,'master@example.test','${master}');`);
const account = (await db.query('select id from public.contas_financeiras limit 1')).rows[0].id;

async function asUser(id=master, aal='aal2') {
  await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,aal,session_id:session})]);
  await db.exec('set local role authenticated');
}
async function tx(work) {
  await db.exec('begin');
  try { await work(); } finally { await db.exec('rollback'); }
}
async function denied(sql, params=[]) {
  await db.exec('savepoint denied');
  await assert.rejects(db.query(sql,params));
  await db.exec('rollback to savepoint denied');
}
async function fixture(quantity=1) {
  const p=(await db.query("insert into public.produtos(name) values('Test') returning id")).rows[0].id;
  await db.query("select public.adjust_stock($1,$2,'in','Initial test',gen_random_uuid())",[p,quantity]);
  const o=(await db.query('insert into public.pedidos default values returning id')).rows[0].id;
  await db.query("insert into public.itens_pedidos(order_id,product_id,product_name_snapshot,quantity,unit_price) values($1,$2,'Test',1,100)",[o,p]);
  return {o,p};
}

test('anonymous cannot read customers or execute payment functions',()=>tx(async()=>{
  await db.exec('set local role anon');
  await denied('select * from public.clientes');
  await denied('select public.mark_order_sold(gen_random_uuid())');
}));
test('non-master fails closed while master can operate without MFA',()=>tx(async()=>{
  await asUser(master,'aal1');
  assert.equal((await db.query('select public.is_active_staff() ok')).rows[0].ok,true);
  await db.query("insert into public.clientes(name) values('Authorized without MFA')");
  await db.exec('reset role'); await asUser(other);
  await denied('select public.mark_order_sold(gen_random_uuid())');
}));
test('third master slot and uninvited signup are rejected',()=>tx(async()=>{
  await denied("insert into private.master_access(slot,email) values(3,'third@example.test')");
  await denied("insert into auth.users(id,email) values(gen_random_uuid(),'stranger@example.test')");
}));
test('disabled profile, revoked master, missing and expired session immediately deny access',()=>tx(async()=>{
  for (const change of [
    `update public.perfis set active=false where id='${master}'`,
    'update private.master_access set enabled=false',
    `delete from auth.sessions where id='${session}'`,
    "update auth.sessions set created_at=now()-interval '9 hours'"
  ]) {
    await db.exec('savepoint state'); await db.exec(change); await asUser();
    assert.equal((await db.query('select public.is_active_staff() ok')).rows[0].ok,false);
    await db.exec('rollback to savepoint state');
  }
}));
test('master cannot promote users, forge audit, write payment or change order status directly',()=>tx(async()=>{
  await asUser();
  await denied("update public.perfis set role='admin'");
  await denied("insert into public.logs_auditoria(action,entity_type) values('fake','fake')");
  await denied("update public.pedidos set status='sold'");
  await denied('delete from public.transacoes_financeiras');
  await denied('insert into public.pagamentos_pedidos default values');
  await denied('select * from private.master_access');
}));
test('sale reduces stock once and second order cannot oversell',()=>tx(async()=>{
  await asUser(); const {o,p}=await fixture();
  await db.query('select public.mark_order_sold($1)',[o]);
  await db.query('select public.mark_order_sold($1)',[o]);
  assert.equal((await db.query('select current_stock from public.estoque_produtos where id=$1',[p])).rows[0].current_stock,0);
  const o2=(await db.query('insert into public.pedidos default values returning id')).rows[0].id;
  await db.query("insert into public.itens_pedidos(order_id,product_id,product_name_snapshot,quantity,unit_price) values($1,$2,'Test',1,100)",[o2,p]);
  await denied('select public.mark_order_sold($1)',[o2]);
  await denied('update public.itens_pedidos set quantity=2 where order_id=$1',[o]);
}));
test('payment retries have one ledger entry and partial/total payments are correct',()=>tx(async()=>{
  await asUser(); const {o}=await fixture();
  const key='30000000-0000-4000-8000-000000000001';
  const sql="select (public.record_order_payment($1,$2,'pix',$3,$4)).id";
  const args=[o,40,account,key];
  const a=await db.query(sql,args), b=await db.query(sql,args);
  assert.equal(a.rows[0].id,b.rows[0].id);
  assert.equal((await db.query('select payment_status from public.pedidos where id=$1',[o])).rows[0].payment_status,'partially_paid');
  assert.equal(Number((await db.query('select sum(amount) n from public.transacoes_financeiras')).rows[0].n),40);
  await denied(sql,[o,41,account,key]);
  await denied(sql,[o,61,account,'30000000-0000-4000-8000-000000000002']);
  await db.query(sql,[o,60,account,'30000000-0000-4000-8000-000000000003']);
  assert.equal((await db.query('select payment_status from public.pedidos where id=$1',[o])).rows[0].payment_status,'paid');
  await denied('update public.itens_pedidos set unit_price=200 where order_id=$1',[o]);
}));
test('invalid amounts and dates rejected',()=>tx(async()=>{
  await asUser(); const {o}=await fixture();
  for(const amount of [null,0,-1,'NaN','Infinity','1.001']) {
    await denied("select public.record_order_payment($1,$2,'pix',$3,gen_random_uuid())",[o,amount,account]);
  }
}));
test('installments preserve cents, month end and idempotent settlement',()=>tx(async()=>{
  await asUser();
  const c=(await db.query("insert into public.clientes(name) values('Private Name') returning id")).rows[0].id;
  const a=(await db.query("insert into public.acordos_recebiveis(customer_id,total_amount,installment_count,installment_amount,first_due_date,due_day) values($1,1,6,0.16,'2026-01-31',31) returning id",[c])).rows[0].id;
  const rows=(await db.query('select id,amount,due_date::text d from public.parcelas_recebiveis where agreement_id=$1 order by installment_number',[a])).rows;
  assert.equal(rows[1].d,'2026-02-28');
  assert.equal(rows.at(-1).amount,'0.20');
  for(const i of rows) {
    const key=(await db.query('select gen_random_uuid() id')).rows[0].id;
    const sql="select (public.record_installment_payment($1,$2,'pix',$3,$4)).id";
    const args=[i.id,i.amount,account,key];
    assert.equal((await db.query(sql,args)).rows[0].id,(await db.query(sql,args)).rows[0].id);
  }
  assert.equal((await db.query('select status from public.acordos_recebiveis where id=$1',[a])).rows[0].status,'completed');
  assert.equal(Number((await db.query('select sum(amount) n from public.transacoes_financeiras')).rows[0].n),1);
  const audit=(await db.query('select * from public.logs_auditoria')).rows;
  assert(audit.some(r=>r.entity_type==='public.clientes' && r.user_id===master));
  assert(!JSON.stringify(audit).includes('Private Name'));
}));
const createOrderSql = 'select public.create_manual_order($1,$2::jsonb,$3,$4,$5,$6::jsonb,$7) id';
async function linkedOrder(plan={installment_count:3,first_due_date:'2026-01-31',due_day:31}) {
  const c=(await db.query("insert into public.clientes(name,phone) values('Cliente teste','11900000000') returning id")).rows[0].id;
  const p=(await db.query("insert into public.produtos(name,cost_price,sale_price) values('Peça original',30,100) returning id")).rows[0].id;
  const key=(await db.query('select gen_random_uuid() id')).rows[0].id;
  const args=[c,JSON.stringify([{product_id:p,quantity:1,unit_price:100}]),10,10,'Pedido de teste',JSON.stringify(plan),key];
  const o=(await db.query(createOrderSql,args)).rows[0].id;
  const a=(await db.query('select id from public.acordos_recebiveis where order_id=$1',[o])).rows[0]?.id;
  const installments=(await db.query('select * from public.parcelas_recebiveis where agreement_id=$1 order by installment_number',[a])).rows;
  return {c,p,o,a,args,installments};
}

test('atomic order creates a single linked agreement and preserves cents without receiving or selling',()=>tx(async()=>{
  await asUser(); const {o,a,args,installments}=await linkedOrder();
  assert.equal((await db.query(createOrderSql,args)).rows[0].id,o);
  assert.equal((await db.query('select count(*) n from public.pedidos')).rows[0].n,1);
  assert.equal((await db.query('select count(*) n from public.acordos_recebiveis where id=$1',[a])).rows[0].n,1);
  assert.deepEqual(installments.map(i=>i.amount),['33.33','33.33','33.34']);
  assert.equal((await db.query('select count(*) n from public.transacoes_financeiras')).rows[0].n,0);
  assert.equal((await db.query('select count(*) n from public.movimentacoes_estoque')).rows[0].n,0);
  assert.equal((await db.query('select total_amount from public.pedidos where id=$1',[o])).rows[0].total_amount,'100.00');
}));
test('invalid plan/items/discount roll back the whole order and request identity',()=>tx(async()=>{
  await asUser(); const {args}=await linkedOrder(null);
  const attempts=[
    {index:0,value:null,plan:{installment_count:2,first_due_date:'2026-01-31',due_day:31}},
    {index:1,value:'[]'}, {index:1,value:JSON.stringify([{product_id:'ffffffff-ffff-4fff-8fff-ffffffffffff',quantity:1,unit_price:1}])},
    {index:3,value:1000}, {index:5,value:JSON.stringify({installment_count:121,first_due_date:'2026-01-31',due_day:31})},
    {index:5,value:JSON.stringify({installment_count:2,first_due_date:'2026-01-30',due_day:31})},
  ];
  for (const attempt of attempts) {
    const trial=[...args]; trial[6]=(await db.query('select gen_random_uuid() id')).rows[0].id;
    trial[attempt.index]=attempt.value; if(attempt.plan)trial[5]=JSON.stringify(attempt.plan);
    await denied(createOrderSql,trial);
    assert.equal((await db.query('select count(*) n from public.pedidos')).rows[0].n,1);
    await db.exec('reset role'); assert.equal((await db.query('select count(*) n from private.requests where request_id=$1',[trial[6]])).rows[0].n,0); await asUser();
  }
}));
test('linked partial/full receipts synchronize order exactly once and reject direct payment',()=>tx(async()=>{
  await asUser(); const {o,a,installments}=await linkedOrder();
  await denied("select public.record_order_payment($1,10,'pix',$2,gen_random_uuid())",[o,account]);
  const sql="select (public.record_installment_payment($1,$2,'pix',$3,$4)).id";
  const key=(await db.query('select gen_random_uuid() id')).rows[0].id;
  const args=[installments[0].id,10,account,key];
  assert.equal((await db.query(sql,args)).rows[0].id,(await db.query(sql,args)).rows[0].id);
  assert.equal((await db.query('select payment_status from public.pedidos where id=$1',[o])).rows[0].payment_status,'partially_paid');
  assert.equal((await db.query('select count(*) n from public.transacoes_financeiras')).rows[0].n,1);
  assert.equal((await db.query('select count(*) n from public.pagamentos_pedidos')).rows[0].n,1);
  for(const i of installments) {
    await db.query(sql,[i.id,Number(i.amount)-(i.id===installments[0].id?10:0),account,(await db.query('select gen_random_uuid() id')).rows[0].id]);
  }
  assert.equal((await db.query('select payment_status from public.pedidos where id=$1',[o])).rows[0].payment_status,'paid');
  assert.equal((await db.query('select status from public.acordos_recebiveis where id=$1',[a])).rows[0].status,'completed');
  assert.equal(Number((await db.query('select sum(amount) n from public.transacoes_financeiras')).rows[0].n),100);
  assert.equal(Number((await db.query('select sum(amount) n from public.pagamentos_pedidos where order_id=$1',[o])).rows[0].n),100);
  await denied(sql,[installments[0].id,1,account,(await db.query('select gen_random_uuid() id')).rows[0].id]);
}));
test('canonical edits propagate while historical product snapshots and financial values stay intact',()=>tx(async()=>{
  await asUser(); const {o,c,p}=await linkedOrder();
  await db.query("update public.clientes set name='Nome atualizado',phone='11911111111' where id=$1",[c]);
  const row=(await db.query('select customer_name,customer_phone from public.resumo_parcelas_recebiveis where order_id=$1 limit 1',[o])).rows[0];
  assert.deepEqual(row,{customer_name:'Nome atualizado',customer_phone:'11911111111'});
  await db.query("update public.produtos set name='Catálogo atualizado',sale_price=200 where id=$1",[p]);
  const item=(await db.query('select product_name_snapshot,unit_price from public.itens_pedidos where order_id=$1',[o])).rows[0];
  assert.deepEqual(item,{product_name_snapshot:'Peça original',unit_price:'100.00'});
  await denied('update public.itens_pedidos set quantity=2 where order_id=$1',[o]);
  await denied('update public.pedidos set discount_amount=0 where id=$1',[o]);
  await denied('update public.contas_financeiras set initial_balance=999 where id=$1',[account]);
}));
test('master can set and clear the optional birthday on the existing customer record',()=>tx(async()=>{
  await asUser(); const {c}=await linkedOrder();
  await db.query("update public.clientes set birth_date='1990-10-23' where id=$1",[c]);
  assert.equal((await db.query('select birth_date::text d from public.clientes where id=$1',[c])).rows[0].d,'1990-10-23');
  await db.query('update public.clientes set birth_date=null where id=$1',[c]);
  assert.equal((await db.query('select birth_date from public.clientes where id=$1',[c])).rows[0].birth_date,null);
}));
test('order customer edit synchronizes agreement but blocks reassignment after receipt',()=>tx(async()=>{
  await asUser(); const {o,c,a,installments}=await linkedOrder();
  const next=(await db.query("insert into public.clientes(name) values('Outra cliente') returning id")).rows[0].id;
  await db.query('select public.edit_order_details($1,$2,$3)',[o,next,'Corrigido']);
  assert.equal((await db.query('select customer_id from public.acordos_recebiveis where id=$1',[a])).rows[0].customer_id,next);
  await db.query("select public.record_installment_payment($1,1,'pix',$2,gen_random_uuid())",[installments[0].id,account]);
  await denied('select public.edit_order_details($1,$2,$3)',[o,c,'Não permitido']);
  await db.query('select public.edit_order_details($1,$2,$3)',[o,next,'Observação permitida']);
  await denied('update public.pedidos set customer_id=$1 where id=$2',[c,o]);
}));
test('due date correction audits reason, changes only one installment and denies settled rows',()=>tx(async()=>{
  await asUser(); const {installments}=await linkedOrder(); const i=installments[0].id;
  await denied("select public.edit_installment_due_date($1,'2026-02-05','')",[i]);
  await db.query("select public.edit_installment_due_date($1,'2026-02-05','Correção combinada')",[i]);
  assert.equal((await db.query('select due_date::text d from public.parcelas_recebiveis where id=$1',[i])).rows[0].d,'2026-02-05');
  assert.equal((await db.query('select due_date::text d from public.parcelas_recebiveis where id=$1',[installments[1].id])).rows[0].d,'2026-02-28');
  assert.equal((await db.query("select new_data->>'reason' reason from public.logs_auditoria where entity_id=$1 and action='due_date_correction'",[i])).rows[0].reason,'Correção combinada');
  await db.query("select public.record_installment_payment($1,33.33,'pix',$2,gen_random_uuid())",[i,account]);
  await denied("select public.edit_installment_due_date($1,'2026-02-06','Correção combinada')",[i]);
}));
test('dashboard includes every paid transaction, excludes pending/canceled and refreshes canonical names',()=>tx(async()=>{
  await asUser(); const {o,c,installments}=await linkedOrder();
  await db.query("select public.record_installment_payment($1,10,'pix',$2,gen_random_uuid(),now()-interval '1 minute')",[installments[0].id,account]);
  await db.exec('reset role');
  await db.query('update public.contas_financeiras set initial_balance=50 where id=$1',[account]);
  await db.query("insert into public.transacoes_financeiras(financial_account_id,type,direction,status,amount,description,transaction_date) select $1,'income','in','paid',1,'Teste agregado',(now() at time zone 'America/Sao_Paulo')::date from generate_series(1,1100)",[account]);
  await db.query("insert into public.transacoes_financeiras(financial_account_id,type,direction,status,amount,description,transaction_date) values($1,'income','in','pending',500,'Ainda não recebido',(now() at time zone 'America/Sao_Paulo')::date),($1,'expense','out','paid',20,'Saída teste',(now() at time zone 'America/Sao_Paulo')::date)",[account]);
  await db.query("insert into public.pedidos(status) values('canceled')");
  await asUser(); await db.query("update public.clientes set name='Nome atual' where id=$1",[c]);
  const summary=(await db.query('select public.dashboard_summary() data')).rows[0].data;
  assert.equal(summary.balance,1140); assert.equal(summary.receivables,90); assert.equal(summary.orders,1);
  assert.equal(summary.recent_orders.find(r=>r.id===o).customer_name,'Nome atual');
  assert.equal(summary.flow.length,7);
  assert.equal(summary.flow.reduce((sum,d)=>sum+Number(d.income),0),1110);
  const balance=(await db.query('select balance from public.saldos_contas_financeiras where id=$1',[account])).rows[0].balance;
  assert.equal(Number(balance),summary.balance);
}));
test('sales goal counts each fully paid order once and is idempotent',()=>tx(async()=>{
  await asUser(); const {o,installments}=await linkedOrder();
  for (const installment of installments) {
    await db.query("select public.record_installment_payment($1,$2,'pix',$3,gen_random_uuid())",[installment.id,Number(installment.amount),account]);
  }
  const key=(await db.query('select gen_random_uuid() id')).rows[0].id;
  const saved=(await db.query("select public.save_sales_goal('2020-01-01','2030-12-31',250,$1) data",[key])).rows[0].data;
  assert.equal(saved.id !== null,true);
  assert.equal((await db.query('select count(*) n from public.metas_vendas where active')).rows[0].n,1);
  const summary=(await db.query('select public.sales_goal_summary() data')).rows[0].data;
  assert.equal(summary.paid_orders,1); assert.equal(Number(summary.paid_amount),100); assert.equal(Number(summary.remaining_amount),150); assert.equal(Number(summary.progress_percent),40);
  const replay=(await db.query("select public.save_sales_goal('2020-01-01','2030-12-31',250,$1) data",[key])).rows[0].data;
  assert.equal(replay.id,saved.id); assert.equal((await db.query('select count(*) n from public.metas_vendas')).rows[0].n,1);
  await db.query("select public.save_sales_goal('2031-01-01','2031-12-31',100,$1)",[await db.query('select gen_random_uuid() id').then(r=>r.rows[0].id)]);
  const empty=(await db.query('select public.sales_goal_summary() data')).rows[0].data;
  assert.equal(empty.paid_orders,0); assert.equal(Number(empty.paid_amount),0);
}));
test('new RPCs and private photo reads remain master-only',()=>tx(async()=>{
  await asUser(); await db.query("insert into storage.objects(bucket_id,name) values('product-images','test/photo.jpg')");
  assert.equal((await db.query('select count(*) n from storage.objects')).rows[0].n,1);
  await db.exec('reset role'); await asUser(other);
  await denied('select public.dashboard_summary()');
  await denied('select public.sales_goal_summary()');
  await denied("select public.save_sales_goal(current_date,current_date,100,gen_random_uuid())");
  await denied("select public.create_manual_order(null,'[]',0,0,null,null,gen_random_uuid())");
  await denied("select public.edit_order_details(gen_random_uuid(),null,'test')");
  await denied("select public.edit_installment_due_date(gen_random_uuid(),current_date,'test')");
  assert.equal((await db.query('select count(*) n from storage.objects')).rows[0].n,0);
  await db.exec('reset role; set local role anon');
  await denied('select public.dashboard_summary()');
  await denied('select * from public.saldos_contas_financeiras');
}));

test('weekly content scheduler selects five unique photos per day and is safe to rerun',()=>tx(async()=>{
  await asUser();
  for(let n=1;n<=35;n++) {
    const p=(await db.query("insert into public.produtos(name,active) values($1,true) returning id",[`Photo ${n}`])).rows[0].id;
    await db.query("insert into public.imagens_produtos(product_id,storage_path,is_cover) values($1,$2,true)",[p,`photos/${n}.jpg`]);
  }
  const key=(await db.query('select gen_random_uuid() id')).rows[0].id;
  const first=(await db.query("select public.generate_weekly_content_schedule('2026-01-05',$1) data",[key])).rows[0].data;
  assert.equal(first.created,35,JSON.stringify(first)); assert.equal(first.missing,0);
  assert.equal(Number((await db.query("select count(*) n,count(distinct image_path) unique_n from public.publicacoes_conteudo where scheduled_for >= '2026-01-05'::date and scheduled_for < '2026-01-12'::date")).rows[0].n),35);
  assert.equal(Number((await db.query("select count(*) n from (select (scheduled_for at time zone 'America/Sao_Paulo')::date day_key from public.publicacoes_conteudo where scheduled_for >= '2026-01-05'::date and scheduled_for < '2026-01-12'::date group by day_key having count(*) <> 5) x")).rows[0].n),0);
  const replay=(await db.query("select public.generate_weekly_content_schedule('2026-01-05',$1) data",[key])).rows[0].data;
  assert.equal(replay.replayed,true); assert.equal(Number((await db.query("select count(*) n from public.publicacoes_conteudo where scheduled_for >= '2026-01-05'::date and scheduled_for < '2026-01-12'::date")).rows[0].n),35);
  const second=(await db.query("select public.generate_weekly_content_schedule('2026-01-05',gen_random_uuid()) data")).rows[0].data;
  assert.equal(second.created,0); assert.equal(Number((await db.query("select count(*) n from public.publicacoes_conteudo where scheduled_for >= '2026-01-05'::date and scheduled_for < '2026-01-12'::date")).rows[0].n),35);
}));
test('weekly content scheduler reports shortage without repeating available photos',()=>tx(async()=>{
  await asUser();
  for(let n=1;n<=3;n++) {
    const p=(await db.query("insert into public.produtos(name,active) values($1,true) returning id",[`Short ${n}`])).rows[0].id;
    await db.query("insert into public.imagens_produtos(product_id,storage_path,is_cover) values($1,$2,true)",[p,`short/${n}.jpg`]);
  }
  const result=(await db.query("select public.generate_weekly_content_schedule('2026-02-02',gen_random_uuid()) data")).rows[0].data;
  assert.equal(result.created,3); assert.equal(result.missing,32);
  assert.equal(Number((await db.query("select count(distinct image_path) n from public.publicacoes_conteudo where scheduled_for >= '2026-02-02'::date and scheduled_for < '2026-02-09'::date")).rows[0].n),3);
}));

after(()=>db.close());
