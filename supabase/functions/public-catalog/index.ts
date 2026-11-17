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

    const [productsResult, sectionsResult] = await Promise.all([
      admin.from('vh_catalogo_produtos')
        .select('id,slug,name,brand,category,image_key,image_path,description,sale_price,promotional_price,featured,sort_order')
        .eq('active', true)
        .is('archived_at', null)
        .gt('sale_price', 0)
        .order('sort_order')
        .order('name'),
      admin.from('vh_catalogo_secoes')
        .select('id,title,detail,tone,sort_order')
        .eq('active', true)
        .is('archived_at', null)
        .order('sort_order')
        .order('title'),
    ])

    if (productsResult.error) {
      console.error('Falha ao consultar o catálogo público.')
      return json(request, { error: 'Catálogo temporariamente indisponível.' }, 503)
    }

    const products = productsResult.data || []
    // Fotos enviadas pelo painel ficam num bucket privado; a Edge Function
    // gera uma URL assinada de curta duração em vez de expor o Storage.
    const signedUrlByPath = new Map<string, string>()
    const pathsToSign = [...new Set(products.map((product) => product.image_path).filter(Boolean))]
    if (pathsToSign.length > 0) {
      const signedResult = await admin.storage.from('product-images').createSignedUrls(pathsToSign, 3600)
      for (const entry of signedResult.data || []) {
        if (entry.path && entry.signedUrl) signedUrlByPath.set(entry.path, entry.signedUrl)
      }
    }

    const safeProducts = products.map((product) => {
      const sale = Number(product.sale_price || 0)
      const promotional = product.promotional_price == null ? null : Number(product.promotional_price)
      return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        brand: product.brand,
        category: product.category,
        imageKey: product.image_key,
        imageUrl: product.image_path ? signedUrlByPath.get(product.image_path) || null : null,
        price: promotional != null && promotional > 0 ? promotional : sale,
        oldPrice: promotional != null && promotional > 0 && promotional < sale ? sale : null,
        featured: Boolean(product.featured),
      }
    })

    const sections = (sectionsResult.data || []).map((section) => ({
      title: section.title,
      detail: section.detail,
      tone: section.tone,
    }))

    return json(request, { products: safeProducts, sections, generatedAt: new Date().toISOString() })
  } catch {
    console.error('Erro inesperado no catálogo público.')
    return json(request, { error: 'Catálogo temporariamente indisponível.' }, 503)
  }
})
