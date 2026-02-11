import { useState, useEffect, useCallback } from 'react'
import {
  Page,
  Layout,
  Card,
  Button,
  DatePicker,
  Select,
  Banner,
  Spinner,
  Text,
  BlockStack,
  InlineStack,
  Box,
  DataTable
} from '@shopify/polaris'

function App({ shop, host }) {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  // Date picker state
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date()
  })
  const [{ month, year }, setDate] = useState({
    month: new Date().getMonth(),
    year: new Date().getFullYear()
  })

  // Products/courses state
  const [products, setProducts] = useState([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Orders state
  const [orders, setOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [error, setError] = useState(null)
  const [previewData, setPreviewData] = useState([])

  // Check authentication on mount
  useEffect(() => {
    checkAuth()
  }, [shop])

  const checkAuth = async () => {
    if (!shop) {
      setError('No shop parameter found')
      setIsCheckingAuth(false)
      return
    }

    try {
      const response = await fetch(`/api/auth/check?shop=${shop}`)
      const data = await response.json()

      if (data.authenticated) {
        setIsAuthenticated(true)
        setIsCheckingAuth(false)
        // Now fetch products
        fetchProducts()
      } else if (data.authUrl) {
        // Need to authenticate - redirect to Shopify OAuth
        // For embedded apps, we need to redirect the top-level window
        if (window.top === window.self) {
          // Not in iframe, redirect normally
          window.location.href = data.authUrl
        } else {
          // In iframe, need to break out
          window.top.location.href = data.authUrl
        }
      } else {
        setError('Authentication check failed')
        setIsCheckingAuth(false)
      }
    } catch (err) {
      setError('Failed to check authentication: ' + err.message)
      setIsCheckingAuth(false)
    }
  }

  const fetchProducts = async () => {
    setLoadingProducts(true)
    try {
      const response = await fetch(`/api/products?shop=${shop}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch products')
      }
      const data = await response.json()
      setProducts(data.products || [])
    } catch (err) {
      setError('Failed to load products: ' + err.message)
    } finally {
      setLoadingProducts(false)
    }
  }

  const fetchOrders = async () => {
    setLoadingOrders(true)
    setError(null)
    setPreviewData([])

    try {
      const params = new URLSearchParams({
        shop,
        startDate: dateRange.start.toISOString().split('T')[0],
        endDate: dateRange.end.toISOString().split('T')[0]
      })
      if (selectedProduct) {
        params.append('productId', selectedProduct)
      }

      const response = await fetch(`/api/orders?${params}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch orders')
      }
      const data = await response.json()
      setOrders(data.orders || [])
      
      const preview = (data.orders || []).slice(0, 5).map(order => [
        order.orderNumber,
        order.customerName,
        order.courseName,
        order.childName || '-',
        order.childAge || '-'
      ])
      setPreviewData(preview)
    } catch (err) {
      setError('Failed to fetch orders: ' + err.message)
    } finally {
      setLoadingOrders(false)
    }
  }

  const handleMonthChange = useCallback((month, year) => {
    setDate({ month, year })
  }, [])

  const handleDateSelection = useCallback(({ start, end }) => {
    setDateRange({ start, end })
  }, [])

  const downloadCSV = () => {
    if (orders.length === 0) return

    const headers = [
      'Order Number',
      'Order Date',
      'Customer Name',
      'Customer Email',
      'Course Name',
      "Child's Name",
      "Child's Age",
      "Child's Date of Birth",
      'Medical Conditions',
      'Contact Telephone',
      'Contact Email'
    ]

    const rows = orders.map(order => [
      order.orderNumber,
      order.orderDate,
      order.customerName,
      order.customerEmail,
      order.courseName,
      order.childName || '',
      order.childAge || '',
      order.childDOB || '',
      order.medicalConditions || '',
      order.contactPhone || '',
      order.contactEmail || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    const filename = `rcfc-courses-${dateRange.start.toISOString().split('T')[0]}-to-${dateRange.end.toISOString().split('T')[0]}.csv`
    link.download = filename
    link.click()
  }

  const productOptions = [
    { label: 'All Courses', value: '' },
    ...products.map(p => ({ label: p.title, value: p.id }))
  ]

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <Page title="Courses Export">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400" inlineAlign="center">
                <Spinner size="large" />
                <Text as="p">Checking authentication...</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    )
  }

  return (
    <Page title="Courses Export">
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Export Course Bookings</Text>
              <Text as="p" tone="subdued">
                Select a date range and optionally filter by course to export booking details including participant information.
              </Text>

              <InlineStack gap="400" align="start">
                <Box minWidth="300px">
                  <BlockStack gap="200">
                    <Text variant="headingSm" as="h3">Date Range</Text>
                    <DatePicker
                      month={month}
                      year={year}
                      onChange={handleDateSelection}
                      onMonthChange={handleMonthChange}
                      selected={dateRange}
                      allowRange
                    />
                    <Text as="p" tone="subdued">
                      {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
                    </Text>
                  </BlockStack>
                </Box>

                <Box minWidth="250px">
                  <BlockStack gap="200">
                    <Text variant="headingSm" as="h3">Filter by Course</Text>
                    {loadingProducts ? (
                      <Spinner size="small" />
                    ) : (
                      <Select
                        label="Course"
                        labelHidden
                        options={productOptions}
                        value={selectedProduct}
                        onChange={setSelectedProduct}
                      />
                    )}
                  </BlockStack>
                </Box>
              </InlineStack>

              <InlineStack gap="300">
                <Button onClick={fetchOrders} loading={loadingOrders}>
                  Search Orders
                </Button>
                <Button
                  variant="primary"
                  onClick={downloadCSV}
                  disabled={orders.length === 0}
                >
                  Download CSV ({orders.length} bookings)
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {previewData.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">Preview (first 5 results)</Text>
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                  headings={['Order #', 'Customer', 'Course', 'Child Name', 'Age']}
                  rows={previewData}
                />
                {orders.length > 5 && (
                  <Text as="p" tone="subdued">
                    ...and {orders.length - 5} more bookings
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  )
}

export default App
