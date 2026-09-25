import React from 'react'
import { createRoot } from 'react-dom/client'
import Storefront from './storefront/Storefront'
import './storefront.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode><Storefront /></React.StrictMode>,
)

