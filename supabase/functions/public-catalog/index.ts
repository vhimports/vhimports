import { createClient } from 'npm:@supabase/supabase-js@2'

const allowedOrigins = new Set([
  'https://vhimports.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
])

function responseHeaders(request: Request) {
  const origin = request.headers.get('origin')
  return {
    ...(origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'public, max-age=60, s-maxage=60',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  }
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(request) })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: responseHeaders(request) })
  if (request.method !== 'GET') return json(request, { error: 'Método não permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  let secretKey: string | undefined
  try {
    const secretKeyMap = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
    secretKey = secretKeyMap.default
  } catch {
    secretKey = undefined
  }
  // Fallback temporário para ambientes que ainda não receberam a variável das chaves novas.
  secretKey ||= Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !secretKey) return json(request, { error: 'Catálogo temporariamente indisponível.' }, 503)

  try {
    // Esta credencial fica somente no runtime da Edge Function. Nunca enviar ao navegador.
    const admin = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const [productsResult, stockResult, categoriesResult] = await Promise.all([
      admin.from('produtos')
        .select('id,name,description,material,purity,sale_price,promotional_price,category_id,marca_id,marca:marcas(id,name),imagens_produtos(storage_path,is_cover,sort_order)')
        .eq('active', true)
        .order('name'),
      admin.from('estoque_produtos').select('id,current_stock').eq('active', true),
      admin.from('categorias').select('id,name').eq('active', true),
    ])

    if (productsResult.error || stockResult.error || categoriesResult.error) {
      console.error('Falha ao consultar o catálogo público.')
      return json(request, { error: 'Catálogo temporariamente indisponível.' }, 503)
    }

    const stockByProduct = new Map((stockResult.data || []).map((row) => [row.id, Number(row.current_stock || 0)]))
    const categoryById = new Map((categoriesResult.data || []).map((row) => [row.id, row.name]))
    const products = productsResult.data || []
    const coverPaths = products.map((product) => {
      const images = [...(product.imagens_produtos || [])].sort((a, b) =>
        Number(b.is_cover) - Number(a.is_cover) || Number(a.sort_order || 0) - Number(b.sort_order || 0))
      return images[0]?.storage_path || null
    })
    const uniquePaths = [...new Set(coverPaths.filter(Boolean))]
    const signedResult = uniquePaths.length
      ? await admin.storage.from('product-images').createSignedUrls(uniquePaths, 3600)
      : { data: [], error: null }

    if (signedResult.error) {
      console.error('Falha ao gerar links temporários para imagens do catálogo.')
      return json(request, { error: 'Catálogo temporariamente indisponível.' }, 503)
    }

    const urlByPath = new Map((signedResult.data || []).map((entry) => [entry.path, entry.signedUrl]))
    const safeProducts = products.map((product, index) => {
      const sale = Number(product.sale_price || 0)
      const promotional = product.promotional_price == null ? null : Number(product.promotional_price)
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        material: product.material,
        purity: product.purity,
        category: categoryById.get(product.category_id) || null,
        brand: product.marca?.name || null,
        price: promotional != null && promotional > 0 ? promotional : sale,
        currentStock: stockByProduct.get(product.id) || 0,
        imageUrl: coverPaths[index] ? urlByPath.get(coverPaths[index]) || null : null,
      }
    })

    return json(request, { products: safeProducts, generatedAt: new Date().toISOString() })
  } catch {
    console.error('Erro inesperado no catálogo público.')
    return json(request, { error: 'Catálogo temporariamente indisponível.' }, 503)
  }
})
