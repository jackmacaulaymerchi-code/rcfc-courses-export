// Cloudflare Pages Function - /api/auth/check
// This endpoint checks if we have a token and initiates OAuth if not

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
    // Check if we have a token for this shop
    const accessToken = await env.TOKENS.get(`token:${shop}`)
    
    if (accessToken) {
      // Token exists, we're good
      return new Response(JSON.stringify({ authenticated: true }), { headers })
    }

    // No token - need to initiate OAuth
    // Build the authorization URL
    const scopes = 'read_orders,read_products'
    const redirectUri = `${url.origin}/api/auth/callback`
    
    const authUrl = `https://${shop}/admin/oauth/authorize?` + 
      `client_id=${env.SHOPIFY_CLIENT_ID}` +
      `&scope=${scopes}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`

    return new Response(JSON.stringify({ 
      authenticated: false,
      authUrl: authUrl
    }), { headers })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers
    })
  }
}
