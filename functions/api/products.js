// Cloudflare Pages Function - /api/products
export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const shop = url.searchParams.get('shop')

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers })
  }

  if (!shop) {
    return new Response(JSON.stringify({ error: 'Missing shop parameter' }), {
      status: 400,
      headers
    })
  }

  try {
    // Get the access token from KV
    const accessToken = await env.TOKENS.get(`token:${shop}`)
    
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Not authenticated. Please reinstall the app.' }), {
        status: 401,
        headers
      })
    }

    // Fetch products from Shopify Admin API
    const shopifyResponse = await fetch(
      `https://${shop}/admin/api/2024-01/products.json?status=active&limit=250`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!shopifyResponse.ok) {
      throw new Error(`Shopify API error: ${shopifyResponse.status}`)
    }

    const data = await shopifyResponse.json()
    
    // Return simplified product list
    const products = data.products.map(p => ({
      id: p.id.toString(),
      title: p.title
    }))

    return new Response(JSON.stringify({ products }), { headers })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers
    })
  }
}
