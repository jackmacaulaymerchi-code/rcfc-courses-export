// Cloudflare Pages Function - /api/orders
export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  
  const shop = url.searchParams.get('shop')
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')
  const productId = url.searchParams.get('productId')

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers })
  }

  if (!shop || !startDate || !endDate) {
    return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
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

    // Build Shopify API query
    const params = new URLSearchParams({
      status: 'any',
      created_at_min: `${startDate}T00:00:00Z`,
      created_at_max: `${endDate}T23:59:59Z`,
      limit: '250'
    })

    let allOrders = []
    let pageInfo = null
    let hasNextPage = true

    // Paginate through all orders
    while (hasNextPage) {
      let apiUrl = `https://${shop}/admin/api/2024-01/orders.json?${params}`
      
      if (pageInfo) {
        apiUrl = `https://${shop}/admin/api/2024-01/orders.json?limit=250&page_info=${pageInfo}`
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
      allOrders = allOrders.concat(data.orders || [])

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
      if (allOrders.length > 5000) break
    }

    // Process orders and extract line item properties
    const processedOrders = []

    for (const order of allOrders) {
      for (const lineItem of order.line_items) {
        // Filter by product if specified
        if (productId && lineItem.product_id?.toString() !== productId) {
          continue
        }

        // Extract line item properties into a map
        const props = {}
        if (lineItem.properties && Array.isArray(lineItem.properties)) {
          for (const prop of lineItem.properties) {
            props[prop.name] = prop.value
          }
        }

        processedOrders.push({
          orderNumber: order.name,
          orderDate: new Date(order.created_at).toLocaleDateString('en-GB'),
          customerName: order.customer 
            ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
            : 'Guest',
          customerEmail: order.customer?.email || order.email || '',
          courseName: lineItem.title + (lineItem.variant_title ? ` - ${lineItem.variant_title}` : ''),
          // Map various possible property names
          childName: props["Child's Name"] || props["Child Name"] || props["child_name"] || '',
          childAge: props["Child's Age"] || props["Child Age"] || props["child_age"] || '',
          childDOB: props["Child's Date of Birth"] || props["Date of Birth"] || props["child_dob"] || '',
          medicalConditions: props["Known Medical Conditions"] || props["Medical Conditions"] || props["medical_conditions"] || '',
          contactPhone: props["Contact Telephone Number"] || props["Contact Phone"] || props["phone"] || '',
          contactEmail: props["Contact Email"] || props["contact_email"] || ''
        })
      }
    }

    return new Response(JSON.stringify({ 
      orders: processedOrders,
      count: processedOrders.length 
    }), { headers })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers
    })
  }
}
