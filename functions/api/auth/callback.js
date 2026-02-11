// Cloudflare Pages Function - /api/auth/callback
export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  
  const code = url.searchParams.get('code')
  const shop = url.searchParams.get('shop')
  const host = url.searchParams.get('host')

  if (!code || !shop) {
    return new Response('Missing code or shop parameter', { status: 400 })
  }

  try {
    // Exchange the authorization code for an access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: env.SHOPIFY_CLIENT_ID,
        client_secret: env.SHOPIFY_CLIENT_SECRET,
        code: code
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      return new Response('Failed to get access token', { status: 500 })
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Store the token in KV
    await env.TOKENS.put(`token:${shop}`, accessToken)

    // Redirect to the app with shop and host params
    const appUrl = new URL('/', url.origin)
    appUrl.searchParams.set('shop', shop)
    if (host) {
      appUrl.searchParams.set('host', host)
    }

    return Response.redirect(appUrl.toString(), 302)

  } catch (error) {
    console.error('OAuth error:', error)
    return new Response('OAuth error: ' + error.message, { status: 500 })
  }
}
