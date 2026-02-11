import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppProvider } from '@shopify/polaris'
import '@shopify/polaris/build/esm/styles.css'
import App from './App'

// Get shop from URL params (passed by Shopify)
const params = new URLSearchParams(window.location.search)
const shop = params.get('shop')
const host = params.get('host')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider i18n={{}}>
      <App shop={shop} host={host} />
    </AppProvider>
  </React.StrictMode>
)
