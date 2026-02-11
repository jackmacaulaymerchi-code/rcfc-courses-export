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

    // Fetch all products - we'll filter by tags
    let allProducts = []
    let pageInfo = null
    let hasNextPage = true

    while (hasNextPage) {
      let apiUrl = `https://${shop}/admin/api/2024-01/products.json?status=active&limit=250`
      
      if (pageInfo) {
        apiUrl = `https://${shop}/admin/api/2024-01/products.json?limit=250&page_info=${pageInfo}`
      }

      const shopifyResponse = await fetch(apiUrl, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      })

      if (!shopifyResponse.ok) {
        throw new Error(`Shopify API error: ${shopifyResponse.status}`)
      }

      const data = await shopifyResponse.json()
      allProducts = allProducts.concat(data.products || [])

      // Check for pagination
      const linkHeader = shopifyResponse.headers.get('Link')
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/page_info=([^>&]+).*rel="next"/)
        pageInfo = match ? match[1] : null
        hasNextPage = !!pageInfo
      } else {
        hasNextPage = false
      }

      // Safety limit
      if (allProducts.length > 2000) break
    }

    // Filter products that have 'Training' or 'Community' tags
    // Tags in Shopify are comma-separated strings
    const courseProducts = allProducts.filter(product => {
      const tags = product.tags ? product.tags.toLowerCase() : ''
      return tags.includes('training') || tags.includes('community')
    })
    
    // Return simplified product list, sorted alphabetically
    const products = courseProducts
      .map(p => ({
        id: p.id.toString(),
        title: p.title
      }))
      .sort((a, b) => a.title.localeCompare(b.title))

    return new Response(JSON.stringify({ products }), { headers })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers
    })
  }
}
